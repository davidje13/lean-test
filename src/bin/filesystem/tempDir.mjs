import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

const TEMP_BASE = join(tmpdir(), 'lean-test-');

export function makeTempDir() {
	return mkdtemp(TEMP_BASE);
}

export function removeTempDir(path) {
	if (!path || !path.startsWith(TEMP_BASE)) {
		// safety check
		throw new Error('Attempted to delete non-temp directory');
	}
	return rm(path, { maxRetries: 2, recursive: true });
}
