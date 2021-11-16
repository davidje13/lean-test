#!/bin/sh
set -e

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)";

run() {
	cd "$1";
	set +e
	"$BASE_DIR/build/bin/run.mjs" --parallel $2;
	echo "EXIT: $?";
	set -e
	cd - >/dev/null;
}

test() {
	printf "Running test: $1";
	RESULT="$(run "$BASE_DIR/test/$1" "$3" 2>&1 | sed -e 's/[0-9][0-9]*ms/xx/g' -e 's/ *$//')";
	EXPECTED="$(cat "$BASE_DIR/test/$1/${2:-expected.txt}")";
	if [ "$RESULT" != "$EXPECTED" ]; then
		echo " [FAIL]";
		echo "\033[0;31m$RESULT\033[0m" >&2;
		echo;
		echo "Output from $1 did not match expectation";
		exit 1;
	else
		echo " [PASS]";
	fi;
}

echo "Running shell integration tests";
test "discovery";
test "basics";
test "reporting";
test "browser" "expected.txt" --browser=chrome;
test "browser" "expected-ff.txt" --browser=firefox; # firefox stack traces do not handle async chains but are still OK

echo;
echo "Shell integration tests passed";
