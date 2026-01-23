# Agent Protocol

**Universal AI entry point** - Read this before any work on this project.

## Essential Reading (in order)

1. **[docs/ai/project/AI_ESSENTIALS.md](docs/ai/project/AI_ESSENTIALS.md)** - Core rules and guidelines (READ FIRST)
2. **[docs/ai/project/ARCHITECTURE.md](docs/ai/project/ARCHITECTURE.md)** - Technical architecture details
3. **[docs/ai/project/WORKFLOW.md](docs/ai/project/WORKFLOW.md)** - Development process phases
4. **[docs/ai/skills/](docs/ai/skills/)** - Reusable AI agent capabilities and skills
5. **[docs/ai/workflows/](docs/ai/workflows/)** - Universal workflows for guaranteed process execution

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

Each workflow automatically loads appropriate skills and follows the complete development process from **[docs/ai/project/rules/request-handling-workflow.md](docs/ai/project/rules/request-handling-workflow.md)**.

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

- **Event-Driven Architecture**: No direct package dependencies, use `@asra/reactive-events`
- **Behavior-Focused Tests**: Document behavior, not coverage
- **Check Config Files**: Never hardcode formatting preferences
- **Quality Gates**: Tests pass + lint clean + build succeeds

## Critical Rules

- **Project Context**: Always read `docs/ai/project/` folder first for architecture patterns
- **External APIs**: Use Context7 MCP server for libraries/frameworks/APIs (see `.antigravity/rules.md`)
- Read `docs/ai/project/AI_ESSENTIALS.md` before any work
- Use direct assignment for mocking dynamic methods: `instance.method = vi.fn()`
- No commits without explicit user approval
