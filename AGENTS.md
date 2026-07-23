# Agent Protocol

**Universal AI entry point** - Classify the request before loading project context.

## Rule Loading Policy

Start every task with a brief triage based on the user's request and the files
being touched. Load only the rules needed for that scope, then expand context if
the task proves riskier than it first appeared.

### Always-On Rules

These rules apply to every task without requiring additional document reads:

- Use Traditional Chinese (Taiwan usage) or English only. Never use Simplified Chinese.
- Do not write, move, copy, or delete files outside the project. Read-only access outside the project is allowed.
- On a non-main feature branch, local commits are allowed at completed,
  validated step/stage boundaries. Never push unless the user explicitly
  requests the remote operation. Follow
  `docs/ai/workflows/git-commit-push-policy.md`.
- Do not overwrite unrelated user changes in a dirty worktree.
- Follow main branch protection before making code or documentation changes.
- Freeze a bounded task contract before editing. Reading may expand to resolve
  risk, but rules and discoveries must not independently expand mutation scope.
  Follow `docs/ai/framework/rules/bounded-task-scope-and-closure.md`.
- For every bug fix, first verify whether existing formal tests detect the bug; if not, add or strengthen the formal regression test before implementation.
- Follow the Critical Rules section in this file.

### Triage Levels

#### Level 0: Read-only or direct answer

Examples:

- Answer a question.
- Explain existing behavior.
- Inspect one or a few files.
- Run a read-only command.

Required context:

- `AGENTS.md`
- Directly relevant files only.

Do not load the full framework or app docs unless the answer depends on them.

#### Level 1: Low-risk local documentation or text change

Examples:

- Edit a small section of documentation.
- Fix wording, formatting, or a narrow instruction.
- Update non-behavioral metadata.

Required context:

- `AGENTS.md`
- The file being edited.
- Any directly linked source-of-truth document whose rule is being changed.

Run a focused diff review before finishing.

#### Level 2: Code, tests, or behavior change

Examples:

- Modify implementation code.
- Add or change tests.
- Change package behavior.
- Touch build, lint, or runtime configuration.

Required context:

1. **[docs/ai/framework/README.md](docs/ai/framework/README.md)** - Framework context index and read order.
2. **[docs/ai/framework/FRAMEWORK_ESSENTIALS.md](docs/ai/framework/FRAMEWORK_ESSENTIALS.md)** - Core framework rules and constraints.
3. **[docs/ai/framework/CODING_STANDARDS.md](docs/ai/framework/CODING_STANDARDS.md)** - **MONOREPO IMPORT RULE** and implementation standards.
4. Relevant package, app, or workflow docs based on the touched files.

#### Level 3: Architecture, cross-package, or product-flow change

Examples:

- Change event contracts, package boundaries, or public APIs.
- Change rendering, persistence, transactions, inspectors, active plans, or workflow behavior.
- Fix bugs that could be hidden by fallback output or patch-specific logic.

Required context:

1. Everything from Level 2.
2. **[docs/ai/framework/ARCHITECTURE.md](docs/ai/framework/ARCHITECTURE.md)** - Framework architecture contracts.
3. **[docs/ai/framework/WORKFLOW.md](docs/ai/framework/WORKFLOW.md)** - Framework execution workflow.
4. **[docs/ai/apps/README.md](docs/ai/apps/README.md)** and the relevant app docs when the task is app-specific.
5. Relevant files under **[docs/ai/framework/rules/](docs/ai/framework/rules/)**, **[docs/ai/skills/](docs/ai/skills/)**, or **[docs/ai/workflows/](docs/ai/workflows/)**.

After the bounded-task applicability check, work that changes or proves an
active plan or Inspector contract must re-read and follow the INSPECTOR FLOW
HIGHEST PRINCIPLE before starting and before advancing each work segment.

## Context Routing

- **Framework tasks**: follow `docs/ai/framework/*` as source-of-truth.
- **App tasks**: follow `docs/ai/apps/<app>/*` as source-of-truth.
- **Legacy reference only**: `docs/ai/project/*` (use for historical context, not primary contracts).

## Quick Reference

- **Testing**: `yarn workspace @package/name test:local`
- **Formatting**: `yarn lint:ci` (check) / `yarn lint --fix` (fix)
- **Build**: `yarn react:build`
- **Architecture**: Communication-Driven Development (CDD) with typed events

## Operational Diagnostics Hygiene

Codex renderer CPU, agent UI load, terminal log volume, dev-server CPU, test
runner CPU, browser CPU, and project runtime CPU are separate signals. Do not
infer product owner step, correctness, or runtime performance conclusions from
Codex UI CPU behavior.

Diagnostics must stay narrow and accountable:

- Every diagnostic command must answer one explicit question.
- Command output must be proportional to that question.
- Inspect large diffs through `git diff --stat`, `git diff --name-only`, `rg`,
  and bounded `sed` ranges by default.
- In a heavily dirty worktree, use Git diff only as an inventory tool unless a
  specific current-task file must be reviewed. Prefer `git status --short`,
  `git diff --stat`, `git diff --name-only`, and
  `git diff --cached --name-status`. Do not run raw `git diff`,
  `git diff --cached`, or `git show` without explicit path limits and bounded
  context.
- When dirty files exceed 30, do not inspect large raw diffs. Build a file
  inventory first, then read only current-task files. For deleted files, inspect
  filenames only unless the user explicitly asks to audit deleted content.
- Deleted diff content is not source-of-truth. Do not use deleted code,
  historical diff hunks, or removed tests as behavior authority. Current files,
  active specs, inspector flow, and formal tests are the authority.
- When active specs or inspector flow exist, they override historical diff
  content. Do not resurrect removed behavior from deleted files or old tests.
- Full stdout is opt-in, not the default.
- Long gate failures must be summarized first: failing test name, assertion
  error, relevant stack frame, budget summary, and artifact path.
- When a test or gate takes too long to report useful progress, pause and
  consider splitting it into smaller focused files, describe blocks, or exact
  test titles before continuing broader validation. Slow geometry or visual
  contracts must be isolated so one expensive case does not hide unrelated
  failures or waste repeated verification time.
- Performance gates must extract budget summaries instead of dumping full logs.
- Process diagnostics must use fixed-width, bounded output.
- Dev servers and test processes started by the agent must be PID-tracked.
- Extra ports must be cleaned up after use.
- Progress updates must describe the current gate, purpose, and current finding,
  not raw logs.
- If work must stop for discussion, user input, or a user-requested inspection
  checkpoint, send a system notification when the host environment supports it.
- If the user asks to inspect a milestone, notify only after the required
  evidence for that milestone is complete.
- If Codex renderer CPU spikes, stop issuing large-output commands, inspect a
  short top-CPU view, and report whether agent-started server or test processes
  are still running.

Log is evidence, not a context dump.

## Universal Workflows

For guaranteed process execution, use these workflows:

- **`/feature <description>`** - New feature development with automatic CDD compliance
- **`/refactor <description>`** - Code refactoring following architecture patterns
- **`/bugfix <description>`** - Systematic bug fixing with regression prevention
- **`/docs <task>`** - Comprehensive documentation updates with quality standards

Each workflow automatically loads appropriate skills and should follow the active context contracts in `docs/ai/framework/*` and `docs/ai/apps/*`.

### Skills & Capabilities

For available AI agent skills and domain expertise, see **[docs/ai/skills/](docs/ai/skills/)**.

### Quick Skill Usage

- **List skills**: `npx openskills list`
- **Load skill**: `npx openskills read <skill-name>`
- **Install project skills to runtime**: `./scripts/install-skills.sh`

> ⚠️ **Important**:
>
> - **For workflows**: Use `/feature`, `/refactor`, `/bugfix`, or `/docs` commands for guaranteed process execution
> - **For skill installation**: Use:
>
> ```bash
> ./scripts/install-skills.sh
> ```
>
> Running `npx openskills sync` without output flag will overwrite AGENTS.md with skills data.

### Key Skills Available

- **git-operations** - Git/gh CLI separation rule
- **frontend-design** - React/Next.js UI design
- **webapp-testing** - Playwright testing
- **mcp-builder** - MCP server creation
- And more... see SKILLS.md for complete catalog

## Common Commands

### Testing

```bash
yarn workspace @package/name test:local  # Development (clean output)
yarn workspace @package/name test:ci     # CI format with coverage
yarn test:local                          # All packages, dev format
```

### Linting & Formatting

```bash
yarn lint:ci        # Check formatting
yarn lint --fix     # Auto-fix formatting issues
```

### Building

```bash
yarn react:build    # Production build
yarn workspace @package/name build  # Package-specific build
```

## Key Principles

- **Event-Driven Architecture**: No direct package dependencies, use `@asyra/reactive-events`
- **Behavior-Focused Tests**: Document behavior, not coverage
- **Check Config Files**: Never hardcode formatting preferences
- **Quality Gates**: Tests pass + lint clean + build succeeds

## Critical Rules

- **🚨 BOUNDED TASK SCOPE AND CLOSURE RULE**: Before editing, freeze the objective, authorized mutation scope, fixed discovery methods for audits/reviews, required gates, exclusions, and stop conditions. Project rules may block, require evidence, or stop in-scope work, but they cannot independently authorize out-of-scope implementation. After editing begins, final review is limited to the diff, direct consumers, regressions caused by the diff, and the frozen gates; do not open new repository-wide discovery. Follow `docs/ai/framework/rules/bounded-task-scope-and-closure.md`.
- **🚨 BUGFIX TEST-FIRST RULE**: Before any bug-fix implementation, verify whether existing formal tests detect the reported failure. If they do not, add or strengthen formal tests/oracles first and prove they fail on the current behavior before changing production code (see `docs/ai/framework/rules/bugfix-test-first.md`). Manual screenshots, one-time diagnostics, and visual inspection are not enough.
- **🚨 MONOREPO IMPORT RULE**: **ALWAYS** use `@asyra/package-name` for cross-package imports, NEVER use relative paths like `../../../other-package` (see `docs/ai/framework/CODING_STANDARDS.md`)
- **🚨 MAIN BRANCH PROTECTION**: NEVER work on main branch - use feature branches only (see `docs/ai/project/rules/main-branch-protection.md`)
- **🚨 INSPECTOR FLOW HIGHEST PRINCIPLE**: Apply the bounded-task applicability check first. This rule governs work that changes or proves an active plan or Inspector step's semantics; a file reference or unrelated internal refactor alone does not activate it and must never be added to an Inspector merely to authorize the edit. For applicable work, re-read the Inspector before the task starts and before each work segment advances. The Inspector flow is an exact architecture contract, not a summary, implementation design, or execution ledger. For each segment, identify the matching Inspector step or route and verify its owner, inputs, outputs, conditions, bypasses, allowed contributors, forbidden contributors, implementation boundary, spec references, failure owner, and any profiling-justified cache dimensions. Compare the planned test, implementation, or document change against that exact contract and the affected product cases and DoD. The segment cannot proceed until this comparison passes. If the Inspector flow is missing, vague, or inconsistent with the active product contract, stop; repair it only when that repair is inside the frozen task contract, otherwise request direction. After each segment, re-check the Inspector flow before moving to the next segment, and re-check it again before claiming completion.
- **🚨 INSPECTOR CONTRACT READINESS RULE**: For work that changes or proves an active plan or Inspector contract, follow `docs/ai/framework/rules/inspector-contract-readiness.md`. Readiness comes from a thin product contract, an exact architecture flow, executable product cases, and a bounded DoD. Do not create readiness matrices, audit ledgers, closure packets, assertion registries, or other self-referential governance unless the user explicitly requests that additional process for a specific task.
- **🚨 INSPECTOR STEP EXECUTION RULE**: For implementation that changes or proves an active plan or Inspector step, follow `docs/ai/framework/rules/inspector-step-execution.md`. Work on one inspector owner step at a time, produce a Step Execution Card before edits, test-first any bug/spec mismatch, stay inside the step implementation allowlist, and run the bounded review checklist before advancing.
- **🚨 TASK ITERATION REPLAN RULE**: If the current plan has multiple failed implementation iterations, or exceeds a user-provided time limit when one exists, stop local patching and perform a task iteration inside the frozen task contract: re-audit the relevant contracts, owner boundary, tests, and implementation state, then write and self-review a bounded revised plan before starting the next implementation iteration (see `docs/ai/framework/rules/task-iteration-replan.md`). This applies whether or not an explicit goal or plan tool is being used.
- **🚨 NO PATCH FIXES RULE**: NEVER hide a product bug with patch geometry, patch state, patch routing, fallback product output, fixture-specific exceptions, or app-specific visual output. Identify and fix the first incorrect canonical owner step instead (see `docs/ai/framework/rules/no-patch-fixes.md`). This applies to framework code, preset defaults, all apps, visual review, export, hit testing, and inspectors.
- **🚨 VISUAL REVIEW MICROSCOPE RULE**: For visual/rendering closure, follow `docs/ai/framework/rules/visual-review-microscope.md`. Do not claim correctness from low zoom, one overview screenshot, one endpoint, or pixel-existence checks. User-reported exact geometry must become a formal source-space oracle first whenever possible; E2E screenshots are later-step evidence, not stroke semantics authority.
- **Context Priority**: Use `docs/ai/framework/*` and `docs/ai/apps/*` first; treat `docs/ai/project/*` as legacy reference
- **External APIs**: Use Context7 MCP server for libraries/frameworks/APIs (see `.antigravity/rules.md`)
- Read `docs/ai/framework/FRAMEWORK_ESSENTIALS.md` before framework work
- Use direct assignment for mocking dynamic methods: `instance.method = vi.fn()`
- Local step/stage commits are allowed after scoped validation and staged-diff
  review; remote push, history rewrite, release, and merge operations still
  require explicit user authorization. Follow
  `docs/ai/workflows/git-commit-push-policy.md`.
