package search

import (
	"archive/tar"
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/RoaringBitmap/roaring"
	zoektquery "github.com/google/zoekt/query"
	"github.com/opentracing/opentracing-go/ext"
	otlog "github.com/opentracing/opentracing-go/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/sourcegraph/log"

	"github.com/sourcegraph/sourcegraph/cmd/searcher/protocol"
	"github.com/sourcegraph/sourcegraph/internal/api"
	"github.com/sourcegraph/sourcegraph/internal/comby"
	"github.com/sourcegraph/sourcegraph/internal/lazyregexp"
	"github.com/sourcegraph/sourcegraph/internal/search"
	"github.com/sourcegraph/sourcegraph/internal/trace/ot"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

func toFileMatch(zipReader *zip.Reader, combyMatch *comby.FileMatch) (protocol.FileMatch, error) {
	file, err := zipReader.Open(combyMatch.URI)
	if err != nil {
		return protocol.FileMatch{}, err
	}
	defer file.Close()

	fileBuf, err := io.ReadAll(file)
	if err != nil {
		return protocol.FileMatch{}, err
	}

	// Convert comby matches to ranges
	ranges := make([]protocol.Range, 0, len(combyMatch.Matches))
	for _, r := range combyMatch.Matches {
		// trust, but verify
		if r.Range.Start.Offset > len(fileBuf) || r.Range.End.Offset > len(fileBuf) {
			return protocol.FileMatch{}, errors.New("comby match range does not fit in file")
		}

		ranges = append(ranges, protocol.Range{
			Start: protocol.Location{
				Offset: int32(r.Range.Start.Offset),
				// Comby returns 1-based line numbers and columns
				Line:   int32(r.Range.Start.Line) - 1,
				Column: int32(r.Range.Start.Column) - 1,
			},
			End: protocol.Location{
				Offset: int32(r.Range.End.Offset),
				Line:   int32(r.Range.End.Line) - 1,
				Column: int32(r.Range.End.Column) - 1,
			},
		})
	}

	chunks := chunkRanges(ranges, 0)
	chunkMatches := chunksToMatches(fileBuf, chunks)
	return protocol.FileMatch{
		Path:         combyMatch.URI,
		ChunkMatches: chunkMatches,
		LimitHit:     false,
	}, nil
}

func combyChunkMatchesToFileMatch(combyMatch *comby.FileMatchWithChunks) protocol.FileMatch {
	chunkMatches := make([]protocol.ChunkMatch, 0, len(combyMatch.ChunkMatches))
	for _, cm := range combyMatch.ChunkMatches {
		ranges := make([]protocol.Range, 0, len(cm.Ranges))
		for _, r := range cm.Ranges {
			ranges = append(ranges, protocol.Range{
				Start: protocol.Location{
					Offset: int32(r.Start.Offset),
					// comby returns 1-based line numbers and columns
					Line:   int32(r.Start.Line) - 1,
					Column: int32(r.Start.Column) - 1,
				},
				End: protocol.Location{
					Offset: int32(r.End.Offset),
					Line:   int32(r.End.Line) - 1,
					Column: int32(r.End.Column) - 1,
				},
			})
		}

		chunkMatches = append(chunkMatches, protocol.ChunkMatch{
			Content: cm.Content,
			ContentStart: protocol.Location{
				Offset: int32(cm.Start.Offset),
				Line:   int32(cm.Start.Line) - 1,
				Column: int32(cm.Start.Column) - 1,
			},
			Ranges: ranges,
		})
	}
	return protocol.FileMatch{
		Path:         combyMatch.URI,
		ChunkMatches: chunkMatches,
		LimitHit:     false,
	}
}

// rangeChunk represents a set of adjacent ranges
type rangeChunk struct {
	// cover is the smallest range that completely contains every range in
	// `ranges`. More precisely, cover.Start is the minimum range.Start in all
	// `ranges` and cover.End is the maximum range.End in all `ranges`.
	cover  protocol.Range
	ranges []protocol.Range
}

// chunkRanges groups a set of ranges into chunks of adjacent ranges.
//
// `interChunkLines` is the minimum number of lines allowed between chunks. If
// two chunks would have fewer than `interChunkLines` lines between them, they
// are instead merged into a single chunk. For example, calling `chunkRanges`
// with `interChunkLines == 0` means ranges on two adjacent lines would be
// returned as two separate chunks.
//
// This function guarantees that the chunks returned are ordered by line number,
// have no overlapping lines, and the line ranges covered are spaced apart by
// a minimum of `interChunkLines`. More precisely, for any return value `rangeChunks`:
// rangeChunks[i].cover.End.Line + interChunkLines < rangeChunks[i+1].cover.Start.Line
func chunkRanges(ranges []protocol.Range, interChunkLines int) []rangeChunk {
	// Sort by range start
	sort.Slice(ranges, func(i, j int) bool {
		return ranges[i].Start.Offset < ranges[j].Start.Offset
	})

	var chunks []rangeChunk
	for i, rr := range ranges {
		if i == 0 {
			// First iteration, there are no chunks, so create a new one
			chunks = append(chunks, rangeChunk{
				cover:  rr,
				ranges: []protocol.Range{rr},
			})
			continue
		}

		lastChunk := &chunks[len(chunks)-1] // pointer for mutability
		if int(lastChunk.cover.End.Line)+interChunkLines >= int(rr.Start.Line) {
			// The current range overlaps with the current chunk, so merge them
			lastChunk.ranges = append(lastChunk.ranges, rr)

			// Expand the chunk coverRange if needed
			if rr.End.Offset > lastChunk.cover.End.Offset {
				lastChunk.cover.End = rr.End
			}
		} else {
			// No overlap, so create a new chunk
			chunks = append(chunks, rangeChunk{
				cover:  rr,
				ranges: []protocol.Range{rr},
			})
		}
	}
	return chunks
}

func chunksToMatches(buf []byte, chunks []rangeChunk) []protocol.ChunkMatch {
	chunkMatches := make([]protocol.ChunkMatch, 0, len(chunks))
	for _, chunk := range chunks {
		firstLineStart := int32(0)
		if off := bytes.LastIndexByte(buf[:chunk.cover.Start.Offset], '\n'); off >= 0 {
			firstLineStart = int32(off) + 1
		}

		lastLineEnd := int32(len(buf))
		if off := bytes.IndexByte(buf[chunk.cover.End.Offset:], '\n'); off >= 0 {
			lastLineEnd = chunk.cover.End.Offset + int32(off)
		}

		chunkMatches = append(chunkMatches, protocol.ChunkMatch{
			Content: string(buf[firstLineStart:lastLineEnd]),
			ContentStart: protocol.Location{
				Offset: firstLineStart,
				Line:   chunk.cover.Start.Line,
				Column: 0,
			},
			Ranges: chunk.ranges,
		})
	}
	return chunkMatches
}

var isValidMatcher = lazyregexp.New(`\.(s|sh|bib|c|cs|css|dart|clj|elm|erl|ex|f|fsx|go|html|hs|java|js|json|jl|kt|tex|lisp|nim|md|ml|org|pas|php|py|re|rb|rs|rst|scala|sql|swift|tex|txt|ts)$`)

func extensionToMatcher(extension string) string {
	if isValidMatcher.MatchString(extension) {
		return extension
	}
	return ".generic"
}

// lookupMatcher looks up a key for specifying -matcher in comby. Comby accepts
// a representative file extension to set a language, so this lookup does not
// need to consider all possible file extensions for a language. There is a generic
// fallback language, so this lookup does not need to be exhaustive either.
func lookupMatcher(language string) string {
	switch strings.ToLower(language) {
	case "assembly", "asm":
		return ".s"
	case "bash":
		return ".sh"
	case "c":
		return ".c"
	case "c#, csharp":
		return ".cs"
	case "css":
		return ".css"
	case "dart":
		return ".dart"
	case "clojure":
		return ".clj"
	case "elm":
		return ".elm"
	case "erlang":
		return ".erl"
	case "elixir":
		return ".ex"
	case "fortran":
		return ".f"
	case "f#", "fsharp":
		return ".fsx"
	case "go":
		return ".go"
	case "html":
		return ".html"
	case "haskell":
		return ".hs"
	case "java":
		return ".java"
	case "javascript":
		return ".js"
	case "json":
		return ".json"
	case "julia":
		return ".jl"
	case "kotlin":
		return ".kt"
	case "laTeX":
		return ".tex"
	case "lisp":
		return ".lisp"
	case "nim":
		return ".nim"
	case "ocaml":
		return ".ml"
	case "pascal":
		return ".pas"
	case "php":
		return ".php"
	case "python":
		return ".py"
	case "reason":
		return ".re"
	case "ruby":
		return ".rb"
	case "rust":
		return ".rs"
	case "scala":
		return ".scala"
	case "sql":
		return ".sql"
	case "swift":
		return ".swift"
	case "text":
		return ".txt"
	case "typescript", "ts":
		return ".ts"
	case "xml":
		return ".xml"
	}
	return ".generic"
}

func structuralSearchWithZoekt(ctx context.Context, logger log.Logger, p *protocol.Request, sender matchSender) (err error) {
	patternInfo := &search.TextPatternInfo{
		Pattern:                      p.Pattern,
		IsNegated:                    p.IsNegated,
		IsRegExp:                     p.IsRegExp,
		IsStructuralPat:              p.IsStructuralPat,
		CombyRule:                    p.CombyRule,
		IsWordMatch:                  p.IsWordMatch,
		IsCaseSensitive:              p.IsCaseSensitive,
		FileMatchLimit:               int32(p.Limit),
		IncludePatterns:              p.IncludePatterns,
		ExcludePattern:               p.ExcludePattern,
		PathPatternsAreCaseSensitive: p.PathPatternsAreCaseSensitive,
		PatternMatchesContent:        p.PatternMatchesContent,
		PatternMatchesPath:           p.PatternMatchesPath,
		Languages:                    p.Languages,
	}

	if p.Branch == "" {
		p.Branch = "HEAD"
	}
	branchRepos := []zoektquery.BranchRepos{{Branch: p.Branch, Repos: roaring.BitmapOf(uint32(p.RepoID))}}
	err = zoektSearch(ctx, logger, patternInfo, branchRepos, time.Since, p.IndexerEndpoints, nil, p.Repo, sender)
	if err != nil {
		return err
	}

	return nil
}

// filteredStructuralSearch filters the list of files with a regex search before passing the zip to comby
func filteredStructuralSearch(ctx context.Context, zipPath string, zf *zipFile, p *protocol.PatternInfo, repo api.RepoName, sender matchSender) error {
	// Make a copy of the pattern info to modify it to work for a regex search
	rp := *p
	rp.Pattern = comby.StructuralPatToRegexpQuery(p.Pattern, false)
	rp.IsStructuralPat = false
	rp.IsRegExp = true
	rg, err := compile(&rp)
	if err != nil {
		return err
	}

	fileMatches, _, err := regexSearchBatch(ctx, rg, zf, p.Limit, true, false, false)
	if err != nil {
		return err
	}
	if len(fileMatches) == 0 {
		return nil
	}

	matchedPaths := make([]string, 0, len(fileMatches))
	for _, fm := range fileMatches {
		matchedPaths = append(matchedPaths, fm.Path)
	}

	var extensionHint string
	if len(matchedPaths) > 0 {
		extensionHint = filepath.Ext(matchedPaths[0])
	}

	return structuralSearch(ctx, comby.ZipPath(zipPath), subset(matchedPaths), extensionHint, p.Pattern, p.CombyRule, p.Languages, repo, sender)
}

// toMatcher returns the matcher that parameterizes structural search. It
// derives either from an explicit language, or an inferred extension hint.
func toMatcher(languages []string, extensionHint string) string {
	if len(languages) > 0 {
		// Pick the first language, there is no support for applying
		// multiple language matchers in a single search query.
		matcher := lookupMatcher(languages[0])
		metricRequestTotalStructuralSearch.WithLabelValues(matcher).Inc()
		return matcher
	}

	if extensionHint != "" {
		extension := extensionToMatcher(extensionHint)
		metricRequestTotalStructuralSearch.WithLabelValues("inferred:" + extension).Inc()
		return extension
	}
	metricRequestTotalStructuralSearch.WithLabelValues("inferred:.generic").Inc()
	return ".generic"
}

// A variant type that represents whether to search all files in a Zip file
// (type universalSet), or just a subset (type Subset).
type filePatterns interface {
	Value()
}

func (universalSet) Value() {}
func (subset) Value()       {}

type universalSet struct{}
type subset []string

var all universalSet = struct{}{}

func structuralSearch(ctx context.Context, inputType comby.Input, paths filePatterns, extensionHint, pattern, rule string, languages []string, repo api.RepoName, sender matchSender) (err error) {
	span, ctx := ot.StartSpanFromContext(ctx, "StructuralSearch")
	span.SetTag("repo", repo)
	defer func() {
		if err != nil {
			ext.Error.Set(span, true)
			span.SetTag("err", err.Error())
		}
		span.Finish()
	}()

	// Cap the number of forked processes to limit the size of zip contents being mapped to memory. Resolving #7133 could help to lift this restriction.
	numWorkers := 4

	matcher := toMatcher(languages, extensionHint)

	var filePatterns []string
	if v, ok := paths.(subset); ok {
		filePatterns = []string(v)
	}
	span.LogFields(otlog.Int("paths", len(filePatterns)))

	args := comby.Args{
		Input:         inputType,
		Matcher:       matcher,
		MatchTemplate: pattern,
		ResultKind:    comby.MatchOnly,
		FilePatterns:  filePatterns,
		Rule:          rule,
		NumWorkers:    numWorkers,
	}

	switch combyInput := inputType.(type) {
	case comby.Tar:
		return runCombyWithStreaming(ctx, args, combyInput, sender)
	case comby.ZipPath:
		return runCombyWithCollection(ctx, args, combyInput, sender)
	}

	return errors.New("comby input must be either -tar or -zip for structural search")
}

// runCombyWithStreaming runs comby with the flags `-tar` and `-chunk-matches 0`. `-chunk-matches 0` instructs comby to return
// chunks as part of matches that it finds. Data is streamed into stdin from the channel on tarInput and out from stdout
// to the result stream.
func runCombyWithStreaming(ctx context.Context, args comby.Args, tarInput comby.Tar, sender matchSender) (err error) {
	cmd, stdin, stdout, err := comby.SetupCmdWithPipes(ctx, args)
	if err != nil {
		return err
	}

	wg := sync.WaitGroup{}
	defer wg.Wait()

	wg.Add(1)
	go func() {
		defer wg.Done()
		defer stdin.Close()

		tw := tar.NewWriter(stdin)
		defer tw.Close()
		for tb := range tarInput.TarInputEventC {
			if err := tw.WriteHeader(&tb.Header); err != nil {
				log.NamedError(fmt.Sprintf("failed to write tar header for file %s", tb.Header.Name), err)
				continue
			}
			if _, err := tw.Write(tb.Content); err != nil {
				log.NamedError(fmt.Sprintf("failed to write file content to tar format for file %s", tb.Header.Name), err)
				continue
			}
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		defer stdout.Close()

		scanner := bufio.NewScanner(stdout)
		// increase the scanner buffer size for potentially long lines
		scanner.Buffer(make([]byte, 100), 10*bufio.MaxScanTokenSize)

		for scanner.Scan() {
			b := scanner.Bytes()
			if err := scanner.Err(); err != nil {
				// warn on scanner errors and skip
				log.NamedError("comby error: skipping scanner error line", err)
				break
			}
			if r := comby.ToCombyFileMatchWithChunks(b); r != nil {
				sender.Send(combyChunkMatchesToFileMatch(r.(*comby.FileMatchWithChunks)))
			}
		}
	}()

	return comby.StartAndWaitForCompletion(cmd)
}

// runCombyWithCollection runs comby with the flag `-zip`. It collects all matches that comby finds in the zip file, then
// attempts to convert each of those to a protocol.FileMatch, sending it to the result stream if successful.
func runCombyWithCollection(ctx context.Context, args comby.Args, zipPath comby.ZipPath, sender matchSender) (err error) {
	combyMatches, err := comby.Matches(ctx, args)
	if err != nil {
		return err
	}

	zipReader, err := zip.OpenReader(string(zipPath))
	if err != nil {
		return err
	}
	defer zipReader.Close()

	for _, combyMatch := range combyMatches {
		fm, err := toFileMatch(&zipReader.Reader, combyMatch)
		if err != nil {
			log.NamedError("error converting comby match to FileMatch, skipping", err)
			continue
		}
		sender.Send(fm)
	}

	return nil
}

var metricRequestTotalStructuralSearch = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "searcher_service_request_total_structural_search",
	Help: "Number of returned structural search requests.",
}, []string{"language"})
