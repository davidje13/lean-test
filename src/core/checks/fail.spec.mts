import { assertError } from '../../test-utils/assertError.mts';
import { describe, TestAssertionError } from '../index.mts';
import { fail } from './fail.mts';

describe('fail', {
	'throws TestAssertionError'() {
		assertError(() => fail('nope'), TestAssertionError, 'nope');
	},
});
