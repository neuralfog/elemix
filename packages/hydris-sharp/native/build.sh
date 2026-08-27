#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/quickjs-ng"

if [ ! -d "$SRC" ]; then
    echo "fetching quickjs-ng..."
    git clone --depth 1 https://github.com/quickjs-ng/quickjs "$SRC"
fi

echo "compiling libhydrisqjs.so..."
gcc -shared -fPIC -O2 -o "$HERE/libhydrisqjs.so" \
    "$HERE/hydris_qjs.c" \
    "$SRC/quickjs.c" "$SRC/dtoa.c" "$SRC/libregexp.c" "$SRC/libunicode.c" \
    -I"$SRC" -lm -lpthread

echo "built $HERE/libhydrisqjs.so"
