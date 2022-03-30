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

describe('isNear', {
	'checks if value is near to comparison'() {
		expect(matchers.isNear(3)(2).pass, isFalse());
		expect(matchers.isNear(3)(3).pass, isTrue());
		expect(matchers.isNear(3)(3.0001).pass, isTrue());
		expect(matchers.isNear(3)(2.9999).pass, isTrue());
		expect(matchers.isNear(3)(4).pass, isFalse());
	},

	'accepts an explicit precision'() {
		const matcher = matchers.isNear(3, { tolerance: 0.3 });
		expect(matcher(2.65).pass, isFalse());
		expect(matcher(2.75).pass, isTrue());
		expect(matcher(3.25).pass, isTrue());
		expect(matcher(3.35).pass, isFalse());
	},

	'accepts an explicit precision in decimal places'() {
		const matcher = matchers.isNear(3, { decimalPlaces: 4 });
		expect(matcher(2.99994).pass, isFalse());
		expect(matcher(2.99996).pass, isTrue());
		expect(matcher(3.00004).pass, isTrue());
		expect(matcher(3.00006).pass, isFalse());
	},

	'rejects unknown precision types'() {
		expect(() => matchers.isNear(3, { foo: 'bar' })(3)).throws('Unsupported precision type: {"foo":"bar"}');
	},
});
