export const allKeys = (o: object) => [
	...Object.keys(o),
	...Object.getOwnPropertySymbols(o),
];
