package graphql

import (
	"context"

	"github.com/sourcegraph/sourcegraph/internal/api"
	autoindex "github.com/sourcegraph/sourcegraph/internal/codeintel/autoindexing/shared"
	policy "github.com/sourcegraph/sourcegraph/internal/codeintel/policies/transport/graphql"
	"github.com/sourcegraph/sourcegraph/internal/database"
	"github.com/sourcegraph/sourcegraph/internal/gitserver/gitdomain"
)

type AutoIndexingService interface {
	GetIndexesByIDs(ctx context.Context, ids ...int) (_ []autoindex.Index, err error)
	GetListTags(ctx context.Context, repo api.RepoName, commitObjs ...string) (_ []*gitdomain.Tag, err error)
	GetUnsafeDB() database.DB
}

type PolicyResolver interface {
	PolicyResolverFactory(ctx context.Context) (_ policy.PolicyResolver, err error)
}
