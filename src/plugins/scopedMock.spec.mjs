import testRunner from '../test-helpers/testRunner.mjs';
import scopedMock from './scopedMock.mjs';

describe('scopedMock', {
	async 'reverts mocks after test'() {
		const originalFunc = () => true;
		const o = {
			foo: originalFunc,
		};
		await testRunner([scopedMock()], { pass: 1 }, (g) => {
			g.test('test 1', () => {
				g.mock(o, 'foo').whenCalled().thenReturn(7);
				if (o.foo() !== 7) {
					throw new Error();
				}
			});
		});

		expect(o.foo).same(originalFunc);
	},
});
