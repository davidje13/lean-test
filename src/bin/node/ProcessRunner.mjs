import { env } from 'process';
import { dirname, resolve } from 'path';
import { realpath } from 'fs/promises';
import { spawn } from 'child_process';
import { addDataListener } from '../utils.mjs';
import { ExternalRunner } from '../../lean-test.mjs';
import findExecutable from '../filesystem/findExecutable.mjs';

export default class ProcessRunner extends ExternalRunner {
	constructor({ preprocessorRaw, parallelDiscovery, parallelSuites }, paths) {
		super();
		this.preprocessorRaw = preprocessorRaw;
		this.subConfig = { parallelDiscovery, parallelSuites };
		this.paths = paths;
	}

	async getCommand() {
		// must use realpath because npm will install the binary as a symlink in a different folder (.bin)
		const selfPath = dirname(await realpath(process.argv[1]));
		const node = await findExecutable([{ path: 'node' }, { path: 'nodejs' }]);
		return [
			node,
			'--experimental-loader',
			resolve(selfPath, '../preprocessor.mjs'),
			resolve(selfPath, '../node-runtime.mjs'),
		];
	}

	async launch() {
		const [executable, ...args] = await this.getCommand();
		this.launched = spawn(executable, args, {
			stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
			env: {
				...env,
				__LEAN_TEST_PREPROC: this.preprocessorRaw ?? '',
				__LEAN_TEST_CONFIG: JSON.stringify(this.subConfig),
				__LEAN_TEST_PATHS: JSON.stringify(this.paths),
			},
		});
		this.stdout = addDataListener(this.launched.stdout);
		this.stderr = addDataListener(this.launched.stderr);
	}

	registerEventListener(listener) {
		this.launched.stdio[3].addListener(
			'data',
			splitStream(0x1E, (item) => listener(JSON.parse(item.toString('utf-8')))),
		);
		this.launched.once('error', (error) => listener({ type: 'runner-error', error }));
	}

	async teardown() {
		this.launched?.kill();
		this.launched = null;
	}

	debug() {
		return `stdout:\n${this.stdout().toString('utf-8')}\nstderr:\n${this.stderr().toString('utf-8')}`;
	}
}

function splitStream(delimiterByte, callback) {
	const store = [];
	return (d) => {
		const items = [];
		while (d.length > 0) {
			const p = d.indexOf(delimiterByte);
			if (p === -1) {
				store.push(d);
				break;
			}
			if (store.length) {
				store.push(d.slice(0, p));
				items.push(Buffer.concat(store));
				store.length = 0;
			} else {
				items.push(d.slice(0, p));
			}
			d = d.slice(p + 1);
		}
		items.forEach(callback);
	};
}
