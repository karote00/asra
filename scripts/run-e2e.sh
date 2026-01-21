#!/bin/bash
set -e

# Cleanup function to kill the background server process
cleanup() {
  EXIT_CODE=$?
  if [ -n "$SERVER_PID" ]; then
    echo "Stopping server (PID: $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    # Wait a moment for the process to terminate
    sleep 1
  fi
  exit $EXIT_CODE
}

# Trap exit signals to ensure cleanup
trap cleanup EXIT INT TERM

# 1. Build project
echo "Step 1: Building project..."
yarn react:build

# 2. Start test server (background)
# Using 'preview' to serve the built artifacts, mimicking production-like environment
echo "Step 2: Starting server on port 3000..."
yarn workspace @asra/ui preview --port 3000 --host 0.0.0.0 &
SERVER_PID=$!

# 3. Wait for server ready
echo "Step 3: Waiting for server to be ready..."
# Using wait-on to ensure port is listening
npx wait-on http://localhost:3000 --timeout 60000

# 4. Execute Playwright E2E tests
echo "Step 4: Running Playwright tests..."
yarn test:e2e
