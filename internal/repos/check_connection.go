package repos

import (
	"net"
	"net/url"
	"time"

	"github.com/sourcegraph/log"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

func getHostname(rawURL string) (string, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", errors.Wrap(err, "invalid or bad url for connection check")
	}

	// Best effort at finding a hostname. For example if rawURL is sourcegraph.com, then u.Host is
	// empty but Path is sourcegraph.com. Use that as a result.
	//
	// 👉 Also, we need to use u.Hostname() here because we want to strip any port numbers if they
	// are present in u.Host.
	hostname := u.Hostname()
	if hostname == "" {
		if u.Scheme != "" {
			// rawURL is most likely something like "sourcegraph.com:80", read from u.Scheme.
			hostname = u.Scheme
		} else if u.Path != "" {
			// rawURL is most likely something like "sourcegraph.com:80", read from u.Path.
			hostname = u.Path
		} else {
			return "", errors.Newf("unsupported url format (%q) for connection check", rawURL)
		}
	}

	return hostname, nil
}

// checkConnection parses the rawURL and makes a best effort attempt to obtain a hostname. It then
// performs an IP lookup on that hostname and returns a non-nil error on failure.
//
// At the moment this function is only limited to doing IP lookups. We may want/have to expand this
// to support other code hosts or to add more checks (for example making a test API call to verify
// the authorization, etc).
func checkConnection(rawURL string) error {
	logger := log.Scoped("checkConnection", "")

	if err := dnsLookup(logger, rawURL); err != nil {
		return errors.Wrap(err, "DNS lookup failed")
	}

	if err := ping(logger, rawURL); err != nil {
		return errors.Wrap(err, "ping failed")
	}

	return nil
}

func dnsLookup(logger log.Logger, rawURL string) error {
	hostname, err := getHostname(rawURL)
	if err != nil {
		return errors.Wrap(err, "getHostname failed")
	}

	ips, err := net.LookupIP(hostname)
	if err != nil {
		return errors.Wrap(err, "DNS check failed")
	}

	if len(ips) == 0 {
		return errors.Newf("DNS check failed, no IP addresses found for hostname %q", hostname)
	}

	return nil
}

// ping attempts to connect to the given rawURL. Technically it is not exactly a ping request in the
// UNIX sense since it uses TCP instead of ICMP. But we use the name to signifiy the intent here,
// which is check if we can connect to the URL.
func ping(logger log.Logger, rawURL string) error {
	var address string

	// Check if rawURL includes a port in it.
	_, port, err := net.SplitHostPort(rawURL)
	if err != nil {
		// If no port is set, default to 80.
		address = net.JoinHostPort(rawURL, "80")
	} else {
		// We need to split the protocol from rawURL.
		hostname, err := getHostname(rawURL)
		if err != nil {
			return errors.Wrap(err, "getHostname failed")
		}

		address = net.JoinHostPort(hostname, port)
	}

	logger.Warn("Dialing with timeout (1s)", log.String("address", address))
	_, err = net.DialTimeout("tcp", address, time.Duration(time.Second))
	return err
}
