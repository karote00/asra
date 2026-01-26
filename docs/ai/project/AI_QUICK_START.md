# AI Quick Start Guide

**READ THIS FIRST** before making any code changes to this project.

## 🚨 MANDATORY: Follow Project Configuration Files

**AI agents MUST read and follow the project's configuration files:**

### Formatting Configuration (READ THESE FILES)
- **`.editorconfig`**: Defines indentation, line endings, and character encoding
- **`.prettierrc`**: Code formatting rules (quotes, semicolons, line width, etc.)
- **`eslint.config.js`**: Linting rules and code style enforcement

**NEVER hardcode formatting rules - always check these config files first!**

### Quick Config Check
```bash
# Check current formatting rules
cat .editorconfig
cat .prettierrc
head -20 eslint.config.js
```

### Auto-Apply Project Formatting
```bash
# Fix formatting according to project config
yarn lint --fix
```

## 🏗 Project Architecture

This project follows **Communication-Driven Development (CDD)** principles:

### Core Packages
- `@asyra/core`: System orchestrator
- `@asyra/interaction-core`: Decision-making engine
- `@asyra/reactive-events`: Event communication system
- `@asyra/scene-tree`: Document model management
- `@asyra/system-context`: Global state management
- `@asyra/utils`: Shared utilities and types

### Event-Driven Architecture
- All components communicate via **typed events**
- No direct function calls between packages
- Events flow: Input → Decision → Action → State Update

## 🧪 Testing Guidelines

### Test Philosophy
- Write **meaningful tests** that demonstrate "how it works and what it needs"
- Focus on **behavior documentation**, not just coverage
- Test **critical paths** and **edge cases**

### Test Scripts
- `yarn workspace @package/name test:local` - Clean output for development
- `yarn workspace @package/name test:ci` - CI format with JUnit XML
- `yarn workspace @package/name test` - Watch mode for interactive development

### Test Structure
```typescript
describe('Feature Name - Purpose', () => {
  it('should demonstrate specific behavior', () => {
    // Arrange: Set up test data
    // Act: Execute the behavior
    // Assert: Verify the outcome
  })
})
```

## 📁 Key Documentation

- **[PROJECT_GUIDE.md](./PROJECT_GUIDE.md)**: Comprehensive project overview
- **[AI_ARCHITECTURAL_GUIDE.md](./AI_ARCHITECTURAL_GUIDE.md)**: Technical architecture details
- **[prd/](./prd/)**: Product Requirements Documents for all features
- **[golden-paths/](./golden-paths/)**: Step-by-step implementation guides

## 🔄 Development Workflow

1. **Read project config files** (`.editorconfig`, `.prettierrc`, `eslint.config.js`)
2. **Understand the feature** (check PRDs and golden paths)
3. **Follow CDD patterns** (event-driven communication)
4. **Write meaningful tests** (behavior-focused)
5. **Verify formatting** (`yarn lint:ci`)
6. **Run tests** (`yarn workspace @package/name test:local`)

## 🎯 Quick Commands

```bash
# Check formatting according to project config
yarn lint:ci

# Fix formatting according to project config
yarn lint --fix

# Run tests (clean output)
yarn workspace @asyra/utils test:local

# Build project
yarn react:build
```

## ⚠️ Common Pitfalls

- **Don't assume formatting rules** - always check config files first
- **Don't hardcode indentation** - read `.editorconfig` for indent_size
- **Don't guess quote style** - check `.prettierrc` for singleQuote setting
- **Don't create direct dependencies** between packages (use events)
- **Don't write coverage-focused tests** (write behavior-focused tests)

## 🤝 Communication

This project emphasizes **clear communication** through:
- **Typed events** for component interaction
- **Behavior-driven tests** for requirement clarity
- **Comprehensive documentation** for context sharing

**Remember: Configuration files are the source of truth for formatting and style rules.**