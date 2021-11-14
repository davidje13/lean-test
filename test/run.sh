#!/bin/sh
set -e

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)";

run() {
	cd "$1";
	set +e
	"$BASE_DIR/build/bin/run.mjs" --parallel;
	echo "EXIT: $?";
	set -e
	cd - >/dev/null;
}

test() {
	printf "Running test: $1";
	RESULT="$(run "$BASE_DIR/test/$1" 2>&1 | sed -e 's/[0-9][0-9]*ms/xx/g' -e 's/ *$//')";
	EXPECTED="$(cat "$BASE_DIR/test/$1/expected.txt")";
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

echo;
echo "Shell integration tests passed";
