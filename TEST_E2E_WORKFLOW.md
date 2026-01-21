# Testing E2E Workflow Before Merge

## Quick Test Steps

### 1. Test Manual Trigger (No Merge Required)

1. Go to: **Actions** → **E2E Tests (PR Trigger)**
2. Click **"Run workflow"**
3. Enter PR number: `123` (any number)
4. Click **"Run workflow"**
5. Watch execution in Actions tab

### 2. Verify All Components

- ✅ Workflow starts correctly
- ✅ Installs dependencies
- ✅ Builds React app
- ✅ Runs E2E tests
- ✅ Uploads artifacts on failure

### 3. Test /e2e Command (After Merge)

Once merged to main:

1. Create any test PR
2. Comment: `/e2e`
3. Check for:
   - Rocket reaction on comment
   - "E2E Tests Triggered!" message
   - E2E workflow execution

## Why /e2e Doesn't Work Yet

GitHub Actions only runs workflows from the **default branch** (usually `main`).
Your workflow files are on `feat/e2e-ci-workflow` branch, so they're not active.

## Solution

Either:
A. **Merge to main** → Activates all workflows immediately
B. **Test manually** → Use Actions page trigger before merge

## After Merge

The `/e2e` command will work automatically for all future PRs.
