import { describe } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isGreaterThan } from './isGreaterThan.mts';

describe('isGreaterThan', {
	'stringifies to code'() {
		assertMatcherToString(isGreaterThan(1), 'isGreaterThan(1)');
	},

	'checks if value is strictly greater than comparison'() {
		assertMatchResult(2, isGreaterThan(3), 'fail');
		assertMatchResult(3, isGreaterThan(3), 'fail');
		assertMatchResult(4, isGreaterThan(3), 'pass');
	},
});
