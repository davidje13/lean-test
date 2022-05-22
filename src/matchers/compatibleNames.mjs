export {
	equals as toEqual,
	same as toBe,
	matches as toMatch,
	isTruthy as toBeTruthy,
	isFalsy as toBeFalsy,
	isNull as toBeNull,
	isUndefined as toBeUndefined,
	throws as toThrow,
} from './core.mjs';

export {
	isGreaterThan as toBeGreaterThan,
	isLessThan as toBeLessThan,
	isGreaterThanOrEqual as toBeGreaterThanOrEqual,
	isLessThanOrEqual as toBeLessThanOrEqual,
} from './inequality.mjs';

export {
	hasLength as toHaveLength,
	contains as toContain,
} from './collections.mjs';

export {
	hasProperty as toHaveProperty,
} from './dictionary.mjs';

export {
	hasBeenCalled as toHaveBeenCalled,
	hasBeenCalledWith as toHaveBeenCalledWith,
} from './spy.mjs';
