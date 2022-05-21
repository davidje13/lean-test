export const dynamicImport = (dependency, name) => import(dependency).catch(() => {
	throw new Error(`Must install ${dependency} to use ${name} (npm install --save-dev ${dependency})`);
});
