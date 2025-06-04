import { describe } from '../core/index.mts';
import {
	assertAsyncMatchResult,
	assertMatcherToString,
} from '../test-utils/assertMatcher.mts';
import { sleep } from '../utils/sleep.mts';
import { asyncContainsItem } from './asyncContainsItem.mts';
import { equals } from './equals.mts';

describe('asyncContainsItem', {
	'stringifies to code'() {
		assertMatcherToString(asyncContainsItem(2), 'asyncContainsItem(equals(2))');
	},

	async 'checks async iterables'() {
		async function* generator() {
			yield 1;
			await sleep(20);
			yield 2;
		}
		await assertAsyncMatchResult(generator(), asyncContainsItem(2), 'pass');
		await assertAsyncMatchResult(generator(), asyncContainsItem(3), 'fail');
	},

	async 'uses a sub-matcher'() {
		async function* generator() {
			yield 1;
			yield 2;
		}
		await assertAsyncMatchResult(
			generator(),
			asyncContainsItem(equals(2)),
			'pass',
		);
	},

	async 'rejects other types'() {
		await assertAsyncMatchResult(7, asyncContainsItem(2), 'error');
		await assertAsyncMatchResult(Symbol(), asyncContainsItem(2), 'error');
	},
});
