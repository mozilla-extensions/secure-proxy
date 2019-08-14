#!/bin/bash

. tests/common.sh

printn G "Creating the XPI file... "
eno web-ext build --overwrite-dest || die "Failed to execute 'web-ext build"
XPI=dist/firefox_private_network-$(cat src/manifest.json | grep \"version\" |  cut -d\" -f4).zip
[ -f "$XPI" ] || die "Unable to find file $XPI"
print Y "$XPI"

printn G "Move the XPI in /tmp... "
eno mv "$XPI" /tmp/secure-proxy-test.xpi || die "Failed to move the XPI into /tmp"
print Y "done!"

printn G "Checking environment... "
eno cd tests/m-c || die "Failed to change dir to 'tests/m-c'. Have you executed 'npm run prepare-test-env' ?"
print Y "done!"

print G "Run mochitests..."
mach mochitest devtools/secure-proxy
