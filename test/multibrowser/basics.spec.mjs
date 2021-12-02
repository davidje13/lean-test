test('is chrome', () => {
	expect(window.navigator.userAgent, withMessage('not expected browser', contains('Chrome')));
});

test('is firefox', () => {
	expect(window.navigator.userAgent, withMessage('not expected browser', contains('Firefox')));
});
