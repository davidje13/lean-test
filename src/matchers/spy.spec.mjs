import mock from '../helpers/mock.mjs';
import * as matchers from './spy.mjs';

describe('hasBeenCalled', {
	'checks if mocked function was called'() {
		const fn = mock();
		expectFailure(matchers.hasBeenCalled()(fn));
		fn();
		expectSuccess(matchers.hasBeenCalled()(fn));
	},

	'optionally checks an exact number of times'() {
		const fn = mock();
		fn();
		expectFailure(matchers.hasBeenCalled({ times: 2 })(fn));
		expectSuccess(matchers.hasBeenCalled({ times: 1 })(fn));
	},

	'rejects non-mocked functions'() {
		const fn = () => null;
		expect(() => matchers.hasBeenCalled()(fn))
			.throws('matcher can only be used with mocked functions');
	},

	'invocations are cleared by reset'() {
		const fn = mock();
		fn();
		expectFailure(matchers.hasBeenCalled({ times: 0 })(fn));
		fn.reset();
		expectSuccess(matchers.hasBeenCalled({ times: 0 })(fn));
	},
});

describe('hasBeenCalledWith', {
	'checks if mocked function was called with specified arguments'() {
		const fn = mock();
		fn('nope');
		expectFailure(matchers.hasBeenCalledWith('foo')(fn));
		fn('foo');
		expectSuccess(matchers.hasBeenCalledWith('foo')(fn));
	},

	'rejects non-mocked functions'() {
		const fn = () => null;
		expect(() => matchers.hasBeenCalledWith()(fn))
			.throws('matcher can only be used with mocked functions');
	},
});

function expectSuccess(result) {
	if (!result.pass) {
		fail(`expected success, but failed: ${result.message}`);
	}
}

function expectFailure(result) {
	if (result.pass) {
		fail(`expected failure, but succeeded: ${result.message}`);
	}
}
