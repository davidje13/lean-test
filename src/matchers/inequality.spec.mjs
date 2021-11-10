import * as matchers from './inequality.mjs';

describe('isGreaterThan', {
	'checks if value is strictly greater than comparison'() {
		expect(matchers.isGreaterThan(3)(2).success, isFalse());
		expect(matchers.isGreaterThan(3)(3).success, isFalse());
		expect(matchers.isGreaterThan(3)(4).success, isTrue());
	},
});

describe('isLessThan', {
	'checks if value is strictly less than comparison'() {
		expect(matchers.isLessThan(3)(2).success, isTrue());
		expect(matchers.isLessThan(3)(3).success, isFalse());
		expect(matchers.isLessThan(3)(4).success, isFalse());
	},
});

describe('isGreaterThanOrEqual', {
	'checks if value is greater than or equal to comparison'() {
		expect(matchers.isGreaterThanOrEqual(3)(2).success, isFalse());
		expect(matchers.isGreaterThanOrEqual(3)(3).success, isTrue());
		expect(matchers.isGreaterThanOrEqual(3)(4).success, isTrue());
	},
});

describe('isLessThanOrEqual', {
	'checks if value is less than or equal to comparison'() {
		expect(matchers.isLessThanOrEqual(3)(2).success, isTrue());
		expect(matchers.isLessThanOrEqual(3)(3).success, isTrue());
		expect(matchers.isLessThanOrEqual(3)(4).success, isFalse());
	},
});
