#!/bin/sh

. _build/prebuild.sh
node --enable-source-maps _build/run_release.js integrate "$@"