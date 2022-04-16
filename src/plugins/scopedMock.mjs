import StackScope from '../core/StackScope.mjs';
import mock from '../helpers/mock.mjs';

const MOCK_SCOPE = new StackScope('MOCK');

export default () => (builder) => {
	builder.addGlobals({
		mock(...args) {
			const fn = mock(...args);
			if (fn.revert) {
				MOCK_SCOPE.get()?.push(fn);
			}
			return fn;
		},
	});

	builder.addRunInterceptor(async (next) => {
		const mockedMethods = [];
		try {
			await MOCK_SCOPE.run(mockedMethods, next);
		} finally {
			for (const mock of mockedMethods) {
				mock.revert();
			}
		}
	});
};
