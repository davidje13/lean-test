import { describe, Matcher } from '../core/index.mts';
import {
	assertAsyncMatchResult,
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isSameInstance } from './isSameInstance.mts';
import { not } from './not.mts';

const ASYNC_PASS = new Matcher<unknown, true>({
	code: () => '',
	check: () => Promise.resolve({ result: 'pass', message: 'msg' }),
});
const ASYNC_FAIL = new Matcher<unknown, true>({
	code: () => '',
	check: () => Promise.resolve({ result: 'fail', message: 'msg' }),
});

describe('not', {
	'stringifies to code'() {
		assertMatcherToString(not(isSameInstance(1)), 'not(isSameInstance(1))');
	},

	'inverts success/failure'() {
		assertMatchResult(
			2,
			not(isSameInstance(2)),
			'fail',
			'2 is the same instance',
		);
		assertMatchResult(3, not(isSameInstance(2)), 'pass', '3 != 2');
	},

	async 'wraps asynchronous matchers'() {
		await assertAsyncMatchResult(0, not(ASYNC_PASS), 'fail', 'msg');
		await assertAsyncMatchResult(0, not(ASYNC_FAIL), 'pass', 'msg');
	},
});
