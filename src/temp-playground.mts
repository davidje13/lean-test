import {
	assume,
	beforeEach,
	describe,
	expect,
	fail,
	format,
	it,
	sequence,
	stripFormatting,
} from './core/index.mts';
import {
	containsSubstring,
	equals,
	isInstanceOf,
	not,
} from './matchers/index.mts';

it('formatting', () => {
	for (const [name, fn] of Object.entries(format)) {
		const basic = 'before' + fn('inside') + 'after';
		console.log(
			name.padEnd(14, ' ') +
				': ' +
				basic +
				'\x1b[0m        blue+' +
				name.padEnd(14, ' ') +
				': ' +
				format.bgBlue(basic) +
				'\x1b[0m        stripped: ' +
				stripFormatting(basic, true),
		);
	}
});

describe('my suite', () => {
	const p1 = beforeEach(() => {
		return 1;
	});

	it('whee', ({ [p1]: v1 }) => {
		expect(v1, equals(1));
	}).repeat(3, { maxFailures: 1 });

	it('contains', () => {
		expect('my string', not(containsSubstring('tr')));
	});

	it('counts', ({ countExpectations }) => {
		expect(countExpectations(), equals(0));
		expect(countExpectations(), equals(1));
	});

	it('expects failure', () => {
		expect(1, equals(0));
	}).failing('expect(value, equals');

	it<{ name: string; foo: number }>('reads parameters', ({
		parameter: { name, foo },
	}) => {
		expect(name, isInstanceOf('string'));
		expect(foo, isInstanceOf('number'));
	}).withParameters([
		{ name: 'one', foo: 1 },
		{ name: 'two', foo: 2 },
		{ name: 'two', foo: 3 }, // duplicate name
	]);
});

sequence('ordered tests', () => {
	it('one', () => {
		console.log('1');
	});

	it('two', async () => {
		await new Promise((resolve) => setTimeout(resolve, 50));
		console.log('2');
	});

	it('three', () => {
		console.log('3');
		fail();
	});

	it('four', () => {
		console.log('nope');
	});
});

describe('reporting', () => {
	it.todo('is not yet written');

	it.skip('is skipped', () => {});

	it('passes', () => {});

	it('is skipped by assumption', () => assume(1, equals(2)));

	it('fails', () => expect(1, equals(2)));

	it('times out', async () => {
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}).withTimeout(100);

	it('throws', () => {
		throw new Error('oops');
	});

	it('throws with cause', () => {
		throw new Error('oops', { cause: new Error('inner') });
	});
});
