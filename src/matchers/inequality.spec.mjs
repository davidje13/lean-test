import * as matchers from './inequality.mjs';

describe('isGreaterThan', {
	'checks if value is strictly greater than comparison'() {
		expect(matchers.isGreaterThan(3)(2).pass, isFalse());
		expect(matchers.isGreaterThan(3)(3).pass, isFalse());
		expect(matchers.isGreaterThan(3)(4).pass, isTrue());
	},
});

describe('isLessThan', {
	'checks if value is strictly less than comparison'() {
		expect(matchers.isLessThan(3)(2).pass, isTrue());
		expect(matchers.isLessThan(3)(3).pass, isFalse());
		expect(matchers.isLessThan(3)(4).pass, isFalse());
	},
});

describe('isGreaterThanOrEqual', {
	'checks if value is greater than or equal to comparison'() {
		expect(matchers.isGreaterThanOrEqual(3)(2).pass, isFalse());
		expect(matchers.isGreaterThanOrEqual(3)(3).pass, isTrue());
		expect(matchers.isGreaterThanOrEqual(3)(4).pass, isTrue());
	},
});

describe('isLessThanOrEqual', {
	'checks if value is less than or equal to comparison'() {
		expect(matchers.isLessThanOrEqual(3)(2).pass, isTrue());
		expect(matchers.isLessThanOrEqual(3)(3).pass, isTrue());
		expect(matchers.isLessThanOrEqual(3)(4).pass, isFalse());
	},
});
