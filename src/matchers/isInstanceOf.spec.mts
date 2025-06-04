import { describe } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isInstanceOf } from './isInstanceOf.mts';

describe('isInstanceOf', {
	'stringifies to code'() {
		assertMatcherToString(isInstanceOf('string'), 'isInstanceOf("string")');
		assertMatcherToString(isInstanceOf(Date), 'isInstanceOf(Date)');
	},

	'checks if an object is an instance of a class'() {
		assertMatchResult(
			new String('foo'),
			isInstanceOf(String),
			'pass',
			'"foo" is of type "String", which is an instance of "String"',
		);

		assertMatchResult(
			new String('foo'),
			isInstanceOf(Date),
			'fail',
			'"foo" is of type "String", which is not an instance of "Date"',
		);
	},

	'checks primitive values'() {
		assertMatchResult(7, isInstanceOf('number'), 'pass');
		assertMatchResult(7, isInstanceOf(Date), 'fail');

		assertMatchResult(Symbol(), isInstanceOf('symbol'), 'pass');
		assertMatchResult(Symbol(), isInstanceOf(Date), 'fail');
	},
});
