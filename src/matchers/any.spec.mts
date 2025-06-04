import { describe } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { any } from './any.mts';

describe('any', {
	'stringifies to code'() {
		assertMatcherToString(any(), 'any()');
	},

	'always passes'() {
		assertMatchResult(true, any(), 'pass');
		assertMatchResult(false, any(), 'pass');
		assertMatchResult(0, any(), 'pass');
		assertMatchResult(null, any(), 'pass');
		assertMatchResult(undefined, any(), 'pass');
		assertMatchResult('', any(), 'pass');
		assertMatchResult(() => {}, any(), 'pass');
	},
});
