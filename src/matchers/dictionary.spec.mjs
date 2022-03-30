import * as matchers from './dictionary.mjs';
import * as coreMatchers from './core.mjs';

describe('hasProperty', {
	'checks properties on objects'() {
		const resultPass = matchers.hasProperty('foo')({ foo: 'abc', bar: 'def' });
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.hasProperty('foo')({ abc: 'foo', def: 'bar' });
		expect(resultFail.pass, isFalse());
	},

	'considers values set to undefined to be present'() {
		const resultPass = matchers.hasProperty('foo')({ foo: undefined });
		expect(resultPass.pass, isTrue());
	},

	'checks properties on arrays'() {
		const resultPass = matchers.hasProperty('length')([]);
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.hasProperty('foo')([]);
		expect(resultFail.pass, isFalse());
	},

	'checks indices on arrays'() {
		const resultPass = matchers.hasProperty(1)([0, 0]);
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.hasProperty(1)([0]);
		expect(resultFail.pass, isFalse());
	},

	'checks properties on strings'() {
		const resultPass = matchers.hasProperty('length')('foo');
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.hasProperty('foo')('foo');
		expect(resultFail.pass, isFalse());
	},

	'checks properties on numbers'() {
		const resultFail = matchers.hasProperty('length')(0);
		expect(resultFail.pass, isFalse());
	},

	'checks properties on boolean values'() {
		const resultFail = matchers.hasProperty('length')(false);
		expect(resultFail.pass, isFalse());
	},

	'returns failure for null and undefined'() {
		expect(matchers.hasProperty('length')(null).pass, isFalse());
		expect(matchers.hasProperty('length')(undefined).pass, isFalse());
	},

	'delegates to another matcher'() {
		const resultPass = matchers.hasProperty('foo', coreMatchers.equals(3))({ foo: 3 });
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.hasProperty('foo', coreMatchers.equals(2))({ foo: 3 });
		expect(resultFail.pass, isFalse());
	},
});
