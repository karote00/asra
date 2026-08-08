#!/bin/bash
set -euo pipefail

read -r E2E_HOST E2E_PORT E2E_APP_URL \
  E2E_COLLABORATION_HEALTH_URL <<< "$(
  node --input-type=module -e "
    import {
      loadEnvironment,
      resolveEnvironment
    } from './apps/asyra-design/app-environment.mjs'
    const config = resolveEnvironment(
      loadEnvironment()
    )
    process.stdout.write(
      [
        config.viteHost,
        config.vitePort,
        config.appURL,
        config.collaborationHealthURL
      ].join(' ')
    )
  "
)"

E2E_APP_SERVER_PID=''
E2E_COLLABORATION_SERVER_PID=''
E2E_DOCUMENT_BACKEND_PID=''
E2E_DOCUMENT_BACKEND_URL='http://127.0.0.1:4201'

# Cleanup function to kill the separately-owned background server processes.
cleanup() {
  E2E_EXIT_CODE=$?
  if [ -n "$E2E_APP_SERVER_PID" ]; then
    echo "Stopping App server (PID: $E2E_APP_SERVER_PID)..."
    kill "$E2E_APP_SERVER_PID" 2>/dev/null || true
    wait "$E2E_APP_SERVER_PID" 2>/dev/null || true
  fi
  if [ -n "$E2E_COLLABORATION_SERVER_PID" ]; then
    echo "Stopping Collaboration server (PID: $E2E_COLLABORATION_SERVER_PID)..."
    kill "$E2E_COLLABORATION_SERVER_PID" 2>/dev/null || true
    wait "$E2E_COLLABORATION_SERVER_PID" 2>/dev/null || true
  fi
  if [ -n "$E2E_DOCUMENT_BACKEND_PID" ]; then
    echo "Stopping Document backend (PID: $E2E_DOCUMENT_BACKEND_PID)..."
    kill "$E2E_DOCUMENT_BACKEND_PID" 2>/dev/null || true
    wait "$E2E_DOCUMENT_BACKEND_PID" 2>/dev/null || true
  fi
  trap - EXIT INT TERM
  exit "$E2E_EXIT_CODE"
}

# Trap exit signals to ensure cleanup
trap cleanup EXIT INT TERM

# 1. Build project
echo "Step 1: Building project..."
yarn react:build

# 2. Build and start the formal document backend.
echo "Step 2: Building Document backend..."
yarn workspace @asyra/asyra-design build:document-backend

echo "Step 3: Starting Document backend..."
DOCUMENT_BACKEND_DATA_DIR=test-results/document-backend \
  yarn workspace @asyra/asyra-design document:backend:start &
E2E_DOCUMENT_BACKEND_PID=$!

echo "Step 4: Waiting for Document backend to be ready..."
npx wait-on "http-get://127.0.0.1:4201/health" --timeout 60000

# 5. Build and start the Collaboration server as a dedicated CI dependency.
echo "Step 5: Building Collaboration server..."
yarn workspace @asyra/asyra-design build:collaboration-server

echo "Step 6: Starting Collaboration server..."
DOCUMENT_PERSISTENCE_BACKEND_URL="$E2E_DOCUMENT_BACKEND_URL" \
  yarn workspace @asyra/asyra-design collaboration:server:start &
E2E_COLLABORATION_SERVER_PID=$!

echo "Step 7: Waiting for Collaboration server to be ready..."
npx wait-on "http-get://${E2E_COLLABORATION_HEALTH_URL#http://}" --timeout 60000

# 8. Start the diagnostic-enabled app runtime used by the ordinary E2E suite.
# Production bundle/exclusion behavior is covered by the build and package gates.
echo "Step 8: Starting E2E App server at $E2E_APP_URL..."
E2E_OWN_SERVERS=1 \
  E2E_DOCUMENT_BACKEND_URL="$E2E_DOCUMENT_BACKEND_URL" \
  yarn workspace @asyra/asyra-design start \
  --port "$E2E_PORT" \
  --host "$E2E_HOST" \
  --strictPort &
E2E_APP_SERVER_PID=$!

# 9. Wait for App server ready
echo "Step 9: Waiting for App server to be ready..."
# Using wait-on to ensure port is listening
npx wait-on "$E2E_APP_URL" --timeout 60000

# 10. Keep the formal timing budget free from another browser worker's CPU load,
# then run the remaining functional suite with its deterministic CI policy.
if [ "${CI:-}" = "true" ]; then
  echo "Step 10: Running isolated render performance gate..."
  yarn workspace @asyra/asyra-design playwright test --config playwright.config.ts e2e/render-delta-performance.spec.ts --workers=1
  echo "Step 11: Running functional Playwright tests..."
  E2E_SKIP_PERFORMANCE=true yarn test:e2e
else
  echo "Step 10: Running Playwright tests..."
  yarn test:e2e
fi

echo "Final step: Running isolated unavailable-service status toast test..."
yarn workspace @asyra/asyra-design test:e2e:status-toast
