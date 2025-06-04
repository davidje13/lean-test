import { describe } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isLessThanOrEqual } from './isLessThanOrEqual.mts';

describe('isLessThanOrEqual', {
	'stringifies to code'() {
		assertMatcherToString(isLessThanOrEqual(1), 'isLessThanOrEqual(1)');
	},

	'checks if value is less than or equal to comparison'() {
		assertMatchResult(2, isLessThanOrEqual(3), 'pass');
		assertMatchResult(3, isLessThanOrEqual(3), 'pass');
		assertMatchResult(4, isLessThanOrEqual(3), 'fail');
	},
});
