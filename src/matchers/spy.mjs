import { print } from '../utils.mjs';
import { isListOf } from './collections.mjs';

export const hasBeenCalled = ({ times = null } = {}) => (fn) => {
	const invocations = fn.invocations;
	if (!invocations) {
		throw new Error('matcher can only be used with mocked functions');
	}
	const actualTimes = invocations.length;
	if (times === null) {
		if (actualTimes > 0) {
			return { pass: true, message: `Expected not to have been called, but was called ${actualTimes} time(s).` };
		} else {
			return { pass: false, message: 'Expected to have been called, but was not.' };
		}
	}
	if (actualTimes === times) {
		return { pass: true, message: `Expected not to have been called ${times} time(s), but was.` };
	} else {
		return { pass: false, message: `Expected to have been called ${times} time(s), but was called ${actualTimes} time(s).` };
	}
};

export const hasBeenCalledWith = (...expectedArgs) => (fn) => {
	const invocations = fn.invocations;
	if (!invocations) {
		throw new Error('matcher can only be used with mocked functions');
	}
	const matcher = isListOf(...expectedArgs);
	const mismatches = [];
	for (const i of invocations) {
		const match = matcher(i.arguments);
		if (match.pass) {
			return { pass: true, message: `Expected not to have been called with ${expectedArgs.map(print).join(', ')}, but was.` };
		}
		mismatches.push(`  ${i.arguments.map(print).join(', ')} (${match.message})`);
	}
	return { pass: false, message: `Expected to have been called with ${expectedArgs.map(print).join(', ')}, but no matching calls.\nObserved calls:\n${mismatches.join('\n')}` };
};
