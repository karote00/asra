# AI Essentials

**READ THIS FIRST** - Core rules and guidelines for AI agents working on this project.

## 🚨 Prime Directive

Your FIRST action in any session MUST be to read this file completely.

## 🏗️ Project Architecture (CDD)

This project follows **Communication-Driven Development (CDD)**:

**For comprehensive CDD patterns and specifications, see:**

- **[CDD/INDEX.md](CDD/INDEX.md)** - Overview and usage guide
- **[CDD/EVENTS.md](CDD/EVENTS.md)** - Event-driven communication
- **[CDD/TRANSACTIONS.md](CDD/TRANSACTIONS.md)** - Transaction management
- **[CDD/REQUEST_APIS.md](CDD/REQUEST_APIS.md)** - Synchronous API patterns
- **[CDD/TESTING.md](CDD/TESTING.md)** - Testing patterns and quality gates
- **[CDD/VALIDATION.md](CDD/VALIDATION.md)** - Validation rules and automated checking

### Core Principles

- All components communicate via **typed events** (`@asra/reactive-events`)
- No direct function calls between packages
- Event flow: Input → Decision → Action → State Update
- **Request-Response Pattern**: Synchronous APIs via dependency injection
- **Transaction Management**: All state changes wrapped in undo/redo transactions

### Core Packages

**System Layer:**

- `@asra/core`: System orchestrator with request APIs
- `@asra/interaction-core`: Decision-making engine
- `@asra/reactive-events`: Event communication system
- `@asra/factory`: Transaction management (undo/redo)

**Data Layer:**

- `@asra/scene-tree`: Document model management
- `@asra/system-context`: Global state management
- `@asra/props-manager`: Property data management
- `@asra/selection`: Element selection management

**Input/Output Layer:**

- `@asra/input-system`: Keyboard and mouse event handling
- `@asra/render`: Rendering system and viewport management
- `@asra/ui-context`: UI state optimization layer
- `@asra/design-system`: UI component library

**Application:**

- `@asra/ui`: React application (apps/ui)

**Shared:**

- `@asra/utils`: Shared utilities and types

## 🧪 Testing Rules

- Use `yarn workspace @package/name test:local` for development
- Use `yarn workspace @package/name test:ci` for CI format
- Write **behavior-focused** tests, not coverage-focused
- For dynamically assigned methods (like `@asra/core`): use direct assignment `instance.method = vi.fn()` instead of `vi.spyOn()`
- **E2E Testing**: Use Playwright with `yarn test:e2e` for UI testing

## 🎯 Commands

```bash
# Formatting (always check config files first)
yarn lint:ci        # Check formatting
yarn lint --fix     # Fix formatting

# Testing
yarn workspace @package/name test:local  # Clean output
yarn workspace @package/name test:ci     # CI format
yarn test:local                          # All packages, clean output

# E2E Testing
yarn test:e2e       # Run Playwright end-to-end tests
bash scripts/run-e2e.sh  # Complete E2E flow (build → serve → test)

# Build
yarn react:build    # Production build

# Skills Management
./scripts/update-skills.sh              # Update skills catalog
npx openskills list                     # List available skills
npx openskills read <skill-name>         # Load specific skill
```

## 📋 Development Workflow

1. **Read config files** (`.editorconfig`, `.prettierrc`, `eslint.config.js`)
2. **Follow CDD patterns** (event-driven communication + request-response pattern)
3. **Write meaningful tests** (behavior-focused with simplified mocking)
4. **Verify changes** (`yarn lint:ci`, `yarn test:local`)
5. **Use request APIs** instead of async/await for synchronous operations
6. **Load skills** for specialized tasks via OpenSkills when needed
7. **Add E2E tests** for UI changes following testing best practices

## 📁 Documentation Structure

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Detailed technical architecture
- **[WORKFLOW.md](./WORKFLOW.md)**: Development process phases
- **[SKILLS.md](./SKILLS.md)**: Available AI agent capabilities and skills
- **[prd/](./prd/)**: Product Requirements Documents
- **[decision-history/](./decision-history/)**: Architecture decision and change records
- **[documentation-audit.md](./documentation-audit.md)**: Documentation audit and update requirements
- **[rules/](./rules/)**: Development rules and guidelines
- **[templates/](./templates/)**: Document templates and patterns
- **[golden-paths/](./golden-paths/)**: Implementation guides

## ⚠️ Critical Rules

- **Never hardcode formatting** - always check config files
- **No direct dependencies** between packages (use events or request APIs)
- **Always validate** with lint and test before finishing
- **Use proper test commands** as specified above
- **Check external APIs** via Context7 MCP server (see `.antigravity/rules.md`)
- **Use OpenSkills** for specialized capabilities - don't bloat AGENTS.md with skills
- **For dynamically assigned methods**: use direct assignment `instance.method = vi.fn()`
- **E2E Testing**: Always use `data-testid` attributes for stable element selection

## 📁 Documentation Structure

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Detailed technical architecture
- **[WORKFLOW.md](./WORKFLOW.md)**: Development process phases
- **[SKILLS.md](./SKILLS.md)**: Available AI agent capabilities and skills
- **[prd/](./prd/)**: Product Requirements Documents
- **[decision-history/](./decision-history/)**: Architecture decision and change records
- **[rules/](./rules/)**: Development rules and guidelines
- **[templates/](./templates/)**: Document templates and patterns
- **[golden-paths/](./golden-paths/)**: Implementation guides
- **[apis/](./apis/)**: API documentation for frontend packages

## 🔧 Key Patterns

### Request API Usage

Instead of async/await patterns, use synchronous request APIs:

```typescript
// Get system state
const context = core.requests.systemContext.getSystemContextSnapshot()

// Check selection
const selectedIds = core.requests.selection.getElementSelectionIds()

// Scene tree operations
const elementId = core.requests.sceneTree.addRectangle(data, inUndoRedo)
```

### Testing with Dynamic Methods

For classes using `Object.assign()`:

```typescript
// ❌ Don't use spyOn - fails on dynamically assigned methods
vi.spyOn(core, 'propsLoadData')

// ✅ Use direct assignment - always works
core.propsLoadData = vi.fn()
```

### E2E Testing Standards

- Use `data-testid` for stable element selection
- Support cross-platform shortcuts (Meta/Control)
- Expose internal state with data attributes
- Focus neutral areas to avoid triggering tools
