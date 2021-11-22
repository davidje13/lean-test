#!/bin/sh
set -e

echo "Running package test...";
echo;

BASE_DIR="$(cd "$(dirname "$0")/.."; pwd)";
cd "$BASE_DIR";
rm /lean-test-*.tgz 2>/dev/null || true;
npm pack;
rm test/package/lean-test-*.tgz 2>/dev/null || true;
mv lean-test-*.tgz test/package/;
cd - >/dev/null;

cd "$BASE_DIR/test/package";
rm -rf node_modules || true;
npm install --save-dev lean-test-*.tgz --audit=false;
rm lean-test-*.tgz || true;
npm test;
cd - >/dev/null;

echo;
echo "Package test complete";
echo;
