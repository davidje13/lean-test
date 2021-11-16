export default class InnerError {
	constructor(error, fullStackList, stackList) {
		this.error = error;
		this.fullStackList = fullStackList;
		this.stackList = stackList;
	}

	getStackParts() {
		const parts = this.stackList.map(extractStackLine);

		// remove any trailing "special" frames (e.g. node internal async task handling)
		while (parts.length > 0 && !isFile(parts[parts.length - 1].location)) {
			parts.length--;
		}

		// trim common prefix from paths
		const prefix = getCommonPrefix(this.fullStackList.map((i) => extractStackLine(i).location).filter(isFile));
		return parts.map(({ location, ...rest }) => ({
			...rest,
			location: isFile(location) ? location.substr(prefix.length) : location,
		}));
	}

	get stack() {
		return String(this.error) + '\n' + this.stackList.join('\n');
	}

	get message() {
		return this.error.message;
	}

	toString() {
		return String(this.error);
	}
}

function getCommonPrefix(values) {
	if (!values.length) {
		return '';
	}
	return values.reduce((prefix, v) => {
		for (let p = 0; p < prefix.length; ++p) {
			if (v[p] !== prefix[p]) {
				return prefix.substr(0, p);
			}
		}
		return prefix;
	});
}

function isFile(frame) {
	return frame.includes('://');
}

const STACK_AT = /^at\s+/i;
const STACK_REGEX = /^([^(@]*?)\s*[@\(]\s*([^)]*)\)?$/i;

function extractStackLine(raw) {
	const cleaned = raw.trim().replace(STACK_AT, '');
	const match = cleaned.match(STACK_REGEX);
	if (match) {
		return { name: match[1], location: match[2] };
	} else if (cleaned.startsWith('async ')) {
		return { name: 'async anonymous', location: cleaned.substr(6) };
	} else {
		return { name: 'anonymous', location: cleaned };
	}
}
