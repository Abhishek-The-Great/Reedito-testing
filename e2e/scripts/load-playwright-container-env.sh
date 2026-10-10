#!/usr/bin/env bash

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    echo "This script must be sourced, not executed" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

PLAYWRIGHT_VERSION="$(cd e2e && node -p "require('@playwright/test/package.json').version")"

# Prefer the slim, Chromium-only runner image built by this repository's
# .github/workflows/e2e-runner-image.yml in GitHub Actions. Local runs use a
# local image name and fall back to Microsoft's Playwright image when it is absent.
# Callers can pin either via PLAYWRIGHT_RUNNER_IMAGE / PLAYWRIGHT_IMAGE.
if [[ -z "${PLAYWRIGHT_RUNNER_IMAGE:-}" ]]; then
    if [[ -n "${GITHUB_REPOSITORY_OWNER:-}" ]]; then
        IMAGE_OWNER="$(printf '%s' "$GITHUB_REPOSITORY_OWNER" | tr '[:upper:]' '[:lower:]')"
        PLAYWRIGHT_RUNNER_IMAGE="ghcr.io/${IMAGE_OWNER}/reedito-e2e-runner:v${PLAYWRIGHT_VERSION}"
    else
        PLAYWRIGHT_RUNNER_IMAGE="reedito-e2e-runner:local"
    fi
fi
PLAYWRIGHT_FALLBACK_IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"
PLAYWRIGHT_IMAGE="${PLAYWRIGHT_IMAGE:-$PLAYWRIGHT_RUNNER_IMAGE}"
WORKSPACE_PATH="${GITHUB_WORKSPACE:-$REPO_ROOT}"

# Persist the resolved image so the choice survives both a subshell (prepare-ci runs
# this backgrounded) and the CI step boundary — the later run step then reuses the
# already-decided tag instead of re-deriving the fallback and re-pulling.
persist_playwright_image() {
    export PLAYWRIGHT_IMAGE
    if [[ -n "${GITHUB_ENV:-}" ]]; then
        echo "PLAYWRIGHT_IMAGE=${PLAYWRIGHT_IMAGE}" >> "$GITHUB_ENV"
    fi
}

# Ensure $PLAYWRIGHT_IMAGE is present locally, pulling if needed. When the default
# GHCR runner image can't be pulled — a Playwright version bump before the runner
# workflow published the tag, a fork without GHCR access, or offline — transparently
# fall back to the upstream Playwright image. An explicitly-pinned PLAYWRIGHT_IMAGE
# is never silently swapped.
ensure_playwright_image() {
    if docker image inspect "$PLAYWRIGHT_IMAGE" >/dev/null 2>&1; then
        persist_playwright_image
        return 0
    fi
    if docker pull "$PLAYWRIGHT_IMAGE"; then
        persist_playwright_image
        return 0
    fi
    if [[ "$PLAYWRIGHT_IMAGE" == "$PLAYWRIGHT_RUNNER_IMAGE" ]]; then
        echo "Runner image ${PLAYWRIGHT_RUNNER_IMAGE} unavailable; falling back to ${PLAYWRIGHT_FALLBACK_IMAGE}" >&2
        if docker pull "$PLAYWRIGHT_FALLBACK_IMAGE"; then
            PLAYWRIGHT_IMAGE="$PLAYWRIGHT_FALLBACK_IMAGE"
            persist_playwright_image
            return 0
        fi
        echo "Failed to pull fallback Playwright image ${PLAYWRIGHT_FALLBACK_IMAGE}" >&2
        return 1
    fi
    echo "Failed to pull Playwright image ${PLAYWRIGHT_IMAGE}" >&2
    return 1
}

export SCRIPT_DIR
export REPO_ROOT
export PLAYWRIGHT_VERSION
export PLAYWRIGHT_RUNNER_IMAGE
export PLAYWRIGHT_FALLBACK_IMAGE
export PLAYWRIGHT_IMAGE
export WORKSPACE_PATH
