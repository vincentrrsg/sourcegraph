package main

import (
	"encoding/csv"
	"flag"
	"fmt"
	"log"
	"os"
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

	//ctx := context.Background()

	csvF, err := os.Open(cfg.csvPath)
	if err != nil {
		log.Fatal(err)
	}

	defer csvF.Close()

	csvReader := csv.NewReader(csvF)
	data, err := csvReader.ReadAll()
	if err != nil {
		log.Fatal(err)
	}

	for _, line := range data {
		println(fmt.Sprintf("%v", line))
	}

	//for {
	//	username := ""
	//	oAuthToken := ""
	//
	//	command := run.Bash(ctx, "go run ./dev/sg/. db update-user-external-services",
	//		"--github.username=sander",
	//		"--sg.username=sander",
	//		"--extsvc.display-name=\"GITHUB #2\"",
	//		"--github.token=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",
	//		"--github.baseurl=https://ghe-scaletesting.sgdev.org",
	//		"--github.client-id=f08ef1de0497c6de281e",
	//		"--oauth.token=foobar")
	//
	//	lines, err := command.Run().Lines()
	//	if err != nil {
	//		log.Fatal(err)
	//	}
	//}
}
