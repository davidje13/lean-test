export const isGreaterThan = (expected) => (actual) => {
	if (actual > expected) {
		return { pass: true, message: `Expected a value not greater than ${expected}, but got ${actual}.` };
	} else {
		return { pass: false, message: `Expected a value greater than ${expected}, but got ${actual}.` };
	}
};

export const isLessThan = (expected) => (actual) => {
	if (actual < expected) {
		return { pass: true, message: `Expected a value not less than ${expected}, but got ${actual}.` };
	} else {
		return { pass: false, message: `Expected a value less than ${expected}, but got ${actual}.` };
	}
};

export const isGreaterThanOrEqual = (expected) => (actual) => {
	if (actual >= expected) {
		return { pass: true, message: `Expected a value not greater than or equal to ${expected}, but got ${actual}.` };
	} else {
		return { pass: false, message: `Expected a value greater than or equal to ${expected}, but got ${actual}.` };
	}
};

export const isLessThanOrEqual = (expected) => (actual) => {
	if (actual <= expected) {
		return { pass: true, message: `Expected a value not less than or equal to ${expected}, but got ${actual}.` };
	} else {
		return { pass: false, message: `Expected a value less than or equal to ${expected}, but got ${actual}.` };
	}
};
