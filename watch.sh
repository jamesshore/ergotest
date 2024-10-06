#!/bin/sh

. _build/prebuild.sh
while node --enable-source-maps _build/watch.mjs "$@"; do
	echo "Restarting..."
  . _build/prebuild.sh
done
