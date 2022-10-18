package server

import (
	"bytes"
	"context"
	"io"
	"os/exec"

	"github.com/sourcegraph/sourcegraph/lib/errors"
)

func lfsSmudge(ctx context.Context, dir GitDir, commit, path string) (io.ReadCloser, error) {
	var pointerArr [201]byte
	pointerStdout := &hardLimitWriter{Buf: pointerArr[:]}
	cmd := exec.CommandContext(ctx, "git", "show", commit+":"+path)
	dir.Set(cmd)
	cmd.Stdout = pointerStdout

	if err := cmd.Run(); err != nil {
		// TODO err handling
		return nil, err
	}

	// TODO observability. This should probably go via exec

	cmd = exec.CommandContext(ctx, "git", "lfs", "smudge", path)
	dir.Set(cmd)
	cmd.Stdin = bytes.NewReader(pointerStdout.Bytes())
	out, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	go cmd.Wait()

	return out, nil
}

var errLimitReached = errors.New("hardLimitWriter: could not write due to reaching limit")

// hardLimitWriter is a writer that will write at most len(Buf) bytes,
// afterwhich it returns errLimitReached.
type hardLimitWriter struct {
	Buf []byte
	N   int
}

func (w *hardLimitWriter) Write(p []byte) (n int, err error) {
	n = copy(w.Buf[w.N:], p)
	w.N += n
	if n != len(p) {
		return n, errLimitReached
	}
	return n, nil
}

func (w *hardLimitWriter) Bytes() []byte {
	return w.Buf[:w.N]
}
