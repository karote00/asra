#!/bin/bash
set -euo pipefail

read -r ASYRA_E2E_HOST ASYRA_E2E_PORT ASYRA_E2E_APP_URL <<< "$(
  node --input-type=module -e "
    import {
      loadAsyraDesignEnvironment,
      resolveAsyraDesignEnvironment
    } from './apps/asyra-design/app-environment.mjs'
    const config = resolveAsyraDesignEnvironment(
      loadAsyraDesignEnvironment()
    )
    process.stdout.write(
      [config.viteHost, config.vitePort, config.appURL].join(' ')
    )
  "
)"

ASYRA_E2E_SERVER_PID=''

# Cleanup function to kill the background server process
cleanup() {
  ASYRA_E2E_EXIT_CODE=$?
  if [ -n "$ASYRA_E2E_SERVER_PID" ]; then
    echo "Stopping server (PID: $ASYRA_E2E_SERVER_PID)..."
    kill "$ASYRA_E2E_SERVER_PID" 2>/dev/null || true
    wait "$ASYRA_E2E_SERVER_PID" 2>/dev/null || true
  fi
  trap - EXIT INT TERM
  exit "$ASYRA_E2E_EXIT_CODE"
}

# Trap exit signals to ensure cleanup
trap cleanup EXIT INT TERM

# 1. Build project
echo "Step 1: Building project..."
yarn react:build

# 2. Start the diagnostic-enabled app runtime used by the ordinary E2E suite.
# Production bundle/exclusion behavior is covered by the build and package gates.
echo "Step 2: Starting E2E server at $ASYRA_E2E_APP_URL..."
yarn workspace @asyra/asyra-design react:start \
  --port "$ASYRA_E2E_PORT" \
  --host "$ASYRA_E2E_HOST" \
  --strictPort &
ASYRA_E2E_SERVER_PID=$!

# 3. Wait for server ready
echo "Step 3: Waiting for server to be ready..."
# Using wait-on to ensure port is listening
npx wait-on "$ASYRA_E2E_APP_URL" --timeout 60000

# 4. Execute Playwright E2E tests
echo "Step 4: Running Playwright tests..."
yarn test:e2e
