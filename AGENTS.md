# Agent Protocol

**Universal AI entry point** - Read this before any work on this project.

## Essential Reading (in order)

1. **[docs/ai/framework/README.md](docs/ai/framework/README.md)** - Framework context index and read order (READ FIRST)
2. **[docs/ai/framework/FRAMEWORK_ESSENTIALS.md](docs/ai/framework/FRAMEWORK_ESSENTIALS.md)** - Core framework rules and constraints
3. **[docs/ai/framework/CODING_STANDARDS.md](docs/ai/framework/CODING_STANDARDS.md)** - **MONOREPO IMPORT RULE** and implementation standards
4. **[docs/ai/framework/ARCHITECTURE.md](docs/ai/framework/ARCHITECTURE.md)** - Framework architecture contracts
5. **[docs/ai/framework/WORKFLOW.md](docs/ai/framework/WORKFLOW.md)** - Framework execution workflow
6. **[docs/ai/apps/README.md](docs/ai/apps/README.md)** - App-level context index (use when task is app-specific)
7. **[docs/ai/skills/](docs/ai/skills/)** - Reusable AI agent capabilities and skills
8. **[docs/ai/workflows/](docs/ai/workflows/)** - Universal workflows for guaranteed process execution

## Context Routing

- **Framework tasks**: follow `docs/ai/framework/*` as source-of-truth.
- **App tasks**: follow `docs/ai/apps/<app>/*` as source-of-truth.
- **Legacy reference only**: `docs/ai/project/*` (use for historical context, not primary contracts).

## Quick Reference

- **Testing**: `yarn workspace @package/name test:local`
- **Formatting**: `yarn lint:ci` (check) / `yarn lint --fix` (fix)
- **Build**: `yarn react:build`
- **Architecture**: Communication-Driven Development (CDD) with typed events

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
- **Update catalog**: `npx openskills sync -y --output docs/ai/skills/README.md`

> ⚠️ **Important**:
>
> - **For workflows**: Use `/feature`, `/refactor`, `/bugfix`, or `/docs` commands for guaranteed process execution
> - **For skills catalog**: Always use:
>
> ```bash
> ./scripts/update-skills.sh
> # or: npx openskills sync -y --output docs/ai/skills/README.md
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

- **🚨 MONOREPO IMPORT RULE**: **ALWAYS** use `@asyra/package-name` for cross-package imports, NEVER use relative paths like `../../../other-package` (see `docs/ai/framework/CODING_STANDARDS.md`)
- **🚨 MAIN BRANCH PROTECTION**: NEVER work on main branch - use feature branches only (see `docs/ai/project/rules/main-branch-protection.md`)
- **Context Priority**: Use `docs/ai/framework/*` and `docs/ai/apps/*` first; treat `docs/ai/project/*` as legacy reference
- **External APIs**: Use Context7 MCP server for libraries/frameworks/APIs (see `.antigravity/rules.md`)
- Read `docs/ai/framework/FRAMEWORK_ESSENTIALS.md` before framework work
- Use direct assignment for mocking dynamic methods: `instance.method = vi.fn()`
- No commits without explicit user approval
