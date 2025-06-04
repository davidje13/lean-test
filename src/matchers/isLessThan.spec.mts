import { describe } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isLessThan } from './isLessThan.mts';

describe('isLessThan', {
	'stringifies to code'() {
		assertMatcherToString(isLessThan(1), 'isLessThan(1)');
	},

	'checks if value is strictly less than comparison'() {
		assertMatchResult(2, isLessThan(3), 'pass');
		assertMatchResult(3, isLessThan(3), 'fail');
		assertMatchResult(4, isLessThan(3), 'fail');
	},
});
