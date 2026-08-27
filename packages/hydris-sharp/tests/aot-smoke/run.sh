#!/usr/bin/env bash
set -euo pipefail

IMAGE=hydris-aot-smoke
NAME=hydris-aot-smoke-run
PORT=18080
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "building AOT image..."
docker build --no-cache --pull -t "$IMAGE" -f "$ROOT/tests/aot-smoke/Dockerfile" "$ROOT"

echo "starting container..."
docker run -d --name "$NAME" -p "$PORT:8080" "$IMAGE" >/dev/null

echo "waiting for the server to answer..."
body=""
for _ in $(seq 1 30); do
    if body="$(curl -fsS "http://localhost:$PORT/" 2>/dev/null)"; then
        break
    fi
    sleep 1
done

echo "response body: ${body:-<none>}"

if printf '%s' "${body:-}" | grep -q "Hello, World!"; then
    echo "PASS"
    exit 0
fi

echo "FAIL"
docker logs "$NAME" 2>&1 | tail -30 || true
exit 1
