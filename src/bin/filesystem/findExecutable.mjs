import { platform } from 'process';
import { access } from 'fs/promises';
import { constants } from 'fs';
import { spawn } from 'child_process';

const invoke = (exec, args, opts = {}) => new Promise((resolve, reject) => {
	const stdout = [];
	const stderr = [];
	const proc = spawn(exec, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
	proc.stdout.addListener('data', (d) => stdout.push(d));
	proc.stderr.addListener('data', (d) => stderr.push(d));
	proc.addListener('error', reject);
	proc.addListener('close', (exitCode) => resolve({
		exitCode,
		stdout: Buffer.concat(stdout).toString('utf-8'),
		stderr: Buffer.concat(stderr).toString('utf-8'),
	}));
});

export const canExec = (path) => access(path, constants.X_OK).then(() => true, () => false);

export async function which(exec) {
	const { exitCode, stdout } = await invoke('which', [exec]);
	if (exitCode === 0) {
		return stdout.trim();
	} else {
		return null;
	}
}

export default async function findExecutable(options) {
	for (let { path, ifPlatform } of options) {
		if (!path || (ifPlatform && ifPlatform !== platform)) {
			continue;
		}
		if (!path.includes('/') && !path.includes('\\')) {
			path = await which(path);
		}
		if (path && await canExec(path)) {
			return path;
		}
	}
	throw new Error('Unable to launch browser; executable not found');
}
