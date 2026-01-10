# Architecture Guide

Detailed technical architecture for the Asra project.

## Communication-Driven Development (CDD)

### Core Principles
1. **Event-Driven Communication**: All components communicate via typed events
2. **Centralized Orchestration**: `@asra/core` acts as middleware
3. **Transaction Management**: `@asra/factory` handles undo/redo
4. **Decoupled Components**: No direct function calls between packages

### User Interaction Flow
1. **Input System** → Detects input combinations → Emits `Input Action`
2. **Core** → Receives action → Notifies `interaction-core`
3. **Interaction Core** → Makes decision → Publishes `Decision Event`
4. **Core Subscription** → Listens to events → Calls System APIs

## Package Responsibilities

### `@asra/core` - System Orchestrator
- Central event subscription hub
- API delegation to other packages
- Methods assigned via `Object.assign()` from `createAPIs()`

### `@asra/interaction-core` - Decision Engine
- Receives action/session data
- Uses `src/decider/rules` (logic) and `src/decider/behavior` (flow)
- Publishes final decisions via events

### `@asra/reactive-events` - Event Bus
- Defines all cross-package communication events
- Typed event system for type safety

### `@asra/scene-tree` - Document Model
- Manages elements and hierarchy
- Provides real-time updates
- Implicit operations on selected elements

### `@asra/system-context` - Global State
- Single source of truth for system state
- Active tool, mouse position, keyboard modifiers
- Accessible via `systemContext.getSystemContextSnapshot()`

### `@asra/factory` - Transaction System
- `startTransaction()`: Begin undoable unit
- `updateTransaction()`: Add undoable changes
- `endTransaction()`: Commit as single unit

## Data Manipulation Rules

### Transaction Boundaries
- **Undoable Changes**: Use `factory.updateTransaction()`
- **Real-time Updates**: Use `sceneTree.updateComputedData()`
- **Implicit Selection**: Many APIs operate on currently selected elements

### Event vs Data Flow
- **Events**: Signal actions (what happened)
- **YJS/CRDT**: Handle state (current truth)
- Components observe YJS for granular data changes

## Testing Architecture

### Mocking Dynamically Assigned Methods
For classes using `Object.assign()` (like `@asra/core`):
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