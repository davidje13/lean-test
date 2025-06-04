import { describe, it } from '../core/index.mts';
import { cross } from '../extras/params/cross.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import {
	allValueFactories,
	primitiveValueFactories,
	standardValueFactories,
	uniqueValueFactories,
} from '../test-utils/valueFactories.mts';
import { isSameInstance } from './isSameInstance.mts';

describe('isSameInstance', () => {
	it('stringifies to code', () => {
		assertMatcherToString(isSameInstance({}), 'isSameInstance({})');
	});

	it.with(allValueFactories)(
		'passes for values compared with themself',
		({ parameter: factory }) => {
			const item = factory();
			assertMatchResult(item, isSameInstance(item), 'pass');
		},
	);

	it.with(primitiveValueFactories)(
		'passes for equivalent primitives',
		({ parameter: factory }) => {
			assertMatchResult(factory(), isSameInstance(factory()), 'pass');
		},
	);

	it.with([...standardValueFactories, ...uniqueValueFactories])(
		'fails for non-primitive values compared with identical copies',
		({ parameter: factory }) => {
			assertMatchResult(factory(), isSameInstance(factory()), 'fail');
		},
	);

	it.with(
		cross([allValueFactories, allValueFactories]).filter(
			([factoryA, factoryB]) => factoryA !== factoryB,
		),
	)(
		'fails for values compared with different values',
		({ parameter: [factoryA, factoryB] }) => {
			assertMatchResult(factoryB(), isSameInstance(factoryA()), 'fail');
		},
	);

	it('produces nice messages for symbols', () => {
		const s1 = Symbol();
		const s2 = Symbol('hi');
		assertMatchResult(s2, isSameInstance(s1), 'fail', 'Symbol(hi) != Symbol()');
	});
});
