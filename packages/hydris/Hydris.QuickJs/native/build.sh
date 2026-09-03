#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../../Vendor/quickjs-ng/0.16.2"
MI="$HERE/../../Vendor/mimalloc/3.5.1"
RUNTIMES="$HERE/runtimes"

if [ ! -d "$SRC" ]; then
    echo "vendored quickjs-ng not found at $SRC" >&2
    exit 1
fi

if [ ! -d "$MI" ]; then
    echo "vendored mimalloc not found at $MI" >&2
    exit 1
fi

if ! command -v zig >/dev/null 2>&1; then
    echo "zig not found on PATH - install from https://ziglang.org/download (0.16.0+)" >&2
    exit 1
fi

SHIM="$HERE/hydris_qjs.c"
QJS=("$SRC/quickjs.c" "$SRC/dtoa.c" "$SRC/libregexp.c" "$SRC/libunicode.c" "$MI/src/static.c")

ALL_RIDS=(
    linux-x64 linux-arm64
    linux-musl-x64 linux-musl-arm64
    osx-x64 osx-arm64
    win-x64 win-arm64
)

target_for() {
    case "$1" in
        linux-x64)        echo "x86_64-linux-gnu.2.17 libhydrisqjs.so" ;;
        linux-arm64)      echo "aarch64-linux-gnu.2.17 libhydrisqjs.so" ;;
        linux-musl-x64)   echo "x86_64-linux-musl libhydrisqjs.so" ;;
        linux-musl-arm64) echo "aarch64-linux-musl libhydrisqjs.so" ;;
        osx-x64)          echo "x86_64-macos libhydrisqjs.dylib" ;;
        osx-arm64)        echo "aarch64-macos libhydrisqjs.dylib" ;;
        win-x64)          echo "x86_64-windows-gnu hydrisqjs.dll" ;;
        win-arm64)        echo "aarch64-windows-gnu hydrisqjs.dll" ;;
        *)                echo "" ;;
    esac
}

build_one() {
    local rid="$1"
    local spec triple lib out libs
    spec="$(target_for "$rid")"
    if [ -z "$spec" ]; then
        echo "unknown rid: $rid (expected one of: ${ALL_RIDS[*]})" >&2
        exit 1
    fi
    triple="${spec%% *}"
    lib="${spec##* }"
    out="$RUNTIMES/$rid/native"
    libs=(-lm)
    case "$rid" in
        linux*) libs+=(-lpthread) ;;
    esac
    mkdir -p "$out"
    echo "building $rid ($triple) -> runtimes/$rid/native/$lib"
    zig cc -target "$triple" -shared -fPIC -O2 -DNDEBUG -fno-semantic-interposition \
        -o "$out/$lib" \
        "$SHIM" "${QJS[@]}" \
        -I"$SRC" -I"$MI/include" "${libs[@]}"
    find "$out" -type f ! -name "$lib" -delete
}

case "${1:-}" in
    "") for rid in "${ALL_RIDS[@]}"; do build_one "$rid"; done ;;
    *)  build_one "$1" ;;
esac
