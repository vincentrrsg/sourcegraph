import {
    testDataRealMatchesByLineNumber,
    testDataRealMatchesByZoektRanking,
    testDataRealMultilineMatches,
} from './PerFileResultRankingTestHelpers'
import { ZoektRanking } from './ZoektRanking'

describe('ZoektRanking', () => {
    const ranking = new ZoektRanking(5)
    test('collapsedResults, single-line matches only', () => {
        expect(ranking.collapsedResults(testDataRealMatchesByLineNumber, 1).grouped).toMatchInlineSnapshot(`
            [
              {
                "endLine": 5,
                "matches": [
                  {
                    "endCharacter": 56,
                    "endLine": 0,
                    "startCharacter": 51,
                    "startLine": 0,
                  },
                  {
                    "endCharacter": 53,
                    "endLine": 2,
                    "startCharacter": 48,
                    "startLine": 2,
                  },
                  {
                    "endCharacter": 20,
                    "endLine": 3,
                    "startCharacter": 15,
                    "startLine": 3,
                  },
                  {
                    "endCharacter": 44,
                    "endLine": 3,
                    "startCharacter": 39,
                    "startLine": 3,
                  },
                ],
                "position": {
                  "character": 52,
                  "line": 1,
                },
                "startLine": 0,
              },
              {
                "endLine": 10,
                "matches": [
                  {
                    "endCharacter": 7,
                    "endLine": 8,
                    "startCharacter": 2,
                    "startLine": 8,
                  },
                ],
                "position": {
                  "character": 3,
                  "line": 9,
                },
                "startLine": 7,
              },
              {
                "endLine": 16,
                "matches": [
                  {
                    "endCharacter": 24,
                    "endLine": 14,
                    "startCharacter": 19,
                    "startLine": 14,
                  },
                ],
                "position": {
                  "character": 20,
                  "line": 15,
                },
                "startLine": 13,
              },
              {
                "endLine": 22,
                "matches": [
                  {
                    "endCharacter": 16,
                    "endLine": 20,
                    "startCharacter": 11,
                    "startLine": 20,
                  },
                ],
                "position": {
                  "character": 12,
                  "line": 21,
                },
                "startLine": 19,
              },
              {
                "endLine": 37,
                "matches": [
                  {
                    "endCharacter": 13,
                    "endLine": 24,
                    "startCharacter": 8,
                    "startLine": 24,
                  },
                  {
                    "endCharacter": 24,
                    "endLine": 24,
                    "startCharacter": 19,
                    "startLine": 24,
                  },
                  {
                    "endCharacter": 58,
                    "endLine": 27,
                    "startCharacter": 53,
                    "startLine": 27,
                  },
                  {
                    "endCharacter": 8,
                    "endLine": 28,
                    "startCharacter": 3,
                    "startLine": 28,
                  },
                  {
                    "endCharacter": 18,
                    "endLine": 29,
                    "startCharacter": 13,
                    "startLine": 29,
                  },
                  {
                    "endCharacter": 7,
                    "endLine": 30,
                    "startCharacter": 2,
                    "startLine": 30,
                  },
                  {
                    "endCharacter": 13,
                    "endLine": 31,
                    "startCharacter": 8,
                    "startLine": 31,
                  },
                  {
                    "endCharacter": 36,
                    "endLine": 31,
                    "startCharacter": 31,
                    "startLine": 31,
                  },
                  {
                    "endCharacter": 37,
                    "endLine": 32,
                    "startCharacter": 11,
                    "startLine": 32,
                  },
                  {
                    "endCharacter": 28,
                    "endLine": 33,
                    "startCharacter": 23,
                    "startLine": 33,
                  },
                  {
                    "endCharacter": 35,
                    "endLine": 33,
                    "startCharacter": 30,
                    "startLine": 33,
                  },
                  {
                    "endCharacter": 21,
                    "endLine": 34,
                    "startCharacter": 16,
                    "startLine": 34,
                  },
                  {
                    "endCharacter": 7,
                    "endLine": 35,
                    "startCharacter": 2,
                    "startLine": 35,
                  },
                ],
                "position": {
                  "character": 9,
                  "line": 25,
                },
                "startLine": 23,
              },
            ]
        `)
    })

    test('collapsed results, single-line matches only, matches in order of zoekt relevance ranking', () => {
        expect(ranking.collapsedResults(testDataRealMatchesByZoektRanking, 1).grouped).toMatchInlineSnapshot(`
            [
              {
                "endLine": 170,
                "matches": [
                  {
                    "endCharacter": 15,
                    "endLine": 160,
                    "startCharacter": 10,
                    "startLine": 160,
                  },
                  {
                    "endCharacter": 45,
                    "endLine": 160,
                    "startCharacter": 40,
                    "startLine": 160,
                  },
                  {
                    "endCharacter": 24,
                    "endLine": 161,
                    "startCharacter": 19,
                    "startLine": 161,
                  },
                  {
                    "endCharacter": 17,
                    "endLine": 162,
                    "startCharacter": 12,
                    "startLine": 162,
                  },
                  {
                    "endCharacter": 12,
                    "endLine": 163,
                    "startCharacter": 7,
                    "startLine": 163,
                  },
                  {
                    "endCharacter": 12,
                    "endLine": 164,
                    "startCharacter": 7,
                    "startLine": 164,
                  },
                  {
                    "endCharacter": 21,
                    "endLine": 167,
                    "startCharacter": 16,
                    "startLine": 167,
                  },
                  {
                    "endCharacter": 28,
                    "endLine": 167,
                    "startCharacter": 23,
                    "startLine": 167,
                  },
                  {
                    "endCharacter": 21,
                    "endLine": 168,
                    "startCharacter": 16,
                    "startLine": 168,
                  },
                ],
                "position": {
                  "character": 11,
                  "line": 161,
                },
                "startLine": 159,
              },
              {
                "endLine": 29,
                "matches": [
                  {
                    "endCharacter": 13,
                    "endLine": 24,
                    "startCharacter": 8,
                    "startLine": 24,
                  },
                  {
                    "endCharacter": 24,
                    "endLine": 24,
                    "startCharacter": 19,
                    "startLine": 24,
                  },
                  {
                    "endCharacter": 58,
                    "endLine": 27,
                    "startCharacter": 53,
                    "startLine": 27,
                  },
                ],
                "position": {
                  "character": 9,
                  "line": 25,
                },
                "startLine": 23,
              },
              {
                "endLine": 177,
                "matches": [
                  {
                    "endCharacter": 21,
                    "endLine": 171,
                    "startCharacter": 16,
                    "startLine": 171,
                  },
                  {
                    "endCharacter": 35,
                    "endLine": 171,
                    "startCharacter": 30,
                    "startLine": 171,
                  },
                  {
                    "endCharacter": 46,
                    "endLine": 171,
                    "startCharacter": 41,
                    "startLine": 171,
                  },
                  {
                    "endCharacter": 15,
                    "endLine": 172,
                    "startCharacter": 10,
                    "startLine": 172,
                  },
                  {
                    "endCharacter": 21,
                    "endLine": 175,
                    "startCharacter": 16,
                    "startLine": 175,
                  },
                  {
                    "endCharacter": 37,
                    "endLine": 175,
                    "startCharacter": 32,
                    "startLine": 175,
                  },
                ],
                "position": {
                  "character": 17,
                  "line": 172,
                },
                "startLine": 170,
              },
              {
                "endLine": 5,
                "matches": [
                  {
                    "endCharacter": 56,
                    "endLine": 0,
                    "startCharacter": 51,
                    "startLine": 0,
                  },
                  {
                    "endCharacter": 53,
                    "endLine": 2,
                    "startCharacter": 48,
                    "startLine": 2,
                  },
                  {
                    "endCharacter": 20,
                    "endLine": 3,
                    "startCharacter": 15,
                    "startLine": 3,
                  },
                  {
                    "endCharacter": 44,
                    "endLine": 3,
                    "startCharacter": 39,
                    "startLine": 3,
                  },
                ],
                "position": {
                  "character": 52,
                  "line": 1,
                },
                "startLine": 0,
              },
              {
                "endLine": 16,
                "matches": [
                  {
                    "endCharacter": 24,
                    "endLine": 14,
                    "startCharacter": 19,
                    "startLine": 14,
                  },
                ],
                "position": {
                  "character": 20,
                  "line": 15,
                },
                "startLine": 13,
              },
            ]
        `)
    })

    test('collapsed results, multiline matches only', () => {
        expect(ranking.collapsedResults(testDataRealMultilineMatches, 1).grouped).toMatchInlineSnapshot(`
            [
              {
                "endLine": 54,
                "matches": [
                  {
                    "endCharacter": 2,
                    "endLine": 52,
                    "startCharacter": 1,
                    "startLine": 50,
                  },
                ],
                "position": {
                  "character": 2,
                  "line": 51,
                },
                "startLine": 49,
              },
              {
                "endLine": 74,
                "matches": [
                  {
                    "endCharacter": 1,
                    "endLine": 65,
                    "startCharacter": 19,
                    "startLine": 60,
                  },
                  {
                    "endCharacter": 1,
                    "endLine": 72,
                    "startCharacter": 23,
                    "startLine": 67,
                  },
                ],
                "position": {
                  "character": 20,
                  "line": 61,
                },
                "startLine": 59,
              },
              {
                "endLine": 81,
                "matches": [
                  {
                    "endCharacter": 2,
                    "endLine": 79,
                    "startCharacter": 1,
                    "startLine": 77,
                  },
                ],
                "position": {
                  "character": 2,
                  "line": 78,
                },
                "startLine": 76,
              },
              {
                "endLine": 91,
                "matches": [
                  {
                    "endCharacter": 2,
                    "endLine": 89,
                    "startCharacter": 1,
                    "startLine": 87,
                  },
                ],
                "position": {
                  "character": 2,
                  "line": 88,
                },
                "startLine": 86,
              },
              {
                "endLine": 105,
                "matches": [
                  {
                    "endCharacter": 3,
                    "endLine": 103,
                    "startCharacter": 2,
                    "startLine": 101,
                  },
                ],
                "position": {
                  "character": 3,
                  "line": 102,
                },
                "startLine": 100,
              },
            ]
        `)
    })

    test('expandedResults, single-line matches only', () => {
        // reverse the data to demonstrate that zoekt-ranking does not sort the
        // results by line number, it preserves the original sort from the
        // server.
        const dataReversed = [...testDataRealMatchesByLineNumber].reverse().slice(0, 6)
        expect(ranking.expandedResults(dataReversed, 1).grouped).toMatchInlineSnapshot(`
            [
              {
                "endLine": 177,
                "matches": [
                  {
                    "endCharacter": 12,
                    "endLine": 164,
                    "startCharacter": 7,
                    "startLine": 164,
                  },
                  {
                    "endCharacter": 21,
                    "endLine": 167,
                    "startCharacter": 16,
                    "startLine": 167,
                  },
                  {
                    "endCharacter": 28,
                    "endLine": 167,
                    "startCharacter": 23,
                    "startLine": 167,
                  },
                  {
                    "endCharacter": 21,
                    "endLine": 168,
                    "startCharacter": 16,
                    "startLine": 168,
                  },
                  {
                    "endCharacter": 21,
                    "endLine": 171,
                    "startCharacter": 16,
                    "startLine": 171,
                  },
                  {
                    "endCharacter": 35,
                    "endLine": 171,
                    "startCharacter": 30,
                    "startLine": 171,
                  },
                  {
                    "endCharacter": 46,
                    "endLine": 171,
                    "startCharacter": 41,
                    "startLine": 171,
                  },
                  {
                    "endCharacter": 15,
                    "endLine": 172,
                    "startCharacter": 10,
                    "startLine": 172,
                  },
                  {
                    "endCharacter": 21,
                    "endLine": 175,
                    "startCharacter": 16,
                    "startLine": 175,
                  },
                  {
                    "endCharacter": 37,
                    "endLine": 175,
                    "startCharacter": 32,
                    "startLine": 175,
                  },
                ],
                "position": {
                  "character": 8,
                  "line": 165,
                },
                "startLine": 163,
              },
            ]
        `)
    })

    test('expanded matches, multiline matches only', () => {
        const multilineDataReversed = [...testDataRealMultilineMatches].reverse().slice(0, 6)
        expect(ranking.expandedResults(multilineDataReversed, 1).grouped).toMatchInlineSnapshot(`
            [
              {
                "endLine": 129,
                "matches": [
                  {
                    "endCharacter": 2,
                    "endLine": 118,
                    "startCharacter": 1,
                    "startLine": 116,
                  },
                  {
                    "endCharacter": 3,
                    "endLine": 123,
                    "startCharacter": 2,
                    "startLine": 121,
                  },
                  {
                    "endCharacter": 3,
                    "endLine": 127,
                    "startCharacter": 2,
                    "startLine": 125,
                  },
                ],
                "position": {
                  "character": 2,
                  "line": 117,
                },
                "startLine": 115,
              },
              {
                "endLine": 105,
                "matches": [
                  {
                    "endCharacter": 3,
                    "endLine": 103,
                    "startCharacter": 2,
                    "startLine": 101,
                  },
                ],
                "position": {
                  "character": 3,
                  "line": 102,
                },
                "startLine": 100,
              },
              {
                "endLine": 91,
                "matches": [
                  {
                    "endCharacter": 2,
                    "endLine": 89,
                    "startCharacter": 1,
                    "startLine": 87,
                  },
                ],
                "position": {
                  "character": 2,
                  "line": 88,
                },
                "startLine": 86,
              },
              {
                "endLine": 81,
                "matches": [
                  {
                    "endCharacter": 2,
                    "endLine": 79,
                    "startCharacter": 1,
                    "startLine": 77,
                  },
                ],
                "position": {
                  "character": 2,
                  "line": 78,
                },
                "startLine": 76,
              },
            ]
        `)
    })
})
