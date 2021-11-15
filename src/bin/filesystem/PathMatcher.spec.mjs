import PathMatcher from './PathMatcher.mjs';

describe('PathMatcher', {
	'identifies exact matches for simple patterns'() {
		const matcher = new PathMatcher('foo');

		expect(matcher.match('foo'), isTrue());
		expect(matcher.match('foo/'), isTrue());
		expect(matcher.match('FOO'), isTrue());
		expect(matcher.match('bar'), isFalse());
		expect(matcher.match('foo/bar'), isFalse());
		expect(matcher.match('bar/foo'), isFalse());
	},

	'identifies partial matches for simple patterns'() {
		const matcher = new PathMatcher('foo');

		expect(matcher.partialMatch('foo'), isTrue());
		expect(matcher.partialMatch('foo/'), isTrue());
		expect(matcher.partialMatch('FOO'), isTrue());
		expect(matcher.partialMatch('bar'), isFalse());
		expect(matcher.partialMatch('foo/bar'), isFalse());
		expect(matcher.partialMatch('bar/foo'), isFalse());
	},

	'identifies exact matches for multi directory patterns'() {
		const matcher = new PathMatcher('foo/bar');

		expect(matcher.match('foo/bar'), isTrue());
		expect(matcher.match('foo/bar/'), isTrue());
		expect(matcher.match('bar'), isFalse());
		expect(matcher.match('foo'), isFalse());
		expect(matcher.match('foo/'), isFalse());
		expect(matcher.match('bar/foo'), isFalse());
		expect(matcher.match('baz/foo/bar'), isFalse());
		expect(matcher.match('foo/bar/baz'), isFalse());
	},

	'identifies partial matches for multi directory patterns'() {
		const matcher = new PathMatcher('foo/bar');

		expect(matcher.partialMatch('foo/bar'), isTrue());
		expect(matcher.partialMatch('foo/bar/'), isTrue());
		expect(matcher.partialMatch('bar'), isFalse());
		expect(matcher.partialMatch('foo'), isTrue());
		expect(matcher.partialMatch('foo/'), isTrue());
		expect(matcher.partialMatch('bar/foo'), isFalse());
		expect(matcher.partialMatch('baz/foo/bar'), isFalse());
		expect(matcher.partialMatch('foo/bar/baz'), isFalse());
	},

	'allows wildcard patterns for a single component'() {
		const matcher = new PathMatcher('foo/*/bar');

		expect(matcher.match('foo'), isFalse());
		expect(matcher.partialMatch('foo'), isTrue());
		expect(matcher.match('foo/bar'), isFalse());
		expect(matcher.partialMatch('foo/bar'), isTrue());
		expect(matcher.match('foo/woo'), isFalse());
		expect(matcher.partialMatch('foo/woo'), isTrue());
		expect(matcher.match('foo/woo/bar'), isTrue());
		expect(matcher.partialMatch('foo/woo/bar'), isTrue());
		expect(matcher.match('foo/woo/wee/bar'), isFalse());
		expect(matcher.partialMatch('foo/woo/wee/bar'), isFalse());
	},

	'allows wildcard patterns for multiple components'() {
		const matcher = new PathMatcher('foo/**/bar');

		expect(matcher.match('foo'), isFalse());
		expect(matcher.partialMatch('foo'), isTrue());
		expect(matcher.match('foo/bar'), isTrue());
		expect(matcher.partialMatch('foo/bar'), isTrue());
		expect(matcher.match('foo/woo'), isFalse());
		expect(matcher.partialMatch('foo/woo'), isTrue());
		expect(matcher.match('foo/woo/bar'), isTrue());
		expect(matcher.partialMatch('foo/woo/bar'), isTrue());
		expect(matcher.match('foo/woo/wee/bar'), isTrue());
		expect(matcher.partialMatch('foo/woo/wee/bar'), isTrue());
	},

	'escapes special charaters'() {
		const matcher = new PathMatcher('a^b$c(d)e[f]g');

		expect(matcher.match('a^b$c(d)e[f]g'), isTrue());
		expect(matcher.partialMatch('a^b$c(d)e[f]g'), isTrue());
		expect(matcher.match('abcdefg'), isFalse());
		expect(matcher.partialMatch('abcdefg'), isFalse());
	},

	'checks partial wildcard components'() {
		const matcher = new PathMatcher('*.txt');

		expect(matcher.match('woo.txt'), isTrue());
		expect(matcher.match('woo.jpg'), isFalse());
		expect(matcher.partialMatch('woo.txt'), isTrue());
		expect(matcher.partialMatch('woo.jpg'), isFalse());
	},

	'checks for any matching case when branches are provided'() {
		const matcher = new PathMatcher('{a|b}cd{e|f}');

		expect(matcher.match('acde'), isTrue());
		expect(matcher.match('acdf'), isTrue());
		expect(matcher.match('bcde'), isTrue());
		expect(matcher.match('bcdf'), isTrue());
		expect(matcher.match('cd'), isFalse());
		expect(matcher.match('fcda'), isFalse());
	},

	'converts arrays into branches'() {
		const matcher = new PathMatcher(['abc', 'def']);

		expect(matcher.match('abc'), isTrue());
		expect(matcher.match('def'), isTrue());
		expect(matcher.match('ghi'), isFalse());
	},

	'rejects invalid patterns'() {
		expect(() => new PathMatcher('un{closed'), throws());
		expect(() => new PathMatcher('un}opened'), throws());
		expect(() => new PathMatcher('group{between/slashes}banned'), throws());
	},
});
