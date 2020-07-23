#!/bin/bash

die() {
  echo "$1"
  exit 1
}

cp ./dist/secure-proxy.xpi /tmp || die "Failed to copy the extension to /tmp"

cd /tmp || die "At least /tmp should exist!"

if ! [ -e "/tmp/firefox/firefox" ]; then
  wget https://ftp.mozilla.org/pub/firefox/nightly/2020/07/2020-07-23-09-56-57-mozilla-central/firefox-80.0a1.en-US.linux-x86_64.tar.bz2 -O /tmp/firefox.tar.bz2 || die "Failed to download firefox"
  tar xvf /tmp/firefox.tar.bz2 || die "Failed to untar firefox"
fi

if ! [ -e "/tmp/geckodriver" ]; then
  wget https://github.com/mozilla/geckodriver/releases/download/v0.26.0/geckodriver-v0.26.0-linux64.tar.gz -O geckodriver.tar.gz || die "Failed to download geckodriver"
  tar xvf geckodriver.tar.gz || die "Failed to untar geckodirver"
fi

sudo apt-get install -y \
	libgtk-3-0 \
	libdbus-glib-1-2 \
	--no-install-recommends
