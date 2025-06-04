import { equals, eventually, hasProperty } from '../../matchers/index.mts';
import { assertError } from '../../test-utils/assertError.mts';
import { assertUnhandled } from '../../test-utils/assertUnhandled.mts';
import {
	describe,
	TestAssertionError,
	TestAssumptionError,
} from '../index.mts';
import { assume } from './assume.mts';

describe('assume', {
	'throws TestAssumptionError if the given value does not match the given matcher'() {
		assertError(
			() => assume(1, equals(2)),
			TestAssumptionError,
			'assume(value, equals(2)) failed:\n1 != 2',
		);
	},

	'does not throw if the matcher matches'() {
		assume(1, equals(1));
	},

	async 'waits for async matchers'() {
		const tm0 = Date.now();
		const wrapper = { value: 1 };
		setTimeout(() => {
			wrapper.value = 2;
		}, 100);
		await assume(wrapper, eventually(hasProperty('value', equals(2))));
		const tm1 = Date.now();
		if (tm1 - tm0 < 50) {
			throw new TestAssertionError('assume did not await matcher');
		}
	},

	async 'errors if a returned promise is not awaited'() {
		const x = 'foo';
		const reject = await assertUnhandled(async () => {
			void assume(x, eventually(equals('foo')));
		}, 1000);
		if (reject !== 'async operation was not awaited') {
			throw new TestAssertionError('unexpected rejection message');
		}
	},
});
