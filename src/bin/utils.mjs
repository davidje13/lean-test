export function addDataListener(target) {
	const store = [];
	target.addListener('data', (d) => store.push(d));
	return () => Buffer.concat(store);
}
