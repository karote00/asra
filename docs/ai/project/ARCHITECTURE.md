# Architecture Guide

Detailed technical architecture for the Asyra project.

## Communication-Driven Development (CDD)

### Core Principles

1. **Event-Driven Communication**: All components communicate via typed events
2. **Centralized Orchestration**: `@asyra/core` acts as middleware
3. **Transaction Management**: `@asyra/factory` handles undo/redo
4. **Decoupled Components**: No direct function calls between packages
5. **Request-Response Pattern**: Synchronous API calls via dependency injection
6. **Skills-Based AI**: Modular capabilities loaded on-demand via OpenSkills

### User Interaction Flow

1. **Input System** → Detects input combinations → Emits `Input Action`
2. **Core** → Receives action → Notifies `interaction-core`
3. **Interaction Core** → Makes decision → Publishes `Decision Event`
4. **Core Subscription** → Listens to events → Calls System APIs

## Package Responsibilities

### System Layer

#### `@asyra/core` - System Orchestrator

- Central event subscription hub
- API delegation to other packages
- Methods assigned via `Object.assign()` from `createAPIs()`
- Request-based APIs for synchronous operations
- Dependency injection pattern for better testability
- **Request APIs**: Factory, Props, Render, SceneTree, Selection, SystemContext

#### `@asyra/interaction-core` - Decision Engine

- Receives action/session data
- Uses `src/decider/rules` (logic) and `src/decider/behavior` (flow)
- Publishes final decisions via events
- Handlers for elements, viewport, transactions, tools

#### `@asyra/reactive-events` - Event Bus

- Defines all cross-package communication events
- Typed event system for type safety
- Streamlined event flow for request-response pattern
- Event modules: app, interaction-core, props-manager, scene-tree, system-context

#### `@asyra/factory` - Transaction System

- `startTransaction()`: Begin undoable unit
- `updateTransaction()`: Add undoable changes
- `endTransaction()`: Commit as single unit
- Supports undo/redo for all data operations

### Data Layer

#### `@asyra/scene-tree` - Document Model

- Manages elements and hierarchy
- Provides real-time updates
- Implicit operations on selected elements
- Components: workspace, rectangle, group
- YJS-based CRDT for collaboration

#### `@asyra/system-context` - Global State

- Single source of truth for system state
- Active tool, mouse position, keyboard modifiers
- Accessible via `systemContext.getSystemContextSnapshot()`
- Stores primary tool, selection, viewport state

#### `@asyra/props-manager` - Property Management

- Structured property management separate from scene tree
- API-based control over prop components
- Reactive updates via events
- Supports serialization/deserialization of property data

#### `@asyra/selection` - Selection Management

- Handles element, vertex, edge selection
- Provides selection state queries
- Integrates with scene tree and UI context
- Selection events for reactive updates

### Input/Output Layer

#### `@asyra/input-system` - Input Handling

- Keyboard and mouse event processing
- Event mappings and keymaps
- Cross-platform shortcut support (Meta/Control)
- Input action generation for interaction-core

#### `@asyra/render` - Rendering System

- WebGL/Canvas rendering engine
- Viewport management (position, scale)
- Selection layer rendering
- Integration with scene tree for element display

#### `@asyra/ui-context` - UI State Optimization

- Manages and optimizes data for UI consumption
- Reactive stores for selection, scene-tree, system-context
- Efficient rendering with RxJS and YJS integration
- Framework-agnostic state management

#### `@asyra/design-system` - UI Components

- Reusable React components
- Design tokens and styling system
- Input components and layout primitives
- Integration with Tailwind CSS

### Application Layer

#### `@asyra/asyra-design` - A design tool application built with React

- Main application interface (apps/asyra-design)
- React 19 + Vite build system
- Playwright E2E testing setup
- Integration with all backend packages

### Shared Infrastructure

#### `@asyra/utils` - Shared Utilities

- Common types and interfaces
- Utility functions and constants
- ID generation and counters
- Scene tree data type definitions

## Data Manipulation Rules

### Transaction Boundaries

- **Undoable Changes**: Use `factory.updateTransaction()`
- **Real-time Updates**: Use `sceneTree.updateComputedData()`
- **Property Updates**: Use `props-manager` for structured data
- **Implicit Selection**: Many APIs operate on currently selected elements

### Event vs Data Flow

- **Events**: Signal actions (what happened)
- **Requests**: Synchronous API calls (immediate response)
- **YJS/CRDT**: Handle state (current truth)
- Components observe YJS for granular data changes

## Request API Architecture

### Request-Response Pattern

- **Purpose**: Replace async/await with synchronous calls
- **Implementation**: Dependency injection in `@asyra/core`
- **Benefits**: Better testability, clearer data flow
- **Usage**: Direct method calls instead of event publishing/subscription

### Request Types

```typescript
// Request interfaces in core/src/types/requests/
- FactoryRequests: Transaction management
- PropsRequests: Property data operations
- RenderRequests: Viewport and rendering
- SceneTreeRequests: Document model operations
- SelectionRequests: Element selection queries
- SystemContextRequests: Global state access
```

### Usage Examples

```typescript
// Direct state access
const context = core.requests.systemContext.getSystemContextSnapshot()
const selectedIds = core.requests.selection.getElementSelectionIds()
const viewportPos = core.requests.render.getViewportPosition()

// Business logic orchestration
addRectangle(data: CreateElementData): void {
  startTransaction()
  const elementId = requests.sceneTree.addRectangle(data, inUndoRedo)
  requests.selection.selectElements([elementId])
  endTransaction()
}
```

## Testing Architecture

### Mocking Dynamically Assigned Methods

For classes using `Object.assign()` (like `@asyra/core`):

```typescript
// ❌ Don't use spyOn - fails on dynamically assigned methods
vi.spyOn(core, 'propsLoadData')

// ✅ Use direct assignment - always works
core.propsLoadData = vi.fn()
```

### Test Philosophy

- Focus on behavior documentation
- Test critical paths and edge cases
- Meaningful tests over coverage metrics
- Simplified mocking strategy (real instances vs extensive mocks)
- `test:local` scripts for clean development testing

## E2E Testing Architecture

### Playwright Integration

- **Purpose**: End-to-end UI testing for the application
- **Test Coverage**: Element creation, selection, properties, undo/redo, viewport navigation
- **CI/CD Integration**: Automated runs on PR triggers and daily schedule
- **Test Environment**: Production build + preview server
- **Key Pattern**: Uses `data-testid` attributes for stable element selection

### E2E Test Scripts

- `scripts/run-e2e.sh`: Complete test orchestration (build → serve → test → cleanup)
- `yarn test:e2e`: Playwright test execution
- `apps/asyra-design/playwright.config.ts`: Test configuration with CI/CD environment support

### E2E Best Practices

- Use `data-testid` for stable element selection
- Support cross-platform keyboard shortcuts
- Expose internal state with data attributes
- Focus neutral areas to avoid triggering tools

## Skills Management System

### OpenSkills Integration

- **Purpose**: Modular AI agent capabilities loaded on-demand
- **Location**: `docs/ai/skills/` directory with structured skill definitions
- **Management**: `scripts/update-skills.sh` for catalog synchronization
- **Catalog**: `docs/ai/skills/README.md` with available skills and usage patterns

### Available Skills

- **git-operations**: Git/gh CLI separation rule enforcement
- **frontend-design**: Production-grade UI component design
- **webapp-testing**: Playwright-based application testing
- **mcp-builder**: MCP server creation and integration
- **brand-guidelines**: Anthropic brand standards application
- **theme-factory**: Professional theme styling
- **algorithmic-art**: Generative art creation
- **internal-comms**: Professional communication templates
- **skill-creator**: Custom skill development

## Input System Architecture

### Cross-Platform Support

- Detects platform (Mac vs Windows/Linux)
- Maps Meta key on Mac, Control on others
- Consistent keyboard shortcuts across platforms
- Event mapping system for tool-specific actions

### Event Flow

1. Raw keyboard/mouse events captured
2. Input system maps to standardized actions
3. Actions sent to interaction-core via events
4. Interaction core decides on behavior
5. Decision published via events
6. Core subscribes and executes actions

## UI Context Architecture

### Reactive State Management

- RxJS-based reactive streams
- YJS integration for collaborative features
- Optimized data transformation for UI
- Framework-agnostic design patterns

### Data Optimization

- Efficient diffing and updates
- Memoized computed values
- Batch updates for performance
- Memory-efficient subscriptions

## Property Management System

### Structured Data

- Separate from scene tree hierarchy
- Component-based property organization
- Type-safe property definitions
- Reactive updates via events

### API Integration

- Request APIs for synchronous access
- Event-driven updates for changes
- Serialization support for persistence
- Validation and type checking
