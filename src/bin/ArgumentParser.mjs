const YES = ['true', 'yes', '1', 'on'];
const NO = ['false', 'no', '0', 'off'];

export default class ArgumentParser {
	constructor(opts) {
		this.names = new Map();
		this.envs = [];
		this.defaults = {};
		this.mappings = [];
		Object.entries(opts).forEach(([id, v]) => {
			this.defaults[id] = v.default;
			if (v.mapping) {
				this.mappings.push({ id, name: v.names[0], mapping: v.mapping });
			}
			const config = { id, type: v.type || 'boolean' };
			v.names.forEach((name) => this.names.set(name, config));
			if (v.env) {
				this.envs.push({ env: v.env, config });
			}
		});
	}

	parseOpt(name, target, config, value, getValue) {
		const { id, type } = config;
		switch (type) {
			case 'boolean':
				if (id in target) {
					throw new Error(`Multiple values for ${name} not supported`);
				}
				if (value === null || YES.includes(value)) {
					target[id] = true;
				} else if (NO.includes(value)) {
					target[id] = false;
				} else {
					throw new Error(`Unknown boolean value for ${name}: ${value}`);
				}
				break;
			case 'string':
			case 'int':
				if (id in target) {
					throw new Error(`Multiple values for ${name} not supported`);
				}
				let v = value ?? getValue();
				if (type === 'int') {
					v = Number.parseInt(v, 10);
				}
				target[id] = v;
				break;
			case 'array':
			case 'set':
				const list = target[id] || [];
				list.push(...(value ?? getValue()).split(','));
				target[id] = (type === 'set') ? [...new Set(list)] : list;
				break;
			default:
				throw new Error(`Unknown argument type for ${name}: ${type}`);
		}
	}

	loadOpt(target, name, value, extra) {
		const config = this.names.get(name);
		if (!config) {
			throw new Error(`Unknown flag: ${name}`);
		}
		let inc = 0;
		const getNext = () => {
			if (inc >= extra.length) {
				throw new Error(`No value given for ${name}`);
			}
			return extra[inc++];
		};
		this.parseOpt(name, target, config, value, getNext);
		return inc;
	}

	applyMappings(options) {
		for (const { id, name, mapping } of this.mappings) {
			const value = options[id];
			if (value === undefined) {
				continue;
			}
			if (Array.isArray(value)) {
				options[id] = value.map((v) => applyMap(v, name, mapping));
			} else {
				options[id] = applyMap(value, name, mapping);
			}
		}
		return options;
	}

	parse(environment, argv, begin = 2) {
		let rest = false;
		const envResult = {};
		this.envs.forEach(({ env, config }) => {
			if (environment[env] !== undefined) {
				this.parseOpt(env, envResult, config, environment[env]);
			}
		});
		const result = {};
		for (let i = begin; i < argv.length; ++i) {
			const arg = argv[i];
			if (rest) {
				this.loadOpt(result, null, arg, []);
			} else if (arg === '--') {
				rest = true;
			} else if (arg.startsWith('--')) {
				const [name, value] = split2(arg.substr(2), '=');
				i += this.loadOpt(result, name, value, argv.slice(i + 1));
			} else if (arg.startsWith('-')) {
				const [names, value] = split2(arg.substr(1), '=');
				for (let j = 0; j < names.length - 1; ++ j) {
					this.loadOpt(result, names[j], null, []);
				}
				i += this.loadOpt(result, names[names.length - 1], value, argv.slice(i + 1));
			} else {
				this.loadOpt(result, null, arg, []);
			}
		}
		return this.applyMappings({ ...this.defaults, ...envResult, ...result });
	}
}

function split2(v, s) {
	const p = v.indexOf(s);
	if (p === -1) {
		return [v, null];
	} else {
		return [v.substr(0, p), v.substr(p + 1)];
	}
}

function applyMap(value, name, mapping) {
	if (mapping instanceof Map) {
		if (!mapping.has(value)) {
			throw new Error(`Unknown ${name}: ${value}`);
		}
		return mapping.get(value);
	}
	if (mapping instanceof Set) {
		if (!mapping.has(value)) {
			throw new Error(`Unknown ${name}: ${value}`);
		}
		return value;
	}
	throw new Error(`Invalid mapping config for ${name}`);
}
