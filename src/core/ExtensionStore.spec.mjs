import ExtensionStore from './ExtensionStore.mjs';

describe('ExtensionStore', {
	'added items can be retrieved'() {
		const store = new ExtensionStore();
		store.add('foo', 'a', 'b', 'c');

		expect(store.get('foo'), equals(['a', 'b', 'c']));
	},

	'multiple calls to add are combined'() {
		const store = new ExtensionStore();
		store.add('foo', 'a');
		store.add('foo', 'b', 'c');

		expect(store.get('foo'), equals(['a', 'b', 'c']));
	},

	'values are distinguished by key'() {
		const store = new ExtensionStore();
		store.add('foo', 'a');
		store.add('bar', 'b', 'c');

		expect(store.get('foo'), equals(['a']));
		expect(store.get('bar'), equals(['b', 'c']));
	},

	'unset keys are considered empty'() {
		const store = new ExtensionStore();

		expect(store.get('foo'), equals([]));
	},

	'keys can be symbols'() {
		const store = new ExtensionStore();
		const key = Symbol();
		store.add(key, 'a');

		expect(store.get(key), equals(['a']));
	},

	'copy clones the object'() {
		const store1 = new ExtensionStore();
		store1.add('foo', 'a');

		const store2 = store1.copy();
		store2.add('foo', 'c');
		store2.add('bar', 'x');

		store1.add('foo', 'b');
		store1.add('bar', 'y');

		expect(store1.get('foo'), equals(['a', 'b']));
		expect(store1.get('bar'), equals(['y']));
		expect(store2.get('foo'), equals(['a', 'c']));
		expect(store2.get('bar'), equals(['x']));
	},

	'freeze prevents further manipulation'() {
		const store = new ExtensionStore();
		store.add('foo', 'a');
		store.freeze();

		expect(() => store.add('foo', 'b'), throws());
		expect(() => store.add('bar', 'b'), throws());

		expect(store.get('foo'), equals(['a']));
		expect(store.get('bar'), equals([]));
	},
});
