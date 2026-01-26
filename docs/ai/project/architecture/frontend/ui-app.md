# Architecture: @asyra/asyra-design

## Overview

The `@asyra/asyra-design` application is the main React application that provides the user interface for the Asyra design tool. Built with modern React patterns, Vite build system, and Tailwind CSS styling.

## Technology Stack

### Core Framework

- **React 19**: Latest React with concurrent features and improved hooks
- **TypeScript**: Full type safety across the application
- **Vite 6**: Fast development build server and optimized production builds

### State Management

- **Preact Signals**: Fine-grained reactive state management (`@preact/signals-react`)
- **React Context**: Global application state and dependency injection
- **Local State**: Component-level state with React hooks

### Styling

- **Tailwind CSS**: Utility-first CSS framework
- **PostCSS**: Build-time CSS processing and optimization
- **Responsive Design**: Mobile-first responsive patterns

### Testing

- **Playwright**: End-to-end testing framework
- **Testing Library**: Component and unit testing utilities
- **User Event**: Testing library for user interaction simulation

## Application Structure

### Component Architecture

```
src/
├── components/          # Reusable UI components
├── constants.ts          # Application-wide constants
├── controllers/          # State management and business logic
├── hooks/              # Custom React hooks
├── properties/          # Property panel components
└── contents/           # Canvas and workspace components
```

### Key Architectural Patterns

#### 1. Controller Pattern

Controllers manage state and business logic for specific domains:

- **app.ts**: Main application controller
- **scene-tree.ts**: Scene tree state management
- **element-selection.ts**: Selection state and operations

#### 2. Reactive State Management

Using signals for fine-grained reactivity:

- **State Signals**: Reactive state containers
- **Computed Values**: Derived state calculations
- **Effect Hooks**: Side effect management

#### 3. Event-Driven Updates

Components receive updates through reactive event streams:

- **useEventStream()**: Custom hook for event subscription
- **Event Bus Integration**: Connection to `@asyra/reactive-events`
- **Automatic Unsubscription**: Cleanup on component unmount

## Core Dependencies

### Internal Packages

- `@asyra/core`: Main system orchestration and APIs
- `@asyra/design-system`: Reusable UI components
- `@asyra/ui-context`: UI-specific state management
- `@asyra/reactive-events`: Event-driven communication
- `@asyra/utils`: Shared utilities and types

### External Dependencies

- **React 19**: Component framework and hooks
- **Preact Signals**: Reactive state management
- **TanStack Virtual**: Virtual scrolling for performance
- **Tailwind CSS**: Styling framework

## Build Configuration

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 3000
  }
})
```

### Development Workflow

```bash
# Development
yarn react:start        # Start Vite dev server

# Production Build
yarn react:build      # Build for production

# Preview Build
yarn preview         # Preview production build
```

## Component Patterns

### 1. Property Panel Components

Modular property editing interface:

- **Dynamic Components**: Based on element type and selection
- **Real-time Updates**: Reactive to scene tree changes
- **Validation**: Input validation and type safety

### 2. Canvas Components

Workspace interaction and visualization:

- **Element Rendering**: Canvas-based element display
- **Selection Layer**: Visual feedback for selection
- **Viewport Controls**: Zoom and pan interactions

### 3. Debug Components

Development and debugging tools:

- **Debug Timeline**: Event and state history
- **Performance Metrics**: Render performance monitoring
- **State Inspection**: Real-time state viewer

## Testing Architecture

### E2E Testing Strategy

Comprehensive Playwright test suite:

- **User Workflows**: End-to-end interaction testing
- **Component Testing**: Individual component behavior
- **Visual Regression**: UI consistency verification

### Test Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  webServer: !process.env.CI,
  timeout: 30000
})
```

### Test Coverage

- **Element Creation**: Rectangle creation and manipulation
- **Selection Management**: Single and multi-selection
- **Properties Editing**: Real-time property updates
- **Tool Switching**: Primary tool changes
- **Viewport Navigation**: Pan and zoom operations
- **Undo/Redo**: Transaction management

## Data Flow Architecture

### UI → Core Communication

1. **User Interaction**: UI component captures user input
2. **Event Emission**: Through reactive events to `@asyra/core`
3. **State Update**: Core processes and updates system state
4. **Reactive Update**: UI components react to state changes

### Request API Integration

- **Synchronous Calls**: Direct data access through request APIs
- **Type Safety**: Fully typed request/response interfaces
- **Performance**: Optimized synchronous data operations

## Performance Considerations

### Rendering Optimization

- **Virtual Scrolling**: TanStack Virtual for large lists
- **Memoization**: React.memo and useMemo for expensive operations
- **Lazy Loading**: Component code splitting with React.lazy

### State Management

- **Signal Batching**: Batch state updates for performance
- **Selective Re-renders**: Targeted component updates
- **Memory Management**: Proper cleanup and unsubscription

## Development Guidelines

### Component Development

1. **Type Safety**: Full TypeScript coverage
2. **Reactive Patterns**: Use signals for state management
3. **Event Integration**: Proper reactive event subscription
4. **Testing**: Component and E2E test coverage

### State Management

1. **Controller Pattern**: Separate state logic from components
2. **Signal Usage**: Fine-grained reactive state
3. **Event-Driven**: Communicate through reactive events
4. **Cleanup**: Proper subscription management

This architecture provides a modern, performant foundation for the design tool UI while maintaining clean separation of concerns and comprehensive testability.
