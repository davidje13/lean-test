import { describe } from '../core/index.mts';
import { mock } from '../extras/mock/mock.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { hasBeenCalledWith } from './hasBeenCalledWith.mts';

describe('hasBeenCalledWith', {
	'stringifies to code'() {
		assertMatcherToString(
			hasBeenCalledWith(1, 'hi'),
			'hasBeenCalledWith(equals(1), equals("hi"))',
		);
	},

	'checks if mocked function was called with specified arguments'() {
		const fn = mock();
		fn('nope');
		assertMatchResult(fn, hasBeenCalledWith('foo'), 'fail');
		fn('foo');
		assertMatchResult(fn, hasBeenCalledWith('foo'), 'pass');
	},

	'rejects non-mocked functions'() {
		const fn = () => null;
		assertMatchResult(fn, hasBeenCalledWith(), 'error');
	},
});
