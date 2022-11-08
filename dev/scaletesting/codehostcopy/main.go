package main

import (
	"context"
	_ "embed"
	"fmt"
	"net/url"
	"os"
	"time"

	"cuelang.org/go/cue/errors"
	"github.com/urfave/cli/v2"

	"github.com/sourcegraph/log"

	"github.com/sourcegraph/sourcegraph/dev/scaletesting/internal/store"
)

//go:embed config.example.cue
var exampleConfig string

type CodeHostSource interface {
	ListRepos(ctx context.Context, limit int) ([]*store.Repo, error)
}

type CodeHostDestination interface {
	CreateRepo(ctx context.Context, name string) (*url.URL, error)
}

var app = &cli.App{
	Usage:       "Copy organizations across code hosts",
	Description: "https://handbook.sourcegraph.com/departments/engineering/dev/tools/scaletesting/",
	Compiled:    time.Now(),
	Flags: []cli.Flag{
		&cli.StringFlag{
			Name:  "state",
			Usage: "Path to the file storing state, to resume work from",
			Value: "codehostcopy.db",
		},
		&cli.StringFlag{
			Name:     "config",
			Usage:    "Path to the config file defining what to copy",
			Required: true,
		},
		&cli.IntFlag{
			Name:  "limit",
			Usage: "How many repos to copy",
			Value: -1,
		},
	},
	Action: func(cmd *cli.Context) error {
		return doRun(cmd.Context, log.Scoped("runner", ""), cmd.String("state"), cmd.String("config"), cmd.Int("limit"))
	},
	Commands: []*cli.Command{
		{
			Name:        "example",
			Description: "Create a new config file to start from",
			Action: func(ctx *cli.Context) error {
				fmt.Printf("%s", exampleConfig)
				return nil
			},
		},
	},
}

func doRun(ctx context.Context, logger log.Logger, state string, config string, limit int) error {
	cfg, err := loadConfig(config)
	if err != nil {
		var cueErr errors.Error
		if errors.As(err, &cueErr) {
			logger.Info(errors.Details(err, nil))
		}
		logger.Fatal("failed to load config", log.Error(err))
	}

	s, err := store.New(state)
	if err != nil {
		logger.Fatal("failed to init state", log.Error(err))
	}

	var source CodeHostSource
	var dest CodeHostDestination
	switch cfg.From.Kind {
	case "github":
		source, err = NewGithubCodeHost(ctx, &cfg.From)
		if err != nil {
			logger.Fatal("failed to init source GitHub code host", log.Error(err))
		}
	case "gitlab":
		source, err = NewGitLabCodeHost(ctx, &cfg.Destination)
		if err != nil {
			logger.Fatal("failed to init source GitLab code host", log.Error(err))
		}
	}

	switch cfg.Destination.Kind {
	case "github":
		dest, err = NewGithubCodeHost(ctx, &cfg.Destination)
		if err != nil {
			logger.Fatal("failed to init destination GitHub code host", log.Error(err))
		}
	case "gitlab":
		dest, err = NewGitLabCodeHost(ctx, &cfg.Destination)
		if err != nil {
			logger.Fatal("failed to init destination GitHub code host", log.Error(err))
		}
	}

	runner := NewRunner(logger, s, source, dest, limit)
	return runner.Run(ctx, 20)
}

func main() {
	cb := log.Init(log.Resource{
		Name: "codehostcopy",
	})
	defer cb.Sync()
	logger := log.Scoped("main", "")

	if err := app.RunContext(context.Background(), os.Args); err != nil {
		logger.Fatal("failed to run", log.Error(err))
	}

}
