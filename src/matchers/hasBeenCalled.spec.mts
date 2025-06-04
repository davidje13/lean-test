import { describe } from '../core/index.mts';
import { mock } from '../extras/mock/mock.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { hasBeenCalled } from './hasBeenCalled.mts';

describe('hasBeenCalled', {
	'stringifies to code'() {
		assertMatcherToString(hasBeenCalled(), 'hasBeenCalled()');
		assertMatcherToString(
			hasBeenCalled({ times: 1 }),
			'hasBeenCalled({times: 1})',
		);
	},

	'checks if mocked function was called'() {
		const fn = mock();
		assertMatchResult(fn, hasBeenCalled(), 'fail');
		fn();
		assertMatchResult(fn, hasBeenCalled(), 'pass');
	},

	'optionally checks an exact number of times'() {
		const fn = mock();
		assertMatchResult(fn, hasBeenCalled({ times: 0 }), 'pass');
		fn();
		assertMatchResult(fn, hasBeenCalled({ times: 2 }), 'fail');
		assertMatchResult(fn, hasBeenCalled({ times: 1 }), 'pass');
	},

	'rejects non-mocked functions'() {
		const fn = () => null;
		assertMatchResult(fn, hasBeenCalled(), 'error');
	},

	'invocations are cleared by reset'() {
		const fn = mock();
		fn();
		assertMatchResult(fn, hasBeenCalled({ times: 0 }), 'fail');
		fn.reset();
		assertMatchResult(fn, hasBeenCalled({ times: 0 }), 'pass');
	},
});
