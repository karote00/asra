# AI Essentials

**READ THIS FIRST** - Core rules and guidelines for AI agents working on this project.

## 🚨 Prime Directive
Your FIRST action in any session MUST be to read this file completely.

## 🏗️ Project Architecture (CDD)
This project follows **Communication-Driven Development (CDD)**:
- All components communicate via **typed events** (`@asra/reactive-events`)
- No direct function calls between packages
- Event flow: Input → Decision → Action → State Update

### Core Packages
- `@asra/core`: System orchestrator
- `@asra/interaction-core`: Decision-making engine  
- `@asra/reactive-events`: Event communication system
- `@asra/scene-tree`: Document model management
- `@asra/system-context`: Global state management
- `@asra/utils`: Shared utilities and types

## 🧪 Testing Rules
- Use `yarn workspace @package/name test:local` for development
- Use `yarn workspace @package/name test:ci` for CI format
- Write **behavior-focused** tests, not coverage-focused
- For dynamically assigned methods (like `@asra/core`): use direct assignment `instance.method = vi.fn()` instead of `vi.spyOn()`

## 🎯 Commands
```bash
# Formatting (always check config files first)
yarn lint:ci        # Check formatting
yarn lint --fix     # Fix formatting

# Testing
yarn workspace @package/name test:local  # Clean output
yarn workspace @package/name test:ci     # CI format

# Build
yarn react:build    # Production build
```

## 📋 Development Workflow
1. **Read config files** (`.editorconfig`, `.prettierrc`, `eslint.config.js`)
2. **Follow CDD patterns** (event-driven communication)
3. **Write meaningful tests** (behavior-focused)
4. **Verify changes** (`yarn lint:ci`, `yarn test:local`)

## ⚠️ Critical Rules
- **Never hardcode formatting** - always check config files
- **No direct dependencies** between packages (use events)
- **Always validate** with lint and test before finishing
- **Use proper test commands** as specified above

## 📁 Documentation Structure
- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Detailed technical architecture
- **[WORKFLOW.md](./WORKFLOW.md)**: Development process phases
- **[prd/](./prd/)**: Product Requirements Documents
- **[golden-paths/](./golden-paths/)**: Implementation guides