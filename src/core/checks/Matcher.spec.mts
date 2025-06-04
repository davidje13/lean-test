import {
	assertAsyncMatchResult,
	assertMatcherToString,
	assertMatchResult,
} from '../../test-utils/assertMatcher.mts';
import { describe } from '../index.mts';
import { Matcher } from './Matcher.mts';

describe('overrideDescription', {
	'overrides the failure message on a comparison'() {
		const matcher = new Matcher<unknown, false>({
			code: () => 'code',
			check: (value) => ({ result: value ? 'pass' : 'fail', message: 'msg' }),
		});

		const describedMatcher = matcher.overrideDescription('my message');
		assertMatcherToString(describedMatcher, 'my message');
		assertMatchResult(true, describedMatcher, 'pass', 'matched');
		assertMatchResult(false, describedMatcher, 'fail', 'failed');
	},

	async 'wraps asynchronous matchers'() {
		const matcher = new Matcher<unknown, true>({
			code: () => 'code',
			check: (value) =>
				Promise.resolve({ result: value ? 'pass' : 'fail', message: 'msg' }),
		});

		const describedMatcher = matcher.overrideDescription('my message');
		assertMatcherToString(describedMatcher, 'my message');
		await assertAsyncMatchResult(true, describedMatcher, 'pass', 'matched');
		await assertAsyncMatchResult(false, describedMatcher, 'fail', 'failed');
	},
});
