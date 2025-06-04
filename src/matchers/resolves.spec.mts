import { describe } from '../core/index.mts';
import {
	assertAsyncMatchResult,
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { equals } from './equals.mts';
import { resolves } from './resolves.mts';

describe('resolves', {
	'stringifies to code'() {
		assertMatcherToString(resolves(), 'resolves(any())');
		assertMatcherToString(resolves(1), 'resolves(equals(1))');
	},

	async 'resolves a promise'() {
		await assertAsyncMatchResult(Promise.resolve(), resolves(), 'pass');
		await assertAsyncMatchResult(Promise.reject(), resolves(), 'fail');
	},

	async 'optionally checks the value'() {
		await assertAsyncMatchResult(Promise.resolve(1), resolves(1), 'pass');
		await assertAsyncMatchResult(Promise.resolve(2), resolves(1), 'fail');
		await assertAsyncMatchResult(Promise.reject(), resolves(1), 'fail');
	},

	'resolves a function synchronously'() {
		assertMatchResult(() => 1, resolves(), 'pass');
		assertMatchResult(() => 1, resolves(1), 'pass');
		assertMatchResult(() => 2, resolves(1), 'fail');

		assertMatchResult(
			() => {
				throw new Error();
			},
			resolves(),
			'fail',
		);

		assertMatchResult(
			() => {
				throw new Error();
			},
			resolves(1),
			'fail',
		);
	},

	async 'resolves a function asynchronously'() {
		await assertAsyncMatchResult(() => Promise.resolve(1), resolves(), 'pass');
		await assertAsyncMatchResult(() => Promise.resolve(1), resolves(1), 'pass');
		await assertAsyncMatchResult(() => Promise.resolve(2), resolves(1), 'fail');
		await assertAsyncMatchResult(() => Promise.reject(), resolves(), 'fail');
		await assertAsyncMatchResult(() => Promise.reject(), resolves(1), 'fail');
	},

	async 'can delegate to another matcher to check the value'() {
		await assertAsyncMatchResult(
			() => Promise.resolve(1),
			resolves(equals(1)),
			'pass',
		);

		await assertAsyncMatchResult(
			() => Promise.resolve(2),
			resolves(equals(1)),
			'fail',
		);

		await assertAsyncMatchResult(
			() => Promise.reject(),
			resolves(equals(1)),
			'fail',
		);
	},
});
