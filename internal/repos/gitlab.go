package repos

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"golang.org/x/oauth2"

	"github.com/sourcegraph/log"

	"github.com/sourcegraph/sourcegraph/cmd/frontend/envvar"
	"github.com/sourcegraph/sourcegraph/internal/conf"
	"github.com/sourcegraph/sourcegraph/internal/conf/reposource"
	"github.com/sourcegraph/sourcegraph/internal/database"
	"github.com/sourcegraph/sourcegraph/internal/extsvc"
	"github.com/sourcegraph/sourcegraph/internal/extsvc/auth"
	"github.com/sourcegraph/sourcegraph/internal/extsvc/gitlab"
	"github.com/sourcegraph/sourcegraph/internal/httpcli"
	"github.com/sourcegraph/sourcegraph/internal/jsonc"
	"github.com/sourcegraph/sourcegraph/internal/ratelimit"
	"github.com/sourcegraph/sourcegraph/internal/types"
	"github.com/sourcegraph/sourcegraph/lib/errors"
	"github.com/sourcegraph/sourcegraph/schema"
)

// A GitLabSource yields repositories from a single GitLab connection configured
// in Sourcegraph via the external services configuration.
type GitLabSource struct {
	svc                 *types.ExternalService
	config              *schema.GitLabConnection
	exclude             excludeFunc
	baseURL             *url.URL // URL with path /api/v4 (no trailing slash)
	nameTransformations reposource.NameTransformations
	provider            *gitlab.ClientProvider
	client              *gitlab.Client
	logger              log.Logger
}

var _ Source = &GitLabSource{}
var _ UserSource = &GitLabSource{}
var _ AffiliatedRepositorySource = &GitLabSource{}
var _ VersionSource = &GitLabSource{}

// NewGitLabSource returns a new GitLabSource from the given external service.
func NewGitLabSource(ctx context.Context, logger log.Logger, db database.DB, svc *types.ExternalService, cf *httpcli.Factory) (*GitLabSource, error) {
	var c schema.GitLabConnection
	if err := jsonc.Unmarshal(svc.Config, &c); err != nil {
		return nil, errors.Errorf("external service id=%d config error: %s", svc.ID, err)
	}
	return newGitLabSource(ctx, logger, db, svc, &c, cf)
}

var gitlabRemainingGauge = promauto.NewGaugeVec(prometheus.GaugeOpts{
	Name: "src_gitlab_rate_limit_remaining",
	Help: "Number of calls to GitLab's API remaining before hitting the rate limit.",
}, []string{"resource", "name"})

var gitlabRatelimitWaitCounter = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "src_gitlab_rate_limit_wait_duration_seconds",
	Help: "The amount of time spent waiting on the rate limit",
}, []string{"resource", "name"})

func newGitLabSource(ctx context.Context, logger log.Logger, db database.DB, svc *types.ExternalService, c *schema.GitLabConnection, cf *httpcli.Factory) (*GitLabSource, error) {
	baseURL, err := url.Parse(c.Url)
	if err != nil {
		return nil, err
	}
	baseURL = extsvc.NormalizeBaseURL(baseURL)

	if cf == nil {
		cf = httpcli.ExternalClientFactory
	}

	var opts []httpcli.Opt
	if c.Certificate != "" {
		opts = append(opts, httpcli.NewCertPoolOpt(c.Certificate))
	}

	cli, err := cf.Doer(opts...)
	if err != nil {
		return nil, err
	}

	var eb excludeBuilder
	for _, r := range c.Exclude {
		eb.Exact(r.Name)
		eb.Exact(strconv.Itoa(r.Id))
	}
	exclude, err := eb.Build()
	if err != nil {
		return nil, err
	}

	// Validate and cache user-defined name transformations.
	nts, err := reposource.CompileGitLabNameTransformations(c.NameTransformations)
	if err != nil {
		return nil, err
	}

	provider := gitlab.NewClientProvider(svc.URN(), baseURL, cli)

	var client *gitlab.Client
	switch gitlab.TokenType(c.TokenType) {
	case gitlab.TokenTypeOAuth:
		refreshed, err := maybeRefreshGitLabOAuthTokenFromCodeHost(ctx, logger, db, svc)
		if err != nil {
			return nil, errors.Wrap(err, "refreshing OAuth token")
		}
		c.Token = refreshed
		client = provider.GetOAuthClient(c.Token)
	default:
		client = provider.GetPATClient(c.Token, "")
	}

	if !envvar.SourcegraphDotComMode() || svc.CloudDefault {
		client.RateLimitMonitor().SetCollector(&ratelimit.MetricsCollector{
			Remaining: func(n float64) {
				gitlabRemainingGauge.WithLabelValues("rest", svc.DisplayName).Set(n)
			},
			WaitDuration: func(n time.Duration) {
				gitlabRatelimitWaitCounter.WithLabelValues("rest", svc.DisplayName).Add(n.Seconds())
			},
		})
	}

	return &GitLabSource{
		svc:                 svc,
		config:              c,
		exclude:             exclude,
		baseURL:             baseURL,
		nameTransformations: nts,
		provider:            provider,
		client:              client,
		logger:              logger,
	}, nil
}

func (s GitLabSource) WithAuthenticator(a auth.Authenticator) (Source, error) {
	switch a.(type) {
	case *auth.OAuthBearerToken,
		*auth.OAuthBearerTokenWithSSH:
		break

	default:
		return nil, newUnsupportedAuthenticatorError("GitLabSource", a)
	}

	sc := s
	sc.client = sc.client.WithAuthenticator(a)

	return &sc, nil
}

func (s GitLabSource) Version(ctx context.Context) (string, error) {
	return s.client.GetVersion(ctx)
}

func (s GitLabSource) ValidateAuthenticator(ctx context.Context) error {
	return s.client.ValidateToken(ctx)
}

// ListRepos returns all GitLab repositories accessible to all connections configured
// in Sourcegraph via the external services configuration.
func (s GitLabSource) ListRepos(ctx context.Context, results chan SourceResult) {
	s.listAllProjects(ctx, results)
}

// GetRepo returns the GitLab repository with the given pathWithNamespace.
func (s GitLabSource) GetRepo(ctx context.Context, pathWithNamespace string) (*types.Repo, error) {
	proj, err := s.client.GetProject(ctx, gitlab.GetProjectOp{
		PathWithNamespace: pathWithNamespace,
		CommonOp:          gitlab.CommonOp{NoCache: true},
	})

	if err != nil {
		return nil, err
	}

	return s.makeRepo(proj), nil
}

// ExternalServices returns a singleton slice containing the external service.
func (s GitLabSource) ExternalServices() types.ExternalServices {
	return types.ExternalServices{s.svc}
}

func (s GitLabSource) makeRepo(proj *gitlab.Project) *types.Repo {
	urn := s.svc.URN()
	return &types.Repo{
		Name: reposource.GitLabRepoName(
			s.config.RepositoryPathPattern,
			s.baseURL.Hostname(),
			proj.PathWithNamespace,
			s.nameTransformations,
		),
		URI: string(reposource.GitLabRepoName(
			"",
			s.baseURL.Hostname(),
			proj.PathWithNamespace,
			s.nameTransformations,
		)),
		ExternalRepo: gitlab.ExternalRepoSpec(proj, *s.baseURL),
		Description:  proj.Description,
		Fork:         proj.ForkedFromProject != nil,
		Archived:     proj.Archived,
		Stars:        proj.StarCount,
		Private:      proj.Visibility == "private",
		Sources: map[string]*types.SourceInfo{
			urn: {
				ID:       urn,
				CloneURL: s.remoteURL(proj),
			},
		},
		Metadata: proj,
	}
}

// remoteURL returns the GitLab projects's Git remote URL
//
// note: this used to contain credentials but that is no longer the case
// if you need to get an authenticated clone url use repos.CloneURL
func (s *GitLabSource) remoteURL(proj *gitlab.Project) string {
	if s.config.GitURLType == "ssh" {
		return proj.SSHURLToRepo // SSH authentication must be provided out-of-band
	}
	return proj.HTTPURLToRepo
}

func (s *GitLabSource) excludes(p *gitlab.Project) bool {
	return s.exclude(p.PathWithNamespace) || s.exclude(strconv.Itoa(p.ID))
}

func (s *GitLabSource) listAllProjects(ctx context.Context, results chan SourceResult) {
	type batch struct {
		projs []*gitlab.Project
		err   error
	}

	ch := make(chan batch)

	var wg sync.WaitGroup

	projch := make(chan *schema.GitLabProject)
	for i := 0; i < 5; i++ { // 5 concurrent requests
		wg.Add(1)
		go func() {
			defer wg.Done()
			for p := range projch {
				proj, err := s.client.GetProject(ctx, gitlab.GetProjectOp{
					ID:                p.Id,
					PathWithNamespace: p.Name,
					CommonOp:          gitlab.CommonOp{NoCache: true},
				})

				if err != nil {
					// TODO(tsenart): When implementing dry-run, reconsider alternatives to return
					// 404 errors on external service config validation.
					if gitlab.IsNotFound(err) {
						s.logger.Warn("skipping missing gitlab.projects entry:", log.String("name", p.Name), log.Int("id", p.Id), log.Error(err))
						continue
					}
					ch <- batch{err: errors.Wrapf(err, "gitlab.projects: id: %d, name: %q", p.Id, p.Name)}
				} else {
					ch <- batch{projs: []*gitlab.Project{proj}}
				}

				time.Sleep(s.client.RateLimitMonitor().RecommendedWaitForBackgroundOp(1))
			}
		}()
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		defer close(projch)
		// Admins normally add to end of lists, so end of list most likely has
		// new repos => stream them first.
		for i := len(s.config.Projects) - 1; i >= 0; i-- {
			select {
			case projch <- s.config.Projects[i]:
			case <-ctx.Done():
				return
			}
		}
	}()

	for _, projectQuery := range s.config.ProjectQuery {
		if projectQuery == "none" {
			continue
		}

		const perPage = 100
		wg.Add(1)
		go func(projectQuery string) {
			defer wg.Done()

			url, err := projectQueryToURL(projectQuery, perPage) // first page URL
			if err != nil {
				ch <- batch{err: errors.Wrapf(err, "invalid GitLab projectQuery=%q", projectQuery)}
				return
			}

			for {
				if err := ctx.Err(); err != nil {
					ch <- batch{err: err}
					return
				}
				projects, nextPageURL, err := s.client.ListProjects(ctx, url)
				if err != nil {
					ch <- batch{err: errors.Wrapf(err, "error listing GitLab projects: url=%q", url)}
					return
				}
				ch <- batch{projs: projects}
				if nextPageURL == nil {
					return
				}
				url = *nextPageURL

				// 0-duration sleep unless nearing rate limit exhaustion
				time.Sleep(s.client.RateLimitMonitor().RecommendedWaitForBackgroundOp(1))
			}
		}(projectQuery)
	}

	go func() {
		wg.Wait()
		close(ch)
	}()

	seen := make(map[int]bool)
	for b := range ch {
		if b.err != nil {
			results <- SourceResult{Source: s, Err: b.err}
			continue
		}

		for _, proj := range b.projs {
			if !seen[proj.ID] && !s.excludes(proj) {
				results <- SourceResult{Source: s, Repo: s.makeRepo(proj)}
				seen[proj.ID] = true
			}
		}
	}
}

var schemeOrHostNotEmptyErr = errors.New("scheme and host should be empty")

func projectQueryToURL(projectQuery string, perPage int) (string, error) {
	// If all we have is the URL query, prepend "projects"
	if strings.HasPrefix(projectQuery, "?") {
		projectQuery = "projects" + projectQuery
	} else if projectQuery == "" {
		projectQuery = "projects"
	}

	u, err := url.Parse(projectQuery)
	if err != nil {
		return "", err
	}
	if u.Scheme != "" || u.Host != "" {
		return "", schemeOrHostNotEmptyErr
	}
	q := u.Query()
	q.Set("per_page", strconv.Itoa(perPage))
	u.RawQuery = q.Encode()

	return u.String(), nil
}

func (s *GitLabSource) AffiliatedRepositories(ctx context.Context) ([]types.CodeHostRepository, error) {
	queryURL, err := projectQueryToURL("projects?membership=true&archived=no", 40) // first page URL
	if err != nil {
		return nil, err
	}
	var (
		projects    []*gitlab.Project
		nextPageURL = &queryURL
	)

	out := []types.CodeHostRepository{}
	for nextPageURL != nil {
		projects, nextPageURL, err = s.client.ListProjects(ctx, *nextPageURL)
		if err != nil {
			return nil, err
		}
		for _, p := range projects {
			out = append(out, types.CodeHostRepository{
				Name:       p.PathWithNamespace,
				Private:    p.Visibility == "private",
				CodeHostID: s.svc.ID,
			})
		}
	}
	return out, nil
}

func maybeRefreshGitLabOAuthTokenFromCodeHost(ctx context.Context, logger log.Logger, db database.DB, svc *types.ExternalService) (accessToken string, err error) {
	parsed, err := extsvc.ParseConfig(svc.Kind, svc.Config)
	if err != nil {
		return "", errors.Wrap(err, "parsing external service config")
	}

	config, ok := parsed.(*schema.GitLabConnection)
	if !ok {
		return "", errors.Errorf("want *schema.GitLabConnection, got %T", parsed)
	}

	// We may have old config without a refresh token
	if config.TokenOauthRefresh == "" {
		gitlab.TokenMissingRefreshCounter.Inc()
		return config.Token, nil
	}

	var oauthConfig *oauth2.Config
	for _, authProvider := range conf.SiteConfig().AuthProviders {
		if authProvider.Gitlab == nil ||
			strings.TrimSuffix(config.Url, "/") != strings.TrimSuffix(authProvider.Gitlab.Url, "/") {
			continue
		}
		oauthConfig = oauth2ConfigFromGitLabProvider(authProvider.Gitlab)
		break
	}

	if oauthConfig == nil {
		logger.Warn("PermsSyncer.maybeRefreshGitLabOAuthTokenFromCodeHost, external service has no auth.provider",
			log.Int64("externalServiceID", svc.ID),
		)
		return config.Token, nil
	}

	tok := &oauth2.Token{
		AccessToken:  config.Token,
		RefreshToken: config.TokenOauthRefresh,
		Expiry:       time.Unix(int64(config.TokenOauthExpiry), 0),
	}

	refreshedToken, err := oauthConfig.TokenSource(ctx, tok).Token()
	if err != nil {
		return "", errors.Wrap(err, "refresh token")
	}

	if refreshedToken.AccessToken != tok.AccessToken {
		defer func() {
			success := err == nil
			gitlab.TokenRefreshCounter.WithLabelValues("codehost", strconv.FormatBool(success)).Inc()
		}()
		svc.Config, err = jsonc.Edit(svc.Config, refreshedToken.AccessToken, "token")
		if err != nil {
			return "", errors.Wrap(err, "updating OAuth token")
		}
		svc.Config, err = jsonc.Edit(svc.Config, refreshedToken.RefreshToken, "token.oauth.refresh")
		if err != nil {
			return "", errors.Wrap(err, "updating OAuth refresh token")
		}
		svc.Config, err = jsonc.Edit(svc.Config, refreshedToken.Expiry.Unix(), "token.oauth.expiry")
		if err != nil {
			return "", errors.Wrap(err, "updating OAuth token expiry")
		}
		svc.UpdatedAt = time.Now()
		if err := db.ExternalServices().Upsert(ctx, svc); err != nil {
			return "", errors.Wrap(err, "upserting external service")
		}
	}
	return refreshedToken.AccessToken, nil
}

func oauth2ConfigFromGitLabProvider(p *schema.GitLabAuthProvider) *oauth2.Config {
	url := strings.TrimSuffix(p.Url, "/")
	return &oauth2.Config{
		ClientID:     p.ClientID,
		ClientSecret: p.ClientSecret,
		Endpoint: oauth2.Endpoint{
			AuthURL:  url + "/oauth/authorize",
			TokenURL: url + "/oauth/token",
		},
		Scopes: gitlab.RequestedOAuthScopes(p.ApiScope, nil),
	}
}
