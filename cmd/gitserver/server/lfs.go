package server

import (
	"encoding/json"
	"net/http"
	"os/exec"
	"strings"

	"github.com/sourcegraph/sourcegraph/cmd/gitserver/server/internal/accesslog"
	"github.com/sourcegraph/sourcegraph/internal/gitserver/protocol"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

func (s *Server) serveLFSFetch(w http.ResponseWriter, r *http.Request) {
	// 🚨 SECURITY: Only allow POST requests.
	// See https://github.com/sourcegraph/security-issues/issues/213.
	if strings.ToUpper(r.Method) != http.MethodPost {
		http.Error(w, "", http.StatusMethodNotAllowed)
		return
	}

	var req protocol.LFSFetchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Log which which actor is accessing the repo.
	accesslog.Record(r.Context(), string(req.Repo), map[string]string{
		"commit": string(req.CommitID),
		"path":   req.Path,
	})

	s.lfsFetch(w, r, &req)
}

func (s *Server) lfsFetch(w http.ResponseWriter, r *http.Request, req *protocol.LFSFetchRequest) error {
	ctx := r.Context()
	//logger := s.Logger.Scoped("lfsFetch", "").With(req.LogFields()...)

	repo := protocol.NormalizeRepo(req.Repo)
	dir := s.dir(repo)

	remoteURL, err := s.getRemoteURL(ctx, repo)
	if err != nil {
		return errors.Wrap(err, "failed to determine Git remote URL")
	}

	// TODO do we need to quote arguments to -X

	// git lfs fetch https://github.com/sgtest/lfs.git 01f1c1d7423442d61b9e6638c1e5f3a5c1aafca0 -X in-lfs.md
	cmd := exec.CommandContext(ctx, "git", "lfs", "fetch", remoteURL.String(), string(req.CommitID), "-X", req.Path)
	dir.Set(cmd)

	if output, err := runWith(ctx, cmd, true, nil); err != nil {
		return errors.Wrapf(err, "clone failed. Output: %s", string(output))
	}

	return nil
}
