#!/bin/bash

. tests/common.sh

# Here are the basic checks.
printn G "Preparing the environment... "
eno cd tests || die "Failed to change dir to 'tests'"
[ -z "`command -v hg`" ] && die "Mericurial is needed"
print Y "done!"

# Download/update central.
if [ -d m-c ]; then
  eno cd m-c || die "Failed to change dir to m-c"

  # If the mochitest dir has been symlinked, remove it as revert
  # does not follow symlinks.
  if [ -h "devtools/secure-proxy" ];then
     eno rm "devtools/secure-proxy" || die "Failed to remove secure-proxy tests"
     eno hg revert -C "devtools/moz.build" || die "Failed to revert devtools changes"
  fi

  if [ -n "`hg status`" ]; then
    read -p "There are local changes to Firefox which will be overwritten. Are you sure? [Y/n] " -r
    if [[ $REPLY == "n" ]]; then
      exit 0;
    fi

    eno hg revert -a -C || die "Failed to revert local changes in m-c."
  fi

  hg pull
  hg update -C
else
  print G "Downloading Firefox source code, requires about 10-30min depending on connection"

  hg clone https://hg.mozilla.org/mozilla-central/ m-c
  # if somebody cancels (ctrl-c) out of the long download don't continue
  if [ $? -ne 0 ]; then
    exit 1;
  fi

  eno cd m-c || die "Failed to change dir to m-c"
fi

printn G "Inject secure-proxy tests into devtools folder... "
ln -s `pwd`/../mochitests devtools/secure-proxy || die "Failed to create a symlink"
print Y "done!"

MOZBUILD=$(cat devtools/moz.build | grep -v secure-proxy)
echo "$MOZBUILD
DIRS += ['secure-proxy']
" > devtools/moz.build

print G "Build firefox... "

echo "
ac_add_options --enable-artifact-builds
mk_add_options MOZ_OBJDIR=./objdir-frontend
mk_add_options AUTOCLOBBER=1
" > .mozconfig

mach build
