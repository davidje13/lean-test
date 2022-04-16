export function addDataListener(target) {
	const store = [];
	target.addListener('data', (d) => store.push(d));
	return () => Buffer.concat(store);
}

export async function asyncListToSync(items) {
	const result = [];
	for await (const item of items) {
		result.push(item);
	}
	return result;
}
