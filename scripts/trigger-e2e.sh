#!/bin/bash
# trigger-e2e.sh - Easy E2E test triggering for ASRA project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}ASRA E2E Test Trigger${NC}"
echo "================================"

# Get current PR number
PR_NUMBER=$(gh pr view --json number -q .number 2>/dev/null || echo "")

if [[ -z "$PR_NUMBER" ]]; then
    echo -e "${YELLOW}No PR found for current branch${NC}"
    echo "Make sure you're on a PR branch or specify PR number:"
    echo "Usage: $0 [pr-number]"
    exit 1
fi

echo -e "${GREEN}Found PR #$PR_NUMBER${NC}"

# Trigger the workflow
echo -e "${BLUE}Triggering E2E tests...${NC}"
RUN_ID=$(gh workflow run e2e-pr-trigger.yml --field pr_number=$PR_NUMBER --json id -q '.id')

if [[ -z "$RUN_ID" ]]; then
    echo -e "${RED}Failed to trigger workflow${NC}"
    exit 1
fi

echo -e "${GREEN}E2E tests triggered!${NC}"
echo "Run ID: $RUN_ID"

# Wait a moment for the run to start
sleep 2

# Watch the run
echo -e "${BLUE}Watching test execution...${NC}"
gh run watch --job $RUN_ID || {
    echo -e "${YELLOW}Watch timed out or completed${NC}"
}

# Get final status
STATUS=$(gh run view $RUN_ID --json conclusion -q '.conclusion')

echo ""
echo "================================"
if [[ "$STATUS" == "success" ]]; then
    echo -e "${GREEN}E2E Tests PASSED!${NC}"
    echo "Ready to merge!"
else
    echo -e "${RED}E2E Tests FAILED${NC}"
    echo "Check the run for details:"
    echo "gh run view $RUN_ID --web"
fi