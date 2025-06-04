export { assume } from './checks/assume.mts';
export { expect } from './checks/expect.mts';
export { fail } from './checks/fail.mts';
export {
	Matcher,
	type MatcherResult,
	type MatcherResultType,
} from './checks/Matcher.mts';
export { skip } from './checks/skip.mts';
export { TestAssertionError } from './errors/TestAssertionError.mts';
export { TestAssumptionError } from './errors/TestAssumptionError.mts';
export { TestError } from './errors/TestError.mts';
export { afterAll, afterEach, beforeAll, beforeEach } from './lifecycle.mts';
export { format, stripFormatting } from './output/format.mts';
export {
	stringifyActual,
	stringifyExpected,
	stringifyPlain,
	unquotedString,
} from './output/stringify.mts';
export type { BlockContext } from './plugins/BlockContext.mts';
export { getTestAbortSignal } from './plugins/InternalContext.mts';
export { plugin } from './plugins/plugin.mts';
export type { Ptr } from './plugins/Ptr.mts';
export {
	describe,
	fdescribe,
	fsequence,
	sequence,
	xdescribe,
	xsequence,
} from './structure/describe.mts';
export { fit, ftest, it, test, xit, xtest } from './structure/it.mts';

import { setStructureReadyCallback } from './structure.mts';
export const internal = { setStructureReadyCallback };

// default plugins
import './checks/countExpectations.mts';
import './global-captors/output/aggregateOutput.mts';
import './global-captors/output/getOutput.mts';
