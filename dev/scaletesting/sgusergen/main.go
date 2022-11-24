package main

import (
	"context"
	"encoding/csv"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/sourcegraph/run"
)

type config struct {
	csvPath string

	ghBaseUrl    string
	ghAdminToken string
	ghClientId   string

	sgExtSvcDisplayName string
}

func main() {
	var cfg config

	flag.StringVar(&cfg.csvPath, "csv.path", "", "(required) path to csv file containing username/oauth token pairs")
	flag.StringVar(&cfg.ghBaseUrl, "gh.baseUrl", "", "(required) base url of the GH(E) instance")
	flag.StringVar(&cfg.ghAdminToken, "gh.adminToken", "", "(required) PAT of admin on GH(E) instance")
	flag.StringVar(&cfg.ghClientId, "gh.clientId", "", "(required) OAuth app client ID on GH(E) instance")
	flag.StringVar(&cfg.sgExtSvcDisplayName, "sg.ExtSvcDisplayName", "", "(required) display name of the code host connection on the SG instance")

	flag.Parse()

	ctx := context.Background()

	csvF, err := os.Open(cfg.csvPath)
	if err != nil {
		log.Fatal(err)
	}

	defer csvF.Close()

	csvReader := csv.NewReader(csvF)
	if _, err = csvReader.Read(); err != nil {
		log.Fatal(err)
	}
	data, err := csvReader.ReadAll()
	if err != nil {
		log.Fatal(err)
	}

	lines, err := run.Bash(ctx, "sg src-instance list").Run().Lines()
	if err != nil {
		log.Fatal(err)
	}

	foundSct := false
	for _, l := range lines {
		if strings.Contains(l, "scaletesting") {
			foundSct = true
			break
		}
	}

	if !foundSct {
		log.Fatal("Scaletesting instance not registered with sg src-instance! First run:\nsg src-instance register scaletesting https://scaletesting.sgdev.org")
	}

	err = run.Bash(ctx, "sg src-instance use scaletesting").Run().Wait()
	if err != nil {
		log.Fatal(err)
	}

	for _, line := range data {
		username := line[0]
		oAuthToken := line[1]

		println(fmt.Sprintf("Processing user %s", username))

		getUserResult, sgErr := run.Bash(ctx, "sg src users create",
			fmt.Sprintf("-email=%s@scaletesting.sourcegraph.com", username),
			fmt.Sprintf("-username=%s", username)).Run().String()

		if sgErr != nil && !strings.Contains(getUserResult, "err_username_exists") {
			log.Fatal(sgErr)
		}

		command := run.Bash(ctx, "go run ./dev/sg/. db update-user-external-services",
			fmt.Sprintf("--github.username=\"%s\"", username),
			fmt.Sprintf("--sg.username=\"%s\"", username),
			fmt.Sprintf("--extsvc.display-name=\"%s\"", cfg.sgExtSvcDisplayName),
			fmt.Sprintf("--github.token=\"%s\"", cfg.ghAdminToken),
			fmt.Sprintf("--github.baseurl=\"%s\"", cfg.ghBaseUrl),
			fmt.Sprintf("--github.client-id=\"%s\"", cfg.ghClientId),
			fmt.Sprintf("--oauth.token=\"%s\"", oAuthToken))

		output, sgErr := command.Run().String()
		if sgErr != nil {
			log.Fatalf("Failed to update external services for user %s: %s", username, output)
		}
	}
}
