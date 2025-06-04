import { describe } from '../core/index.mts';
import {
	assertAsyncMatchResult,
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { equals } from './equals.mts';
import { throws } from './throws.mts';

describe('throws', {
	'stringifies to code'() {
		assertMatcherToString(throws(), 'throws(any())');
		assertMatcherToString(throws(1), 'throws(equals(1))');
	},

	async 'resolves a promise'() {
		assertAsyncMatchResult(Promise.resolve(), throws(), 'fail');
		assertAsyncMatchResult(Promise.reject(), throws(), 'pass');
	},

	async 'optionally checks the value'() {
		assertAsyncMatchResult(Promise.resolve(), throws(1), 'fail');
		assertAsyncMatchResult(Promise.reject(1), throws(1), 'pass');
		assertAsyncMatchResult(Promise.reject(2), throws(1), 'fail');
	},

	'resolves a function synchronously'() {
		assertMatchResult(() => 1, throws(), 'fail');
		assertMatchResult(() => 1, throws(1), 'fail');

		assertMatchResult(
			() => {
				throw 1;
			},
			throws(),
			'pass',
		);

		assertMatchResult(
			() => {
				throw 1;
			},
			throws(1),
			'pass',
		);

		assertMatchResult(
			() => {
				throw 2;
			},
			throws(1),
			'fail',
		);
	},

	async 'resolves a function asynchronously'() {
		assertAsyncMatchResult(() => Promise.resolve(1), throws(), 'fail');
		assertAsyncMatchResult(() => Promise.resolve(1), throws(1), 'fail');
		assertAsyncMatchResult(() => Promise.reject(1), throws(), 'pass');
		assertAsyncMatchResult(() => Promise.reject(1), throws(1), 'pass');
		assertAsyncMatchResult(() => Promise.reject(2), throws(1), 'fail');
	},

	'checks partial error message matches if given a string'() {
		assertMatchResult(
			() => {
				throw new Error('long message');
			},
			throws('long'),
			'pass',
		);

		assertMatchResult(
			() => {
				throw new Error('long message');
			},
			throws('nope'),
			'fail',
		);

		assertMatchResult(() => 1, throws('anything'), 'fail');
	},

	'checks error message against a given RegExp'() {
		assertMatchResult(
			() => {
				throw new Error('long message');
			},
			throws(/lo+ng/),
			'pass',
		);

		assertMatchResult(
			() => {
				throw new Error('long message');
			},
			throws(/nope/),
			'fail',
		);

		assertMatchResult(() => 1, throws(/any/), 'fail');
	},

	async 'can delegate to another matcher to check the value'() {
		assertAsyncMatchResult(Promise.reject(1), throws(equals(1)), 'pass');
		assertAsyncMatchResult(Promise.reject(2), throws(equals(1)), 'fail');
		assertAsyncMatchResult(Promise.resolve(), throws(equals(1)), 'fail');
	},
});
