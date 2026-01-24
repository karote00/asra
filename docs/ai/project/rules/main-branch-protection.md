# Main Branch Protection Rule

## 🚨 CRITICAL: Main Branch Protection

**ABSOLUTELY NO AI MODIFICATIONS TO MAIN BRANCH**

### Rule Statement

AI agents are **FORBIDDEN** from making any changes to the `main` branch under any circumstances. The main branch must remain protected at all times.

### What AI CAN Do

- ✅ Work on **feature branches** only
- ✅ Create new feature branches from main
- ✅ Read/analyze the main branch
- ✅ Suggest changes for main branch (to be implemented by humans)
- ✅ Review pull requests targeting main

### What AI CANNOT Do

- ❌ **NEVER** switch to main branch
- ❌ **NEVER** commit directly to main
- ❌ **NEVER** push changes to main
- ❌ **NEVER** merge branches to main
- ❌ **NEVER** modify files while on main branch
- ❌ **NEVER** force push to main
- ❌ **NEVER** delete main branch

### Required Workflow

1. **Always work on feature branches**

   - Create feature branch: `git checkout -b feature/your-feature-name`
   - Make changes on feature branch only
   - Commit changes to feature branch only

2. **Branch Creation Safety**

   - Always create feature branches from latest main
   - Use descriptive branch names: `feature/description`, `fix/issue-description`

3. **Pull Request Process**
   - Create pull requests from feature branch to main
   - AI can assist with PR creation and review
   - Only humans should merge PRs to main

### Enforcement Commands

Before any git operation, AI must verify current branch:

```bash
# Check current branch - AI MUST RUN THIS BEFORE ANY GIT OPERATION
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "🚨 ERROR: AI cannot work on main branch!"
  echo "Please switch to a feature branch first."
  exit 1
fi
```

### Emergency Recovery

If AI accidentally switches to main branch:

1. Immediately switch back to feature branch
2. Do not make any changes while on main
3. Report the incident for review

### Violation Consequences

Any violation of this rule is considered **CRITICAL** and must:

1. Be immediately reported
2. Be documented in incident logs
3. Trigger review of AI agent permissions

---

**REMEMBER: Main branch protection is non-negotiable. Always work on feature branches.**
