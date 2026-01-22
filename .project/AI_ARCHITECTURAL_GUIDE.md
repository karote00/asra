## AI Architectural Guide for Asra Project

This document consolidates key architectural principles, interaction patterns, data manipulation rules, and collaboration guidelines specific to the Asra project. It serves as a living guide for AI agents to ensure implementations are consistent, correct, and aligned with the project's design.

### I. Core Architectural Principles

1.  **Input Event Granularity:**

    - The `input-system` emits only raw, low-level input events (e.g., `mousedown`, `mousemove`, `mouseup`, `keydown`, `keyup`, `wheel`).
    - It **does not** abstract these into higher-level composite events (e.g., `drag`, `click`, `double-click`) within its own scope.
    - Higher-level interpretation and decision-making occur in `interaction-core`.

2.  **Clear Separation of Concerns:**

    - Each package/module has a distinct responsibility.
    - Modules communicate primarily through an event-driven system (`reactive-events`).

3.  **Centralized System Context:**
    - The `system-context` package is the single source of truth for the current state of the system (e.g., active primary tool, mouse position, keyboard modifiers).
    - This context is accessible via `systemContext.getSystemContextSnapshot()`.

### II. Package Ecosystem

The Asra monorepo is divided into specialized packages, each with a clear responsibility:

- **`apps/ui`**: The main React application entry point, containing UI components and layout. Built with React 19, Vite, and Tailwind CSS.
- **`packages/core`**: The central orchestrator with request-response architecture. Provides unified API surface and dependency injection for synchronous operations.
- **`packages/input-system`**: Captures raw browser events and maps them to internal input actions.
- **`packages/interaction-core`**: The brain of the operation. Decides how to respond to input actions based on current rules and behaviors.
- **`packages/reactive-events`**: The event bus definitions. All cross-package communication happens via these events. Streamlined for request-response pattern.
- **`packages/system-context`**: Holds global ephemeral state (mouse position, active tool, held keys) with direct access API.
- **`packages/scene-tree`**: Manages the document model (elements, hierarchy) and provides real-time updates with request API integration.
- **`packages/factory`**: Manages data transactions, undo/redo history, and strictly coupled operations.
- **`packages/selection`**: Manages selection state and logic (what is currently selected).
- **`packages/props-manager`**: Manages property definitions and updates with reactive state integration.
- **`packages/render`**: Handles rendering logic (PixiJS canvas) with viewport and selection layer management.
- **`packages/ui-context`**: UI-specific state management using Preact signals and reactive subjects for real-time updates.
- **`packages/utils`**: Shared utilities and helpers including type definitions and constants.

### III. User Interaction Flow (Updated for Interaction Core V2)

This section details the precise flow for handling user interactions, particularly those involving tools and state changes.

1.  **Input System (`packages/input-system`):**

    - **Responsibility:** Detects input combinations.
    - **Action:** Triggers input actions defined in `src/event-mappings.ts`.
    - **Flow:** Emits `Input Action` -> `packages/core` (via `src/subscribes/input-system`) -> Notifies `interaction-core`.

2.  **Interaction Core Decider (`packages/interaction-core`):**

    - **Responsibility:** Receives action/session data and makes the **Final Decision**.
    - **Logic:** Uses `src/decider/rules` (logic) and `src/decider/behavior` (flow control).
    - **Action:** Decides on an `InteractionAction`.

3.  **Interaction Core Handlers (`packages/interaction-core/src/handlers`):**

    - **Responsibility:** Executes the decision logic.
    - **Action:** Publishes the final **Decision Event** via `packages/reactive-events`.

4.  **Core Subscription (`packages/core/src/subscribes/interaction-core`):**
    - **Responsibility:** Listens to the Decision Events.
    - **Action:** Calls the actual System APIs (`packages/core/src/apis`) to modify state (Factory, SceneTree, etc.).

**Summary:** `Input` -> `Core (Input Sub)` -> `Interaction Core (Decider -> Handler)` -> `Reactive Event` -> `Core (Interaction Sub)` -> `System API`.

### IV. Data Manipulation & Transaction System

This defines how data changes are managed, particularly concerning undo/redo.

1.  **Transaction Boundaries (`factory`):**

    - `factory.startTransaction()`: Marks the beginning of a single, undoable unit of work. Called once at the start of a complete user action (e.g., when a rectangle creation begins).
    - `factory.endTransaction()`: Commits the changes accumulated within the transaction as a single undoable unit. Called once at the end of a complete user action.

2.  **Undoable Changes (`factory.updateTransaction()`):**

    - `factory.updateTransaction()`: Used for data changes that should be part of the undo/redo history.
    - **Example:** `SCENE_TREE_ACTIONS.ADD_ELEMENT`, `SELECTION_ACTIONS.SELECT_ELEMENTS`.

3.  **Real-time, Non-Undoable Updates (`sceneTree.updateComputedData()`):**

    - `sceneTree.updateComputedData()`: Used for direct, real-time property updates that occur frequently during an interaction (e.g., resizing an element during a drag).
    - These changes are **not** part of the transaction's undo stack.

4.  **Implicit Operation on Selected Elements:**
    - Many `sceneTree` APIs (e.g., `changeComputedData`, `updateComputedData`) implicitly operate on the currently selected elements.
    - This means that for property updates on selected elements, the `id` parameter is often **not needed** in the API call, as the system will apply the change to all currently selected elements.

### V. AI Workflow & Collaboration Rules (Consolidated from `AI_WORKFLOW_GUIDE.md`)

This section outlines the standard workflow for AI-assisted tasks, emphasizing upfront planning, human review, and continuous improvement.

1.  **Pre-Implementation Documentation:**

    - **Golden Path:** Detailed user interaction flow (`.project/golden-paths/`).
    - **BDD Features:** Behavior-Driven Development feature files (`.project/bdd-features/`).
    - **Task Breakdowns:** Detailed sub-tasks with objectives, file changes, and dependencies (`.project/task-breakdowns/`).

2.  **User Review & Approval:**

    - **Absolutely no commits without explicit user review and approval.** (Stored in `save_memory`).
    - AI will present plans and documentation for review before implementation.

3.  **Self-Verification:**

    - **Comprehensive Testing:** Plan for and execute unit, integration, and E2E tests. AI will determine the most appropriate test type and framework (e.g., Playwright for E2E on canvas features).
    - **Code Quality:** Run project-specific linting and type-checking (`yarn lint:ci`).
    - **Build Verification:** Ensure the project successfully builds (`yarn react:build`).

4.  **Loop Detection & Intervention:**

    - If the AI finds itself repeatedly executing the same or similar commands, encountering the same errors, or making no discernible progress after a predefined number of attempts (e.g., 3-5 attempts), it will consider itself "stuck in a loop."
    - In such cases, the AI will immediately halt the current sub-task, report the issue to the user (stating the sub-task, recurring problem, attempted steps, and reason for being stuck), and request user intervention/guidance.

5.  **Communication & Clarification:**

    - AI will communicate ambiguities, unexpected issues, or deviations from the plan.
    - User can request the AI to "think out loud" at any point.

6.  **`save_memory` Tool:**
    - Used to store specific, user-defined facts or critical instructions for long-term retention across sessions.

### VI. AI Limitations & Learning Points (Self-Reflection)

This section highlights common pitfalls for the AI to avoid, based on past misunderstandings.

- **Do not assume general patterns apply:** Always verify existing implementations and architectural patterns within the specific project context before proposing solutions.
- **Verify existing implementations:** Never assume a feature or flow is absent without thorough investigation of the codebase.
- **Distinguish event layers:** Clearly differentiate between raw input events, high-level decided actions, and the implementation logic that responds to those actions.
- **Understand transaction boundaries:** Be precise about when `startTransaction`, `updateTransaction`, and `endTransaction` are used, and when direct, non-undoable updates are appropriate.

### VII. Communication-Driven Development (CDD) Insights

This section summarizes key insights into the CDD paradigm, guiding the "Why" behind the architecture above.

#### 1. Defining CDD

CDD is an **architectural paradigm** where the design and interaction of system components are primarily centered around explicit, well-defined communication channels. It is a specific flavor of Event-Driven Architecture (EDA) tailored for interactive applications.

#### 2. Core Components and Their Roles

- **Event-Driven Communication (`@asra/reactive-events`)**: The primary _mechanism_ for intended actions. Modules publish events to announce intentions ("I want something to happen").
- **Centralized Orchestration (`@asra/core`)**: Acts as middleware. It listens to inputs/events and decides which subsequent communications need to be initiated.
- **Collaborative Data Flow (YJS/CRDT)**: Manages _state_. Events signal _actions_, but YJS handles the _real data_. Components observe YJS for granular data changes (CRDT capabilities).
- **Transaction Management (`@asra/factory`)**: Manages the custom undo/redo system.

#### 3. Key Principles

- **Event Flow vs. Data Flow**: Events signal _actions_ (what happened), while YJS handles _state_ (current truth). Separating these is fundamental.
- **Decoupling**: Components communicate via explicit event contracts, reducing tight coupling.
- **Dynamic Update Strategies**: Components can choose to react immediately to YJS changes or batch updates based on transaction boundaries for performance.

#### 4. Why CDD?

It provides a resilient foundation that minimizes the need for major architectural refactors by prioritizing explicit communication and decoupling upfront.

### VII. Request-Response Architecture

#### 1. Defining the Request Pattern

The project has evolved from purely event-driven communication to include a **request-response pattern** for synchronous data access.

**Key Components**:

- **Request Layer**: Pure synchronous data access methods injected into core
- **API Layer**: Business logic orchestration that uses requests
- **Event Layer**: Reactive communication for cross-package messaging

**Benefits**:

- **Improved Testability**: Direct method calls instead of async event chains
- **Type Safety**: Strongly typed request/response interfaces
- **Performance**: Synchronous data operations without async overhead
- **Clarity**: Clear separation between data access and business logic

#### 2. Request API Implementation

```typescript
// Request Layer Example
interface SystemContextRequests {
  getSystemContextSnapshot(): SystemContextSnapshot
}

// API Layer Example
class Core {
  private requests: {
    systemContext: SystemContextRequests
    // ... other domains
  }

  getCurrentTool(): PrimaryToolType {
    return this.requests.systemContext.getSystemContextSnapshot().primaryTool
  }
}
```

### VIII. Skills Integration System

#### 1. OpenSkills Framework

The project integrates **OpenSkills** for modular AI capabilities:

**Key Features**:

- **On-Demand Loading**: Skills loaded when needed via `npx openskills read`
- **Modular Architecture**: 10 specialized skills for different domains
- **Catalog Management**: `.project/SKILLS.md` with usage patterns
- **Version Control**: Skills can be updated independently

**Available Skills**:

- **git-operations**: Git/gh CLI separation rule enforcement
- **frontend-design**: Production-grade UI component design
- **webapp-testing**: Playwright-based application testing
- **mcp-builder**: MCP server creation and integration

#### 2. Skills-Based Development Workflow

When encountering specialized tasks:

1. **Identify** domain-specific requirements
2. **Load** relevant skill: `npx openskills read <skill-name>`
3. **Follow** skill-specific guidance and patterns
4. **Execute** using recommended tools and approaches

### IX. Modern Testing Architecture

#### 1. Comprehensive Testing Strategy

The project implements **multi-level testing**:

**Unit Testing**:

- **Behavior-Focused**: Tests document "how it works" over coverage
- **Simplified Mocking**: Direct assignment instead of complex mocking
- **Request API Testing**: Direct testing of synchronous operations

**E2E Testing**:

- **Playwright Framework**: Browser automation for UI workflows
- **Production Environment**: Testing against built application
- **CI/CD Integration**: Automated runs on PR triggers and schedules

**Test Commands**:

```bash
yarn test:local              # Clean output for development
yarn workspace @package/test:ci  # CI format with coverage
yarn test:e2e                # End-to-end test suite
bash scripts/run-e2e.sh      # Complete E2E orchestration
```

#### 2. Testing Best Practices

- **data-testid Attributes**: Stable element selection for E2E
- **Cross-Platform Support**: Meta/Control key mappings
- **Real Scenarios**: User workflow-based test cases
- **Visual Regression**: Consistency verification
