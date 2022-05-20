# Lean-Test

A testing framework for when you want to test without adding hundreds of dependencies.

Runs tests in NodeJS and/or in browsers.

### Running in NodeJS

```sh
npx lean-test
```

### Running in browsers

```sh
npx lean-test --target chrome --target firefox
```

## Features

- Run tests from the commandline against NodeJS and/or browsers;
- Natively supports ES6 modules and promises (`async` tests);
- Transpile source with your chosen tooling before running;
- Fluent and matcher-style expectations, easy to add custom matchers;
- Parallel test running;
- Low overhead (fast tests);
- No dependencies;
- Highly extensible plugin and reporter architecture:
	- `stdout` / `stderr` / `console` capturing
	- lifecycle methods (`beforeAll` / `beforeEach` / `afterEach` / `afterAll`)
	- repeated tests, failure tolerance;
	- auto retry failing tests
	- parameterised tests
	- sequential test execution with stop at first failure (for flow testing)
	- configurable test timeout

## Usage

Install with:

```sh
npm install --save-dev lean-test
```

Or run without installing:

```sh
npx lean-test
```

Automatically discovers all `.test.js` / `.spec.js` (and `.mjs`) files by default.

Tests can be writen in a variety of ways; the classic "globals" approach:

```javascript
// myThing.spec.mjs

describe('my thing', () => {
	it('does something', () => {
		expect(3 * 3).equals(9); // fluent-style
	});

	it('does another thing', () => {
		expect(2 + 2, equals(4)); // matcher-style
	});

	it('does a thing with promises', async () => {
		const value = await Promise.resolve(7);
		expect(value, equals(7));
	});
});
```

Or with shorthand `describe` syntax:

```javascript
// myThing.spec.mjs

describe('my other thing', {
	'does stuff'() {
		expect(2 + 2, equals(4));
	},

	async 'does async stuff'() {
		const value = await Promise.resolve(7);
		expect(value, equals(7));
	},

	'sub-block': {
		'more stuff'() {
			expect(1 * 2, isGreaterThan(1));
		},
	},
});
```

Or if you prefer, you can avoid globals by using the `export` approach:

```javascript
// myThing.spec.mjs

export default ({ describe, it, expect, equals }) => {
	describe('my thing', () => {
		it('does a thing', () => {
			expect(3 * 3, equals(9));
		});
	});
};
```

Or with shorthand `describe` syntax:

```javascript
// myThing.spec.mjs

export default ({ describe, expect }) => describe('my thing', {
	'does a thing'() {
		expect(3 * 3).equals(9);
	},
});
```

## Features

Most features are provided by plugins. The standard plugins are enabled by default, and
offer the following features. You can also create your own plugins if you have bespoke
needs.

### fail

```javascript
fail();
fail('message');
```

Throws a `TestAssertionError` (marking the test as failed).

### skip

```javascript
skip();
skip('message');
```

Throws a `TestAssumptionError` (marking the test as skipped).

### expect

```javascript
expect(2, equals(2));
expect(2).equals(2);
```

Checks a condition, throwing a `TestAssertionError` if it fails (marking the test as
failed).

### assume

```javascript
assume(2, equals(2));
assume(2).equals(2);
```

Checks a condition, throwing a `TestAssumptionError` if it fails (marking the test as
skipped). Can use all the same matchers as `expect`.

### expect.extend

```javascript
const isSeven = () => (actual) => {
	if (actual === 7) {
		return {
			pass: true,
			message: 'Expected value not to be 7, but was.',
		};
	} else {
		return {
			pass: false,
			message: `Expected 7, but got ${actual}.`,
		};
	}
};

// can be used matcher-style immediately:
expect(7, isSeven());

// use expect.extend to allow use fluent-style:
expect.extend({ isSeven });
// ...
expect(7).isSeven();
```

Globally registers new fluent checks.

### mock

```javascript
// create a mocked function
const mockedFunc = mock();
const namedMockFunc = mock('my mock');

// spy on existing methods
const spyLog = mock(console, 'log');

// configure behaviour
const myMock = mock()
	.whenCalledWith(1, 'foo').thenReturn(10)
	.whenCalledWith(greaterThan(5)).thenThrow(new Error('too much!'));
```

Creates a mock function, or spies on an existing method.

Mocked functions can be configured to return specific values when invoked,
and can be checked to see if they were called with particular arguments (see
`hasBeenCalled` / `hasBeenCalledWith` below).

The extra methods available on mocks and spies are:

- `whenCalled()`:<br>
	Begins a context for configuring behaviour when the function is called.
	The returned object has several fluent-API methods:

	- `with(...arguments)`:<br>
		Filters for invocations with matching arguments (can be literal values,
		matchers, or a combination). By default, the arguments are not checked.

	- `times(n)`:<br>
		Limits the current configuration to a fixed number of invocations, after
		which it is removed. This can be useful for configuring return values which
		change in subsequent invocations. By default, there is no limit.

	- `once()`:<br>
		Shorthand for `.times(1)`.

	- `then(func)`:<br>
		Configures the mock to invoke the given function when an invocation matches
		the current configuration. The function will be called with all provided
		arguments, and its return value will be returned, so this acts as a
		pass-through.
		As a convenience, this returns the original mock function, so multiple
		configurations can be chained easily.

	- `thenReturn(value)`:<br>
		Shorthand for `.then(() => value)`

	- `thenThrow(error)`:<br>
		Shorthand for `.then(() => { throw error; })`

	- `thenResolve(value)`:<br>
		Shorthand for `.thenReturn(Promise.resolve(value))`

	- `thenReject(error)`:<br>
		Shorthand for `.thenReturn(Promise.reject(error))`

	- `thenCallThrough()`:<br>
		Configures the spy to invoke the original method when an invocation matches
		the current configuration. This is the default for spies.
		As a convenience, this returns the original mock function, so multiple
		configurations can be chained easily.

- `whenCalledWith(...arguments)`:<br>
	Shorthand for `.whenCalled().with(...arguments)`.

- `whenCalledNext()`:<br>
	Shorthand for `.whenCalled().times(1)`.

- `returning(value)`:<br>
	Shorthand for `.whenCalled().thenReturn(value)`.

- `throwing(error)`:<br>
	Shorthand for `.whenCalled().thenThrow(error)`.

- `reset()`:<br>
	Resets the mock configuration and recorded invocations.

- `revert()`:<br>
	Removes the spy, returning the original function (note that this only exists
	for spies; it does not exist for mock functions).

If multiple `whenCalled*` configurations match an invocation, the first one is
chosen. For example:

```javascript
const fn = mock('my mocked function')
	.whenCalledWith(greaterThan(2)).once().thenReturn('a')
	.whenCalledWith(lessThan(6)).thenReturn('b')
	.whenCalled().thenReturn('c');

fn(1); // b ('b' and 'c' match, so first is chosen)
fn(4); // a (all match, so first is chosen)
fn(4); // b ('a' has been used and was configured to only apply once)
fn(8); // c
```

### getStdout / getStderr / getOutput

```javascript
const textStdout = getStdout();
const textStderr = getStderr();
const binaryValue = getStdout(true);

const allOutput = getOutput();
```

Returns the content of `stdout` / `stderr` captured from the current test so far.
`getOutput` returns all content to both `stdout` and `stderr` in the order it was
written.

In the browser, only `getOutput()` is available, which returns all content printed
to the console as a string. Note that the exact format of logged content is not
guaranteed (in particular, the format of printed objects may vary and the output
may include ANSI escape sequences for setting colours).

Also note that these may not capture all content; the capturing relies on inspecting
stack traces, which will not work inside event callbacks such as `setTimeout` etc.

In NodeJS, `console.*` will produce content in `stdout`.

### ignore

```javascript
it.ignore('will not run', () => { /* ... */ });

describe.ignore('will not run', () => { /* ... */ });

it('will not run', () => { /* ... */ }, { ignore: true });

describe('will not run', () => { /* ... */ }, { ignore: true });
```

Ignores a test or block. This will be reported as a skipped test.

### focus

```javascript
it.focus('only this will run', () => { /* ... */ });

describe.focus('only this will run', () => { /* ... */ });

it('only this will run', () => { /* ... */ }, { focus: true });

describe('only this will run', () => { /* ... */ }, { focus: true });
```

Focuses a test or block. If any tests or blocks are focused, only the marked tests
will run, and the rest will be reported as skipped.

### repeat

```javascript
it('will run multiple times', () => { /* ... */ }, { repeat: 3 });
```

Runs a test multiple times, expecting every run to succeed. Can also be configured with
a failure tolerance:

```javascript
it('will run multiple times', () => {
	// ...
}, { repeat: { total: 3, maxFailures: 1 } });
```

### retry

```javascript
it('will retry on failure', () => { /* ... */ }, { retry: 3 });
```

Runs a test multiple times until it succeeds. If any attempt succeeds, the test is
considered a success.

### parameters

```javascript
it('will run with multiple parameters', (v) => { /* ... */ }, { parameters: [1, 2] });
```

Runs a test multiple times with different parameters. There are a variety of ways
to set parameters:

```javascript
// call with (1), (2):
{ parameters: [1, 2] }

// multiple parameters:
// call with (1, 2), (3, 4):
{ parameters: [[1, 2], [3, 4]] }

// parameter matrix:
// call with (1, 3), (1, 4), (2, 3), (2, 4):
{ parameters: [new Set([1, 2]), new Set([3, 4])] }

// parameter matrix with multiple parameters:
// call with (1, 'a', 3), (1, 'a', 4), (2, 'b', 3), (2, 'b', 4):
{ parameters: [new Set([[1, 'a'], [2, 'b']]), new Set([3, 4])] }
```

You can also set a `parameterFilter` to exclude specific combinations of
parameters:

```javascript
// parameter matrix with filter:
// call with (1, 2), (1, 3), (2, 1), (2, 3), (3, 1), (3, 2):
{
	parameters: [new Set([1, 2, 3]), new Set([1, 2, 3])],
	// do not allow both parameters set to the same value
	parameterFilter: (a, b) => (a !== b),
}
```

### timeout

```javascript
it('will time out', () => { /* ... */ }, { timeout: 1000 });
```

Fails the test if it takes longer than the configured time (in milliseconds) to run.

Note that this will not be able to prevent "busy loops" such as `while (true) {}`,
and will not terminate tasks which are running (so the test code may continue to
execute even though the timeout has triggered), but any further exceptions will be
ignored.

### stopAtFirstFailure

```javascript
describe('my flow test', () => {
	// tests here
}, { stopAtFirstFailure: true });
```

Stops executing tests within the current block if one fails (subsequent tests will be
marked as skipped).

### Lifecycle Hooks

```javascript
describe('lifecycle', () => {
	beforeAll('optional name', () => {
		// ...
	});

	beforeEach('optional name', () => {
		// ...
	});

	afterEach('optional name', () => {
		// ...
	});

	afterAll('optional name', () => {
		// ...
	});

	// tests here
});
```

Registers execution listeners which will run before and after the whole block, or before
and after each test within the block. Multiple hooks will be executed in the order they
are defined. Nested blocks will be executed from outermost to innermost for `before`, and
innermost to outermost for `after`.

All methods can be asynchronous.

`before` hooks can also return a function which will act like a corresponding `after`
hook:

```javascript
describe('lifecycle', () => {
	let server;

	beforeAll('launch server', async () => {
		server = await runServer();

		// teardown:
		return async () => {
			await server.close();
		};
	});

	// tests here
});
```

You can also add test parameters from a `beforeAll` or `beforeEach` hook.
These parameters will be available to all tests which are inside the hook's
scope.

```javascript
describe('lifecycle', () => {
	beforeEach('launch server', async ({ addTestParameter }) => {
		const server = await runServer();
		addTestParameter(server);

		return () => server.close();
	});

	it('does a thing', (server) => {
		server.get('foobar');
		// ...
	});
});
```

This pattern can be useful for fully decoupling tests from global state, allowing
them to run in parallel.

## Standard Matchers

- `equals(value)`:<br>
	Recursively checks for equality.

- `same(value)`:<br>
	Checks strict (`===`) identity.

- `not(expectation)`:<br>
	Negates another matcher.<br>
	e.g. `expect(7, not(equals(4)))`

- `any()`:<br>
	Always matches. The negation `not(any())` always fails. Useful as a sub-matcher.

- `withMessage(message, expectation)`:<br>
	Customises the error message of another matcher.<br>
	e.g. `expect(7, withMessage('hmm, not 7', equals(7)))`

- `isTrue()`:<br>
	Checks if `=== true`.

- `isFalse()`:<br>
	Checks if `=== false`.

- `isTruthy()`:<br>
	Checks if the value is truthy (`Boolean(value) === true`).

- `isFalsy()`:<br>
	Checks if the value is falsy (`Boolean(value) === false`).

- `isNull()`:<br>
	Checks if `=== null`.

- `isUndefined()`:<br>
	Checks if `=== undefined`.

- `isNullish()`:<br>
	Checks if the value is nullish `value === null || value === undefined`.

- `isGreaterThan(value)`:<br>
	Checks if `> value`.

- `isLessThan(value)`:<br>
	Checks if `< value`.

- `isGreaterThanOrEqual(value)`:<br>
	Checks if `>= value`.

- `isLessThanOrEqual(value)`:<br>
	Checks if `<= value`.

- `isNear(value[, precision])`:<br>
	Checks if near `value`. By default, the comparison checks to 2 decimal places, but
	you can configure this by providing an explicit precision. The types of precision
	supported are:
	- `{ tolerance: n }` sets an explicit permitted range (+/- `n`)
	- `{ decimalPlaces: n }` sets an explicit number of decimal places to check
		(+/- `0.5 * 10^-n`)

- `resolves(expectation)`:<br>
	Checks if the given function or promise returns a value which matches the given
	expectation (sub-matcher). `expectation` can also be a literal value, in which case
	it behaves as if `equals(expectation)` were used. If no `expectation` is given, this
	just checks that the funtion returns (does not throw).

	Note that if promises are involved, the `expect` call should be awaited:

	```javascript
	await expect(myPromise, resolves(equals(7)));
	```

- `throws(expectation)`:<br>
	Checks if the given function or promise throws a value which matches the given
	expectation (sub-matcher). `expectation` can also be a literal string, in which case
	it checks if the thrown `Error` message contains the given string. If no `expectation`
	is given, this just checks that the funtion throws.

	Note that if promises are involved, the `expect` call should be awaited:

	```javascript
	await expect(myPromise, throws('oops'));
	```

- `hasLength(expectation)`:<br>
	Checks if the value (an array, `Set`, `Map`, etc.) has a length matching the given
	expectation (sub-matcher). `expectation` can also be a literal number, in which case
	it behaves as if `equals(expectation)` were used. If no `expectation` is given, this
	just checks that the value has a `length` or `size` property.

- `isEmpty()`:<br>
	Checks if the value (an array, `Set`, `Map`, etc.) has no items.

- `contains(sub)`:<br>
	Checks if the value (a string, array, or `Set`) contains the given substring or
	sub-element.

- `isListOf(...elements)`:<br>
	Checks if the value contains the given elements in the listed order. Elements can be
	literal or matchers (these can be mixed).

- `hasProperty(name[, expectation])`:<br>
	Checks if the value (any type) contains a property of the given name, optionally
	matching the given expectation. If no `expectation` is given, this just checks that
	the property exists on the object (using `hasOwnProperty`).

- `hasBeenCalled()`:<br>
	Checks that a mocked function has been invoked since being mocked.

- `hasBeenCalledWith(...arguments)`:<br>
	Checks that a mocked function has been invoked since being mocked, with the given
	arguments (which can be literal, matchers, or a mix).

## CLI flags

The `lean-test` executable can be configured in various ways:

- `--preprocess <tool>` / `-c <tool>`:<br>
	Applies the specified tool as a preprocessor for all source files (excluding
	`node_modules` sources).

	Current supported tooling:
	- `babel`:<br>
		The Babel transpiler. Looks for a `babel.config.*` or `.babelrc.*` file, or the
		`babel` section of a `package.json` for configuration.
		Requires `babel` (`npm install --save-dev @babel/core`).

	- `tsc`:<br>
		The Typescript transpiler. Looks for a `tsconfig.json` file for configuration.
		Requires `typescript` (`npm install --save-dev typescript`).

- `--target <name>` / `-t <name>` / environment `TARGET=<name>`:<br>
	Runs the tests in the chosen target. Currently `node`, `chrome` and `firefox` are
	supported, or use `url` then open the printed URL in any browser to start the tests.

	You can also use a WebDriver-compatible server (e.g. Selenium) by setting the
	`WEBDRIVER_HOST` environment variable, or `WEBDRIVER_HOST_<BROWSER>` to set it for
	a specific browser. For example:

	```sh
	# alternatively this could be a grid, for example
	docker run -d -p 4444:4444 --shm-size="2g" selenium/standalone-chrome
	export WEBDRIVER_HOST=localhost:4444
	lean-test --target=chrome
	```

	```sh
	docker run -d -p 4444:4444 --shm-size="2g" selenium/standalone-chrome
	docker run -d -p 4445:4444 --shm-size="2g" selenium/standalone-firefox
	export WEBDRIVER_HOST_CHROME=localhost:4444
	export WEBDRIVER_HOST_FIREFOX=localhost:4445
	lean-test --target=chrome --target=firefox
	```

	If you are using a remote browser, you will also need to set
	`--host 0.0.0.0` (or equivalently `TESTRUNNER_HOST=0.0.0.0`) so that the test server
	is accessible to the browser.

	If you specify more than one target, the tests will be run in all targets in
	parallel, with the results containing one section per target:

	```sh
	lean-test --target=node,chrome,firefox
	# or
	lean-test --target node --target chrome --target firefox
	```

- `--port <number>` / environment `TESTRUNNER_PORT=<number>`:<br>
	Sets an explicit port number for the browser-based tests to use. By default this is
	`0` (pick random available port). This only takes effect if the tests are running in a
	browser.

- `--host <name>` / environment `TESTRUNNER_HOST=<name>`:<br>
	Sets an explicit host name for the browser-based tests to use. By default this is
	`127.0.0.1` (local loopback). This only takes effect if the tests are running in a
	browser.
	You may want to change this setting if you need to run tests in a browser running on a
	different computer on the same network (e.g. by specifying `0.0.0.0` to make it
	available over the network).

- `--import-map` / environment `IMPORT_MAP=true`:<br>
	Generates an [import map](https://github.com/WICG/import-maps) for `node_modules`
	imports. This only takes effect if the tests are running in a browser.
	This allows non-relative imports like `import foo from 'foo';`, which will be
	resolved by looking in `node_modules`, which means some projects can be tested
	without needing a compilation / transpilation stage.
	Note that import maps are currently only supported by Chrome, but Firefox is also
	considering implementing them.

- `--parallel-suites` / `--parallel` / `-p` / environment `PARALLEL_SUITES=true`:<br>
	Runs test suites in parallel. This is generally recommended unless the code being
	tested may cause tests in different files to interfere with each other (e.g. uses
	singletons or global state).

- `--include <pattern>` / `-i <pattern>`:<br>
	Configures the search pattern glob. Can be set multiple times. By default, this is
	`**/*.{spec|test}.*`.

- `--exclude <pattern>` / `-x <pattern>`:<br>
	Configures the exclusion pattern glob. Can be set multiple times.
	Note that `**/node_modules` and `**/.*` will always be excluded unless
	`--no-default-exclude` is specified.

- `--no-default-exclude`:<br>
	By default, `**/node_modules` and `**/.*` are always excluded. Setting this flag
	allows them.

- `--parallel-discovery` / `-P` / environment `PARALLEL_DISCOVERY=true`:<br>
	Runs test discovery in parallel. This may be slightly faster than the default
	(synchronous) discovery, but may fail with an error depending on the environment
	and the test complexity.

After the flags, you can provide one or more directories which will be used as starting
points for scanning for tests (by default the current working directory is used).

Example:

```sh
# Run all js/mjs files in the 'tests' folder, using Chrome:
lean-test --parallel --target chrome -i '**/*.{js|mjs}' tests
```

## CI Examples for Browser testing

These examples assume that `package.json` contains something like:

```json
{
  "scripts": {
    "test": "lean-test --target=chrome,firefox"
  }
}
```

### GitLab CI/CD

```yaml
build_and_test:
  image: node:16
  services:
  - name: selenium/standalone-firefox
    alias: firefox
  - name: selenium/standalone-chrome
    alias: chrome
  variables:
    WEBDRIVER_HOST_CHROME: chrome:4444
    WEBDRIVER_HOST_FIREFOX: firefox:4444
    TESTRUNNER_HOST: '0.0.0.0'
  script:
  - npm install-test
```

### GitHub Actions

```yaml
name: Test
on: [push]

jobs:
  build_and_test:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout
      uses: actions/checkout@v2
    - name: Install Node
      uses: actions/setup-node@v2
      with:
        node-version: '16'
    - name: Test
      run: npm install-test
```
