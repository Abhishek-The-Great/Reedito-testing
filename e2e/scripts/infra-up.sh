#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/resolve-e2e-mode.sh"

cd "$REPO_ROOT"

MODE="$(resolve_e2e_mode)"
export REEDITO_E2E_MODE="$MODE"
ANALYTICS_ENABLED="${REEDITO_E2E_ANALYTICS:-true}"
MYSQL_TMPFS_ENABLED="${REEDITO_E2E_MYSQL_TMPFS:-true}"
TINYBIRD_SLIM_ENABLED="${REEDITO_E2E_TINYBIRD_SLIM:-false}"

if [[ "$MODE" != "build" ]]; then
  DEV_COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-reedito-dev}"
  REEDITO_DEV_IMAGE="${DEV_COMPOSE_PROJECT}-reedito-dev"
  GATEWAY_IMAGE="${DEV_COMPOSE_PROJECT}-reedito-dev-gateway"

  if ! docker image inspect "$REEDITO_DEV_IMAGE" >/dev/null 2>&1 || ! docker image inspect "$GATEWAY_IMAGE" >/dev/null 2>&1; then
    echo "Building missing dev images for E2E (${REEDITO_DEV_IMAGE}, ${GATEWAY_IMAGE})..."
    docker compose -f compose.dev.yaml -f compose.dev.analytics.yaml build reedito-dev reedito-dev-gateway
  fi
fi

compose_files=(-f compose.dev.yaml)
services=(mysql redis mailpit)

if [[ "$MODE" == "build" && "$MYSQL_TMPFS_ENABLED" != "false" ]]; then
  compose_files+=(-f e2e/compose.e2e.tmpfs.yaml)
fi

if [[ "$ANALYTICS_ENABLED" == "true" ]]; then
  compose_files+=(-f compose.dev.analytics.yaml)
  services+=(tinybird-local analytics)

  # Opt-in override to the distilled slim Tinybird image, which is a fraction of
  # upstream's size on disk. Must be layered after compose.dev.analytics.yaml to
  # override its image.
  #
  # The image is licensed for distribution within our organization only, so its
  # GHCR package is internal and unreadable from a fork PR's scoped token. Fall
  # back to the upstream image whenever the pull fails, rather than failing the
  # run: it also covers the window before the package is first published, and a
  # revoked or not-yet-granted access grant.
  if [[ "$TINYBIRD_SLIM_ENABLED" == "true" ]]; then
    if [[ -z "${REEDITO_E2E_TINYBIRD_SLIM_IMAGE:-}" ]]; then
      echo "WARNING: REEDITO_E2E_TINYBIRD_SLIM=true requires REEDITO_E2E_TINYBIRD_SLIM_IMAGE; using the upstream Tinybird image."
    elif docker image inspect "$REEDITO_E2E_TINYBIRD_SLIM_IMAGE" >/dev/null 2>&1 \
        || docker pull "$REEDITO_E2E_TINYBIRD_SLIM_IMAGE"; then
      compose_files+=(-f e2e/compose.e2e.tinybird-slim.yaml)
    else
      echo "WARNING: could not pull ${REEDITO_E2E_TINYBIRD_SLIM_IMAGE} — falling back to the upstream Tinybird image."
      echo "WARNING: the upstream image needs several more GB of runner disk; expect a disk-space failure on a constrained runner."
    fi
  fi
fi

docker compose "${compose_files[@]}" up -d --wait "${services[@]}"
