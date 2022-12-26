import { createURLWithUTM } from './utm'

describe('toUTM', () => {
    it('adds all UTM markers', () =>
        expect(
            createURLWithUTM(new URL('https://example.com'), {
                utm_source: 'a',
                utm_campaign: 'b',
                utm_medium: 'c',
                utm_term: 'd',
                utm_content: 'e',
            })
        ).toEqual('https://example.com/?utm_source=a&utm_campaign=b&utm_medium=c&utm_term=d&utm_content=e'))

    it('encodes UTM values', () =>
        expect(
            createURLWithUTM(new URL('https://example.com/search'), {
                utm_source: 'something with a space and /',
            })
        ).toEqual('https://example.com/search?utm_source=something+with+a+space+and+%2F'))

    it('correctly handles existing query parameters and fragments', () =>
        expect(
            createURLWithUTM(new URL('https://example.com/search?foo=bar#baz=qux'), {
                utm_source: 'tadaa',
            })
        ).toEqual('https://example.com/search?foo=bar&utm_source=tadaa#baz=qux'))
})
