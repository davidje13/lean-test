# Lean-Test

A testing framework for when you want to test without adding hundreds of dependencies.

## Features

- Run tests from the commandline against NodeJS and/or browsers;
- Natively supports ES6 modules and promises (`async` tests);
- Fluent and matcher-style expectations, easy to add custom matchers;
- Parallel test running;
- Low overhead (fast tests);
- No dependencies;
- Highly extensible plugin and reporter architecture:
	- `stdout` / `stderr` / `console` capturing
	- lifecycle methods (`beforeAll` / `beforeEach` / `afterEach` / `afterAll`)
	- repeated tests, failure tolerance;
	- auto retry failing tests
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
	it('does another thing', () => {
		expect(3 * 3).equals(9); // fluent-style
	});

	it('does something', () => {
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

### Fail

```javascript
fail();
fail('message');
```

Throws a `TestAssertionError` (marking the test as failed).

### Skip

```javascript
skip();
skip('message');
```

Throws a `TestAssumptionError` (marking the test as skipped).

### Expect

```javascript
expect(2, equals(2));
expect(2).equals(2);
```

Checks a condition, throwing a `TestAssertionError` if it fails (marking the test as
failed).

### Assume

```javascript
assume(2, equals(2));
assume(2).equals(2);
```

Checks a condition, throwing a `TestAssumptionError` if it fails (marking the test as
skipped). Can use all the same matchers as `expect`.

### ExtendExpect

```javascript
const isSeven = () => (actual) => {
	if (actual === 7) {
		return {
			success: true,
			message: 'Expected value not to be 7, but was.',
		};
	} else {
		return {
			success: false,
			message: `Expected 7, but got ${actual}.`,
		};
	}
};

// can be used matcher-style immediately:
expect(7, isSeven());

// use extendExpect to allow use fluent-style:
extendExpect({ isSeven });
// ...
expect(7).isSeven();
```

Globally registers new fluent checks.

### Get stdout / stderr

```javascript
const textStdout = getStdout();
const textStderr = getStderr();
const binaryValue = getStdout(true);
```

Returns the content of `stdout` / `stderr` captured from the current test so far.

Note that these are only available when running in NodeJS. When running in a browser,
no methods are currently available to check logged items.

Also note that these may not capture all content; the capturing relies on inspecting
stack traces, which will not work inside event callbacks such as `setTimeout` etc.

In NodeJS, `console.*` will produce content in `stdout`.

### Ignore

```javascript
it.ignore('will not run', () => { /* ... */ });

describe.ignore('will not run', () => { /* ... */ });

it('will not run', () => { /* ... */ }, { ignore: true });

describe('will not run', () => { /* ... */ }, { ignore: true });
```

Ignores a test or block. This will be reported as a skipped test.

### Focus

```javascript
it.focus('only this will run', () => { /* ... */ });

describe.focus('only this will run', () => { /* ... */ });

it('only this will run', () => { /* ... */ }, { focus: true });

describe('only this will run', () => { /* ... */ }, { focus: true });
```

Focuses a test or block. If any tests or blocks are focused, only the marked tests
will run, and the rest will be reported as skipped.

### Repeat

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

### Retry

```javascript
it('will retry on failure', () => { /* ... */ }, { retry: 3 });
```

Runs a test multiple times until it succeeds. If any attempt succeeds, the test is
considered a success.

### Timeout

```javascript
it('will time out', () => { /* ... */ }, { timeout: 1000 });
```

Fails the test if it takes longer than the configured time (in milliseconds) to run.

Note that this will not be able to prevent "busy loops" such as `while (true) {}`,
and will not terminate tasks which are running (so the test code may continue to
execute even though the timeout has triggered), but any further exceptions will be
ignored.

### Stop at First Failure

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
are defined. Nested blocks will be executed from outermost to innermost for `begin`, and
innermost to outermost for `after`.

All methods can be asynchronous.

`begin` hooks can also return a function which will act like a corresponding `after`
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

## Standard Matchers

- `equals(value)`:<br>
	Recursively checks for equality.

- `same(value)`:<br>
	Checks strict (`===`) identity.

- `not(expectation)`:<br>
	Negates another matcher.<br>
	e.g. `expect(7, not(equals(4)))`

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

## CLI flags

The `lean-test` executable can be configured in various ways:

- `--browser <name>` / `-b <name>` / environment `BROWSER=<name>`:<br>
	Runs the tests in a browser. Currently `chrome` and `firefox` are supported, or use
	`manual` then open the printed URL in any browser to start the tests.

	You can also use a WebDriver-compatible server (e.g. Selenium) by setting the
	`WEBDRIVER_HOST` environment variable, or `WEBDRIVER_HOST_<BROWSER>` to set it for
	a specific browser. For example:

	```sh
	# alternatively this could be a grid, for example
	docker run -d -p 4444:4444 --shm-size="2g" selenium/standalone-chrome
	export WEBDRIVER_HOST=localhost:4444
	lean-test --browser=chrome
	```

	```sh
	docker run -d -p 4444:4444 --shm-size="2g" selenium/standalone-chrome
	docker run -d -p 4445:4444 --shm-size="2g" selenium/standalone-firefox
	export WEBDRIVER_HOST_CHROME=localhost:4444
	export WEBDRIVER_HOST_FIREFOX=localhost:4445
	lean-test --browser=chrome && lean-test --browser=firefox
	```

	If you are using a remote browser, you will also need to set
	`--host 0.0.0.0` (or equivalently `TESTRUNNER_HOST=0.0.0.0`) so that the test server
	is accessible to the browser.

- `--port <number>` / environment `TESTRUNNER_PORT=<number>`:<br>
	Sets an explicit port number for the browser-based tests to use. By default this is
	`0` (pick random available port). This only takes effect if `--browser` is used.

- `--host <name>` / environment `TESTRUNNER_HOST=<name>`:<br>
	Sets an explicit host name for the browser-based tests to use. By default this is
	`127.0.0.1` (local loopback). This only takes effect if `--browser` is used.
	You may want to change this setting if you need to run tests in a browser running on a
	different computer on the same network (e.g. by specifying `0.0.0.0` to make it
	available over the network).

- `--parallel-suites` / `--parallel` / `-p` / environment `PARALLEL_SUITES=true`:<br>
	Runs test suites in parallel. This is generally recommended unless the code being
	tested may cause tests in different files to interfere with each other (e.g. uses
	singletons or global state).

- `--include <pattern>` / `-i <pattern>`:<br>
	Configures the search pattern glob. Can be set multiple times. By default, this is
	`**/*.{spec|test}.{js|mjs|jsx}`.

- `--exclude <pattern>` / `-x <pattern>`:<br>
	Configures the exclusion pattern glob. Can be set multiple times. By default, this is
	`**/node_modules` and `**/.*`.

- `--parallel-discovery` / `-P` / environment `PARALLEL_DISCOVERY=true`:<br>
	Runs test discovery in parallel. This may be slightly faster than the default
	(synchronous) discovery, but may fail with an error depending on the environment
	and the test complexity.

After the flags, you can provide one or more directories which will be used as starting
points for scanning for tests (by default the current working directory is used).

Example:

```sh
# Run all js/mjs files in the 'tests' folder, using Chrome:
lean-test --parallel --browser chrome -i '**/*.{js|mjs}' tests
```

## CI Examples for Browser testing

These examples assume that `package.json` contains something like:

```json
{
  "scripts": {
    "test": "lean-test --browser=chrome && lean-test --browser=firefox"
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
