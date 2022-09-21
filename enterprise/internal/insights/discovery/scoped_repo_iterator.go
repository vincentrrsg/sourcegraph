package discovery

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/sourcegraph/log"

	"github.com/sourcegraph/sourcegraph/internal/search/streaming"

	insightsclients "github.com/sourcegraph/sourcegraph/enterprise/internal/insights/query/streaming"
	"github.com/sourcegraph/sourcegraph/internal/api"
	"github.com/sourcegraph/sourcegraph/internal/database"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

type simpleRepo struct {
	name string
	id   api.RepoID
}

type ScopedRepoIterator struct {
	repos []simpleRepo
}

func (s *ScopedRepoIterator) ForEach(ctx context.Context, each func(repoName string, id api.RepoID) error) error {
	for _, repo := range s.repos {
		err := each(repo.name, repo.id)
		if err != nil {
			return err
		}
	}
	return nil
}

func NewScopedRepoIterator(ctx context.Context, repoNames []string, store RepoStore) (*ScopedRepoIterator, error) {
	repos, err := loadRepoIds(ctx, repoNames, store)
	if err != nil {
		return nil, err
	}
	return &ScopedRepoIterator{repos: repos}, nil
}

func loadRepoIds(ctx context.Context, repoNames []string, repoStore RepoStore) ([]simpleRepo, error) {
	list, err := repoStore.List(ctx, database.ReposListOptions{Names: repoNames})
	if err != nil {
		return nil, errors.Wrap(err, "repoStore.List")
	}
	var results []simpleRepo
	for _, repo := range list {
		results = append(results, simpleRepo{
			name: string(repo.Name),
			id:   repo.ID,
		})
	}
	return results, nil
}

type dynamicRepoIterator struct {
	repos []simpleRepo
}

func (d *dynamicRepoIterator) ForEach(ctx context.Context, each func(repoName string, id api.RepoID) error) error {
	for _, repo := range d.repos {
		err := each(repo.name, repo.id)
		if err != nil {
			return err
		}
	}
	return nil
}

func NewDynamicRepoIterator(ctx context.Context, db database.DB) (*dynamicRepoIterator, error) {
	// probably need to use the internal actor here
	logger := log.Scoped("thing", "thing")
	repos, err := loadDynamic(ctx, db, logger, "repo:sourcegraph")
	if err != nil {
		return nil, err
	}
	return &dynamicRepoIterator{repos: repos}, nil
}

func loadDynamic(ctx context.Context, db database.DB, logger log.Logger, query string) ([]simpleRepo, error) {
	start := time.Now()
	var repos []simpleRepo

	client := insightsclients.NewInsightsSearchClient(db)
	st := "standard"
	stream := streaming.NewAggregatingStream()
	q := fmt.Sprintf("select:repo count:all fork:yes archived:yes %s", query)
	logger.Info("q", log.String("query", q))
	_, err := client.Search(ctx, q, &st, stream)
	if err != nil {
		return nil, err
	}
	for _, match := range stream.Results {
		// switch match.(type) {
		// case *result.RepoMatch:
		repos = append(repos, simpleRepo{
			name: string(match.RepoName().Name),
			id:   match.RepoName().ID,
		})
		// }
		// default:
	}
	end := time.Now()

	logger.Info("done loading dynamic context", log.Int("count", len(repos)), log.Float64("duration", end.Sub(start).Seconds()))

	return repos, nil
}

type repoCache struct {
	mutex  sync.RWMutex
	values map[int]string

	store RepoStore
}

func newRepoCache(db database.DB) *repoCache {
	return &repoCache{values: make(map[int]string), store: db.Repos()}
}

func (r *repoCache) Get(ctx context.Context, id int) string {
	r.mutex.RLock()

	if val, ok := r.values[id]; ok {
		defer r.mutex.RUnlock()
		return val
	}

	list, err := r.store.List(ctx, database.ReposListOptions{IDs: []api.RepoID{api.RepoID(id)}})
	if err != nil {
		return ""
	}
}
