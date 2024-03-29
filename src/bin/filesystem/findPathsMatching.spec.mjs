import findPathsMatching from './findPathsMatching.mjs';
import { cwd } from 'process';

const COMMON_EXCLUDE = ['node_modules', '.git']; // always exclude to avoid crazy results or slowness

describe('findPathsMatching', {
	async 'scans directories recursively looking for matching files'() {
		const results = await toList(findPathsMatching(cwd(), '**/findPathsMatching.*', COMMON_EXCLUDE));
		const relativePaths = results.map((r) => r.relative);
		expect(relativePaths.sort(), equals([
			'src/bin/filesystem/findPathsMatching.mjs',
			'src/bin/filesystem/findPathsMatching.spec.mjs',
		]));
	},

	async 'does not search excluded files'() {
		const results = await toList(findPathsMatching(cwd(), '**/findPathsMatching.*', [...COMMON_EXCLUDE, '**/bin']));
		expect(results, isEmpty());
	},
});

async function toList(gen) {
	const list = [];
	for await (const item of gen) {
		list.push(item);
	}
	return list;
}
