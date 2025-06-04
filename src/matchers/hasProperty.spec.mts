import { describe } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { equals } from './equals.mts';
import { hasProperty } from './hasProperty.mts';

describe('hasProperty', {
	'stringifies to code'() {
		assertMatcherToString(hasProperty('foo'), 'hasProperty("foo", any())');
		assertMatcherToString(
			hasProperty('foo', equals(1)),
			'hasProperty("foo", equals(1))',
		);
	},

	'checks properties on objects'() {
		assertMatchResult({ foo: 'abc', bar: 'def' }, hasProperty('foo'), 'pass');
		assertMatchResult({ abc: 'foo', def: 'bar' }, hasProperty('foo'), 'fail');
	},

	'checks Symbol properties'() {
		const symbol = Symbol();

		assertMatchResult({ [symbol]: 'abc' }, hasProperty(symbol), 'pass');
		assertMatchResult({ abc: 'foo' }, hasProperty(symbol), 'fail');
	},

	'considers values set to undefined to be present'() {
		assertMatchResult({ foo: undefined }, hasProperty('foo'), 'pass');
	},

	'checks properties on arrays'() {
		assertMatchResult([], hasProperty('length'), 'pass');
		assertMatchResult([], hasProperty('foo'), 'fail');
	},

	'checks indices on arrays'() {
		assertMatchResult([0, 0], hasProperty(1), 'pass');
		assertMatchResult([0], hasProperty(1), 'fail');
	},

	'checks properties on strings'() {
		assertMatchResult('foo', hasProperty('length'), 'pass');
		assertMatchResult('foo', hasProperty('foo'), 'fail');
	},

	'checks properties on numbers'() {
		assertMatchResult(0, hasProperty('length'), 'fail');
	},

	'checks properties on boolean values'() {
		assertMatchResult(false, hasProperty('length'), 'fail');
	},

	'returns failure for null and undefined'() {
		assertMatchResult(null, hasProperty('length'), 'fail');
		assertMatchResult(undefined, hasProperty('length'), 'fail');
	},

	'delegates to another matcher'() {
		assertMatchResult({ foo: 3 }, hasProperty('foo', equals(3)), 'pass');
		assertMatchResult({ foo: 3 }, hasProperty('foo', equals(2)), 'fail');
	},
});
