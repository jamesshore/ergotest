#!/bin/sh

. _build/prebuild.sh
while node --enable-source-maps _build/watch.js "$@"; do
	tput setaf 6
	echo "*** Restarting..."
  . _build/prebuild.sh
done
