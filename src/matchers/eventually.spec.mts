import { describe, TestAssertionError } from '../core/index.mts';
import {
	assertAsyncMatchResult,
	assertMatcherToString,
} from '../test-utils/assertMatcher.mts';
import { equals } from './equals.mts';
import { eventually } from './eventually.mts';
import { hasProperty } from './hasProperty.mts';

describe('eventually', {
	'stringifies to code'() {
		assertMatcherToString(
			eventually(equals('foo')),
			'eventually(equals("foo"), {pollInterval: 50, timeout: 5000})',
		);
	},

	async 'polls until the condition is met'() {
		const x = { foo: 'bar' };
		setTimeout(() => {
			x.foo = 'baz';
		}, 100);
		const tm0 = Date.now();
		await assertAsyncMatchResult(
			x,
			eventually(hasProperty('foo', equals('baz'))),
			'pass',
		);
		const tm1 = Date.now();
		if (tm1 < tm0 + 90) {
			throw new TestAssertionError('eventually passed too quickly');
		}
		if (tm1 > tm0 + 1000) {
			throw new TestAssertionError('eventually took too long');
		}
	},

	async 'times out'() {
		const x = 'foo';
		const tm0 = Date.now();
		await assertAsyncMatchResult(
			x,
			eventually(equals('baz'), { timeout: 200 }),
			'fail',
			'"foo" != "baz" (timed out)',
		);
		const tm1 = Date.now();
		if (tm1 < tm0 + 190) {
			throw new TestAssertionError('eventually failed too quickly');
		}
		if (tm1 > tm0 + 1000) {
			throw new TestAssertionError('eventually took too long');
		}
	},
});
