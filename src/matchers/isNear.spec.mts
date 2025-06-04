import { describe } from '../core/index.mts';
import { assertError } from '../test-utils/assertError.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isNear } from './isNear.mts';

describe('isNear', {
	'stringifies to code'() {
		assertMatcherToString(isNear(3), 'isNear(3, {decimalPlaces: 2})');
		assertMatcherToString(
			isNear(3, { tolerance: 0.5 }),
			'isNear(3, {tolerance: 0.5})',
		);
		assertMatcherToString(
			isNear(3, { decimalPlaces: 1 }),
			'isNear(3, {decimalPlaces: 1})',
		);
	},

	'checks if value is near to comparison'() {
		assertMatchResult(2, isNear(3), 'fail');
		assertMatchResult(3, isNear(3), 'pass');
		assertMatchResult(3.0001, isNear(3), 'pass');
		assertMatchResult(2.9999, isNear(3), 'pass');
		assertMatchResult(4, isNear(3), 'fail');
	},

	'accepts an explicit precision'() {
		assertMatchResult(2.65, isNear(3, { tolerance: 0.3 }), 'fail');
		assertMatchResult(2.75, isNear(3, { tolerance: 0.3 }), 'pass');
		assertMatchResult(3.25, isNear(3, { tolerance: 0.3 }), 'pass');
		assertMatchResult(3.35, isNear(3, { tolerance: 0.3 }), 'fail');
	},

	'accepts an explicit precision in decimal places'() {
		assertMatchResult(2.99994, isNear(3, { decimalPlaces: 4 }), 'fail');
		assertMatchResult(2.99996, isNear(3, { decimalPlaces: 4 }), 'pass');
		assertMatchResult(3.00004, isNear(3, { decimalPlaces: 4 }), 'pass');
		assertMatchResult(3.00006, isNear(3, { decimalPlaces: 4 }), 'fail');
	},

	'rejects unknown precision types'() {
		assertError(
			() => isNear(3, { foo: 'bar' } as any),
			Error,
			'Unsupported precision type: {foo: "bar"}',
		);
	},
});
