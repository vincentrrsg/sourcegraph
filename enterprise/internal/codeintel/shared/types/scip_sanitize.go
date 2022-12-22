package types

import (
	"unicode/utf8"

	"github.com/sourcegraph/scip/bindings/go/scip"
)

// SanitizeDocument ensures that all strings in the given document are valid UTF-8.
// This is a requirement for successful protobuf encoding.
func SanitizeDocument(document *scip.Document) *scip.Document {
	document.Language = sanitizeString(document.Language)
	document.RelativePath = sanitizeString(document.RelativePath)
	document.Occurrences = SanitizeOccurrences(document.Occurrences)
	document.Symbols = SanitizeSymbols(document.Symbols)
	return document
}

// TODO - document
func SanitizeOccurrences(occurrences []*scip.Occurrence) []*scip.Occurrence {
	for i, occurrence := range occurrences {
		occurrences[i] = SanitizeOccurrence(occurrence)
	}

	return occurrences
}

// TODO - document
func SanitizeOccurrence(occurrence *scip.Occurrence) *scip.Occurrence {
	occurrence.Symbol = sanitizeString(occurrence.Symbol)
	occurrence.OverrideDocumentation = sanitizeStringSlice(occurrence.OverrideDocumentation)
	occurrence.Diagnostics = SanitizeDiagnostics(occurrence.Diagnostics)
	return occurrence
}

// TODO - document
func SanitizeDiagnostics(diagnostics []*scip.Diagnostic) []*scip.Diagnostic {
	for i, diagnostic := range diagnostics {
		diagnostics[i] = SanitizeDiagnostic(diagnostic)
	}

	return diagnostics
}

// TODO - document
func SanitizeDiagnostic(diagnostic *scip.Diagnostic) *scip.Diagnostic {
	diagnostic.Code = sanitizeString(diagnostic.Code)
	diagnostic.Message = sanitizeString(diagnostic.Message)
	diagnostic.Source = sanitizeString(diagnostic.Source)
	return diagnostic
}

// TODO - document
func SanitizeSymbols(symbols []*scip.SymbolInformation) []*scip.SymbolInformation {
	for i, symbol := range symbols {
		symbols[i] = SanitizeSymbol(symbol)
	}

	return symbols
}

// TODO - document
func SanitizeSymbol(symbol *scip.SymbolInformation) *scip.SymbolInformation {
	symbol.Symbol = sanitizeString(symbol.Symbol)
	symbol.Documentation = sanitizeStringSlice(symbol.Documentation)

	for _, relationship := range symbol.Relationships {
		relationship.Symbol = sanitizeString(relationship.Symbol)
	}

	return symbol
}

// TODO - document
func sanitizeStringSlice(ss []string) []string {
	for i, s := range ss {
		ss[i] = sanitizeString(s)
	}

	return ss
}

// TODO - document
func sanitizeString(s string) string {
	if utf8.ValidString(s) {
		return s
	}

	return string([]rune(s))
}
