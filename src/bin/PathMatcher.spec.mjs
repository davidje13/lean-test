import PathMatcher from './PathMatcher.mjs';

describe('PathMatcher', {
	'identifies exact matches for simple patterns'() {
		const matcher = new PathMatcher('foo');

		expect(matcher.match('foo'), equals(true));
		expect(matcher.match('foo/'), equals(true));
		expect(matcher.match('FOO'), equals(true));
		expect(matcher.match('bar'), equals(false));
		expect(matcher.match('foo/bar'), equals(false));
		expect(matcher.match('bar/foo'), equals(false));
	},

	'identifies partial matches for simple patterns'() {
		const matcher = new PathMatcher('foo');

		expect(matcher.partialMatch('foo'), equals(true));
		expect(matcher.partialMatch('foo/'), equals(true));
		expect(matcher.partialMatch('FOO'), equals(true));
		expect(matcher.partialMatch('bar'), equals(false));
		expect(matcher.partialMatch('foo/bar'), equals(false));
		expect(matcher.partialMatch('bar/foo'), equals(false));
	},

	'identifies exact matches for multi directory patterns'() {
		const matcher = new PathMatcher('foo/bar');

		expect(matcher.match('foo/bar'), equals(true));
		expect(matcher.match('foo/bar/'), equals(true));
		expect(matcher.match('bar'), equals(false));
		expect(matcher.match('foo'), equals(false));
		expect(matcher.match('foo/'), equals(false));
		expect(matcher.match('bar/foo'), equals(false));
		expect(matcher.match('baz/foo/bar'), equals(false));
		expect(matcher.match('foo/bar/baz'), equals(false));
	},

	'identifies partial matches for multi directory patterns'() {
		const matcher = new PathMatcher('foo/bar');

		expect(matcher.partialMatch('foo/bar'), equals(true));
		expect(matcher.partialMatch('foo/bar/'), equals(true));
		expect(matcher.partialMatch('bar'), equals(false));
		expect(matcher.partialMatch('foo'), equals(true));
		expect(matcher.partialMatch('foo/'), equals(true));
		expect(matcher.partialMatch('bar/foo'), equals(false));
		expect(matcher.partialMatch('baz/foo/bar'), equals(false));
		expect(matcher.partialMatch('foo/bar/baz'), equals(false));
	},

	'allows wildcard patterns for a single component'() {
		const matcher = new PathMatcher('foo/*/bar');

		expect(matcher.match('foo'), equals(false));
		expect(matcher.partialMatch('foo'), equals(true));
		expect(matcher.match('foo/bar'), equals(false));
		expect(matcher.partialMatch('foo/bar'), equals(true));
		expect(matcher.match('foo/woo'), equals(false));
		expect(matcher.partialMatch('foo/woo'), equals(true));
		expect(matcher.match('foo/woo/bar'), equals(true));
		expect(matcher.partialMatch('foo/woo/bar'), equals(true));
		expect(matcher.match('foo/woo/wee/bar'), equals(false));
		expect(matcher.partialMatch('foo/woo/wee/bar'), equals(false));
	},

	'allows wildcard patterns for multiple components'() {
		const matcher = new PathMatcher('foo/**/bar');

		expect(matcher.match('foo'), equals(false));
		expect(matcher.partialMatch('foo'), equals(true));
		expect(matcher.match('foo/bar'), equals(true));
		expect(matcher.partialMatch('foo/bar'), equals(true));
		expect(matcher.match('foo/woo'), equals(false));
		expect(matcher.partialMatch('foo/woo'), equals(true));
		expect(matcher.match('foo/woo/bar'), equals(true));
		expect(matcher.partialMatch('foo/woo/bar'), equals(true));
		expect(matcher.match('foo/woo/wee/bar'), equals(true));
		expect(matcher.partialMatch('foo/woo/wee/bar'), equals(true));
	},

	'escapes special charaters'() {
		const matcher = new PathMatcher('a^b$c(d)e[f]g');

		expect(matcher.match('a^b$c(d)e[f]g'), equals(true));
		expect(matcher.partialMatch('a^b$c(d)e[f]g'), equals(true));
		expect(matcher.match('abcdefg'), equals(false));
		expect(matcher.partialMatch('abcdefg'), equals(false));
	},

	'checks partial wildcard components'() {
		const matcher = new PathMatcher('*.txt');

		expect(matcher.match('woo.txt'), equals(true));
		expect(matcher.match('woo.jpg'), equals(false));
		expect(matcher.partialMatch('woo.txt'), equals(true));
		expect(matcher.partialMatch('woo.jpg'), equals(false));
	},

	'checks for any matching case when branches are provided'() {
		const matcher = new PathMatcher('{a|b}cd{e|f}');

		expect(matcher.match('acde'), equals(true));
		expect(matcher.match('acdf'), equals(true));
		expect(matcher.match('bcde'), equals(true));
		expect(matcher.match('bcdf'), equals(true));
		expect(matcher.match('cd'), equals(false));
		expect(matcher.match('fcda'), equals(false));
	},

	'converts arrays into branches'() {
		const matcher = new PathMatcher(['abc', 'def']);

		expect(matcher.match('abc'), equals(true));
		expect(matcher.match('def'), equals(true));
		expect(matcher.match('ghi'), equals(false));
	},

	'rejects invalid patterns'() {
		expect(() => new PathMatcher('un{closed'), throws());
		expect(() => new PathMatcher('un}opened'), throws());
		expect(() => new PathMatcher('group{between/slashes}banned'), throws());
	},
});
