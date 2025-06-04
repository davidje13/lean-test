import { describe } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isGreaterThanOrEqual } from './isGreaterThanOrEqual.mts';

describe('isGreaterThanOrEqual', {
	'stringifies to code'() {
		assertMatcherToString(isGreaterThanOrEqual(1), 'isGreaterThanOrEqual(1)');
	},

	'checks if value is greater than or equal to comparison'() {
		assertMatchResult(2, isGreaterThanOrEqual(3), 'fail');
		assertMatchResult(3, isGreaterThanOrEqual(3), 'pass');
		assertMatchResult(4, isGreaterThanOrEqual(3), 'pass');
	},
});
