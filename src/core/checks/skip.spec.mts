import { assertError } from '../../test-utils/assertError.mts';
import { describe, TestAssumptionError } from '../index.mts';
import { skip } from './skip.mts';

describe('skip', {
	'throws TestAssumptionError'() {
		assertError(() => skip('nope'), TestAssumptionError, 'nope');
	},
});
