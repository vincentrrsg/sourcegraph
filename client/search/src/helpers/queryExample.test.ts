import { FilterType } from '@sourcegraph/shared/src/search/query/filters'

import { createQueryExampleFromString, updateQueryWithFilterAndExample } from './queryExample'

describe('example helpers', () => {
    describe('createExampleFromString', () => {
        it('parses examples without placeholder', () => {
            expect(createQueryExampleFromString('foo bar')).toMatchInlineSnapshot(`
                {
                  "tokens": [
                    {
                      "end": 7,
                      "start": 0,
                      "type": "text",
                      "value": "foo bar",
                    },
                  ],
                  "value": "foo bar",
                }
            `)
        })

        it('parses examples with placeholder', () => {
            expect(createQueryExampleFromString('{foo}')).toMatchInlineSnapshot(`
                {
                  "tokens": [
                    {
                      "end": 3,
                      "start": 0,
                      "type": "placeholder",
                      "value": "foo",
                    },
                  ],
                  "value": "foo",
                }
            `)
            expect(createQueryExampleFromString('({foo})')).toMatchInlineSnapshot(`
                {
                  "tokens": [
                    {
                      "end": 1,
                      "start": 0,
                      "type": "text",
                      "value": "(",
                    },
                    {
                      "end": 4,
                      "start": 1,
                      "type": "placeholder",
                      "value": "foo",
                    },
                    {
                      "end": 5,
                      "start": 4,
                      "type": "text",
                      "value": ")",
                    },
                  ],
                  "value": "(foo)",
                }
            `)
        })
    })

    describe('updateQueryWithFilterExample', () => {
        describe('repeatable filters', () => {
            it('appends placeholder filter and selects placeholder', () => {
                expect(
                    updateQueryWithFilterAndExample('foo', FilterType.after, createQueryExampleFromString('({test})'))
                ).toMatchInlineSnapshot(`
                    {
                      "filterRange": {
                        "end": 16,
                        "start": 4,
                      },
                      "placeholderRange": {
                        "end": 15,
                        "start": 11,
                      },
                      "query": "foo after:(test)",
                    }
                `)
            })

            it('appends filter with empty value', () => {
                expect(
                    updateQueryWithFilterAndExample('foo', FilterType.after, createQueryExampleFromString('({test})'), {
                        emptyValue: true,
                    })
                ).toMatchInlineSnapshot(`
                    {
                      "filterRange": {
                        "end": 10,
                        "start": 4,
                      },
                      "placeholderRange": {
                        "end": 10,
                        "start": 10,
                      },
                      "query": "foo after:",
                    }
                `)
            })

            it('appends negated filter', () => {
                expect(
                    updateQueryWithFilterAndExample('foo', FilterType.after, createQueryExampleFromString('({test})'), {
                        negate: true,
                    })
                ).toMatchInlineSnapshot(`
                    {
                      "filterRange": {
                        "end": 17,
                        "start": 4,
                      },
                      "placeholderRange": {
                        "end": 16,
                        "start": 12,
                      },
                      "query": "foo -after:(test)",
                    }
                `)
            })
        })

        describe('unique filters', () => {
            it('appends placeholder filter and selects placeholder', () => {
                expect(
                    updateQueryWithFilterAndExample('foo', FilterType.after, createQueryExampleFromString('({test})'), {
                        singular: true,
                    })
                ).toMatchInlineSnapshot(`
                    {
                      "filterRange": {
                        "end": 16,
                        "start": 4,
                      },
                      "placeholderRange": {
                        "end": 15,
                        "start": 11,
                      },
                      "query": "foo after:(test)",
                    }
                `)
            })

            it('selects value of existing placeholder', () => {
                expect(
                    updateQueryWithFilterAndExample(
                        'after:value foo',
                        FilterType.after,
                        createQueryExampleFromString('({test})'),
                        { singular: true }
                    )
                ).toMatchInlineSnapshot(`
                    {
                      "filterRange": {
                        "end": 11,
                        "start": 0,
                      },
                      "placeholderRange": {
                        "end": 11,
                        "start": 6,
                      },
                      "query": "after:value foo",
                    }
                `)
            })

            it('updates existing filter with empty value', () => {
                expect(
                    updateQueryWithFilterAndExample(
                        'after:value foo',
                        FilterType.after,
                        createQueryExampleFromString('({test})'),
                        { singular: true, emptyValue: true }
                    )
                ).toMatchInlineSnapshot(`
                    {
                      "filterRange": {
                        "end": 6,
                        "start": 0,
                      },
                      "placeholderRange": {
                        "end": 6,
                        "start": 6,
                      },
                      "query": "after: foo",
                    }
                `)
            })

            it('updates existing empty filter with empty value', () => {
                expect(
                    updateQueryWithFilterAndExample(
                        'after: foo',
                        FilterType.after,
                        createQueryExampleFromString('({test})'),
                        { singular: true, emptyValue: true }
                    )
                ).toMatchInlineSnapshot(`
                    {
                      "filterRange": {
                        "end": 6,
                        "start": 0,
                      },
                      "placeholderRange": {
                        "end": 6,
                        "start": 6,
                      },
                      "query": "after: foo",
                    }
                `)
            })

            it('selects value of existing negated filter', () => {
                expect(
                    updateQueryWithFilterAndExample(
                        '-after:value foo',
                        FilterType.after,
                        createQueryExampleFromString('({test})'),
                        { singular: true, negate: true }
                    )
                ).toMatchInlineSnapshot(`
                    {
                      "filterRange": {
                        "end": 12,
                        "start": 0,
                      },
                      "placeholderRange": {
                        "end": 12,
                        "start": 7,
                      },
                      "query": "-after:value foo",
                    }
                `)
            })

            it('updates existing negated filter with empty value', () => {
                expect(
                    updateQueryWithFilterAndExample(
                        '-after:value foo',
                        FilterType.after,
                        createQueryExampleFromString('({test})'),
                        { singular: true, negate: true, emptyValue: true }
                    )
                ).toMatchInlineSnapshot(`
                    {
                      "filterRange": {
                        "end": 7,
                        "start": 0,
                      },
                      "placeholderRange": {
                        "end": 7,
                        "start": 7,
                      },
                      "query": "-after: foo",
                    }
                `)
            })
        })
    })
})
