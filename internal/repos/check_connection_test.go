package repos

import (
	"testing"

	"github.com/sourcegraph/log"
)

func TestDnsLookup(t *testing.T) {
	logger := log.Scoped("dnsLookupTest", "")

	t.Run("bad URL", func(t *testing.T) {
		if err := dnsLookup(logger, "foo"); err == nil {
			t.Error("Expected error but got nil")
		}
	})

	t.Run("good URL", func(t *testing.T) {
		if err := dnsLookup(logger, "https://sourcegraph.com"); err != nil {
			t.Errorf("Expected nil but got error: %v", err)
		}
	})

	t.Run("good URL with port", func(t *testing.T) {
		if err := dnsLookup(logger, "https://sourcegraph.com:80"); err != nil {
			t.Errorf("Expected nil but got error: %v", err)
		}
	})

	t.Run("good URL without protocol", func(t *testing.T) {
		if err := dnsLookup(logger, "sourcegraph.com"); err != nil {
			t.Errorf("Expected nil but got error: %v", err)
		}
	})

	t.Run("good URL with port but without protocol", func(t *testing.T) {
		if err := dnsLookup(logger, "sourcegraph.com:80"); err != nil {
			t.Errorf("Expected nil but got error: %v", err)
		}
	})

	t.Run("good URL with username:password", func(t *testing.T) {
		if err := dnsLookup(logger, "https://username:password@sourcegraph.com"); err != nil {
			t.Errorf("Expected nil but got error: %v", err)
		}
	})
}

func TestPing(t *testing.T) {
	logger := log.Scoped("pingTest", "")

	t.Run("hostname and port", func(t *testing.T) {
		if err := ping(logger, "sourcegraph.com:80"); err != nil {
			t.Errorf("Expected nil but got error: %v", err)
		}
	})

	t.Run("hostname and no port", func(t *testing.T) {
		if err := ping(logger, "ghe.sgdev.org"); err != nil {
			t.Errorf("Expected nil but got error: %v", err)
		}
	})

	t.Run("protocol and hostname", func(t *testing.T) {
		if err := ping(logger, "https://ghe.sgdev.org"); err != nil {
			t.Errorf("Expected nil but got error: %v", err)
		}
	})
}
