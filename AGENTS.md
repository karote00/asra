# Agent Protocol

**Universal AI entry point** - Read this before any work on this project.

## Essential Reading (in order)

1. **[.project/AI_ESSENTIALS.md](.project/AI_ESSENTIALS.md)** - Core rules and guidelines (READ FIRST)
2. **[.project/ARCHITECTURE.md](.project/ARCHITECTURE.md)** - Technical architecture details
3. **[.project/WORKFLOW.md](.project/WORKFLOW.md)** - Development process phases

## Quick Reference

- **Testing**: `yarn workspace @package/name test:local`
- **Formatting**: `yarn lint:ci` (check) / `yarn lint --fix` (fix)
- **Build**: `yarn react:build`
- **Architecture**: Communication-Driven Development (CDD) with typed events

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

- Read `.project/AI_ESSENTIALS.md` before any work
- Use direct assignment for mocking dynamic methods: `instance.method = vi.fn()`
- No commits without explicit user approval
