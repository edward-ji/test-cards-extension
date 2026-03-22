#!/usr/bin/env bash
set -euo pipefail

# Detect container runtime (docker or podman)
if command -v docker &>/dev/null; then
    RUNTIME=docker
elif command -v podman &>/dev/null; then
    RUNTIME=podman
else
    echo "Error: neither docker nor podman found" >&2
    exit 1
fi

PW_VERSION=$(node -e "console.log(require('./node_modules/@playwright/test/package.json').version)")
IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-noble"
EXTRA_ARGS="${*}"

$RUNTIME run --rm \
    -v "$(pwd):/work:z" \
    -w /work \
    --shm-size=1gb \
    "$IMAGE" \
    bash -c "
        set -e
        npm ci
        npm run build
        npx playwright test ${EXTRA_ARGS}
    "
