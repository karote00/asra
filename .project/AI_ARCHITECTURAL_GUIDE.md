## AI Architectural Guide for Asra Project

This document consolidates key architectural principles, interaction patterns, data manipulation rules, and collaboration guidelines specific to the Asra project. It serves as a living guide for AI agents to ensure implementations are consistent, correct, and aligned with the project's design.

### I. Core Architectural Principles

1.  **Input Event Granularity:**
    *   The `input-system` emits only raw, low-level input events (e.g., `mousedown`, `mousemove`, `mouseup`, `keydown`, `keyup`, `wheel`).
    *   It **does not** abstract these into higher-level composite events (e.g., `drag`, `click`, `double-click`) within its own scope.
    *   Higher-level interpretation and decision-making occur in `interaction-core`.

2.  **Clear Separation of Concerns:**
    *   Each package/module has a distinct responsibility.
    *   Modules communicate primarily through an event-driven system (`reactive-events`).

3.  **Centralized System Context:**
    *   The `system-context` package is the single source of truth for the current state of the system (e.g., active primary tool, mouse position, keyboard modifiers).
    *   This context is accessible via `systemContext.getSystemContextSnapshot()`.

### II. User Interaction Flow (Example: Interactive Element Creation)

This section details the precise flow for handling user interactions, particularly those involving tools and state changes.

1.  **Input System (`packages/input-system`):**
    *   **Responsibility:** Detects raw user input and emits `InputSystemEvents` (e.g., `INPUT_DRAG_START`, `INPUT_DRAG_UPDATE`, `INPUT_DRAG_END`).
    *   **Action:** Updates mouse/keyboard state within `system-context` and calls `interaction-core` session APIs (`startSession`, `updateSession`, `endSession`).
    *   **Crucial:** It **does not** contain tool-specific logic, nor does it directly interact with `factory`, `sceneTree`, or manage transactions.

2.  **Interaction Core (`packages/interaction-core`):**
    *   **Responsibility:** Receives `InputSystemEvents` and the `SystemContextSnapshot`. Its `InteractionDecider` component *decides* what high-level user action is intended based on the input event and the current system contexts (e.g., if the Rectangle Tool is active during a drag start).
    *   **Action:** Publishes a specific `InteractionEvent` (e.g., `CREATE_RECTANGLE_STARTED`, `UPDATE_RECTANGLE_PROPERTIES`, `CREATE_RECTANGLE_ENDED`) with relevant payload data.
    *   **Crucial:** It **does not** contain tool-specific *implementation* logic (e.g., calculating dimensions, adding elements), nor does it directly interact with `factory` or `sceneTree`. It acts as a dispatcher.

3.  **Interaction Core Handlers (`packages/interaction-core/src/handlers/`):**
    *   **Responsibility:** Subscribe to the specific `InteractionEvents` published by `InteractionDecider`. This is where the tool-specific *implementation logic* resides.
    *   **Action:** Perform the actual operations by calling APIs in `factory`, `sceneTree`, and `render`.
    *   **Crucial:** These handlers manage any transient state related to the ongoing interaction (e.g., `currentElementId`, `startX`, `startY` for a creation drag).

### III. Data Manipulation & Transaction System

This defines how data changes are managed, particularly concerning undo/redo.

1.  **Transaction Boundaries (`factory`):**
    *   `factory.startTransaction()`: Marks the beginning of a single, undoable unit of work. Called once at the start of a complete user action (e.g., when a rectangle creation begins).
    *   `factory.endTransaction()`: Commits the changes accumulated within the transaction as a single undoable unit. Called once at the end of a complete user action.

2.  **Undoable Changes (`factory.updateTransaction()`):**
    *   `factory.updateTransaction()`: Used for data changes that should be part of the undo/redo history.
    *   **Example:** `SCENE_TREE_ACTIONS.ADD_ELEMENT`, `SELECTION_ACTIONS.SELECT_ELEMENTS`.

3.  **Real-time, Non-Undoable Updates (`sceneTree.updateComputedData()`):**
    *   `sceneTree.updateComputedData()`: Used for direct, real-time property updates that occur frequently during an interaction (e.g., resizing an element during a drag).
    *   These changes are **not** part of the transaction's undo stack.

4.  **Implicit Operation on Selected Elements:**
    *   Many `sceneTree` APIs (e.g., `changeComputedData`, `updateComputedData`) implicitly operate on the currently selected elements.
    *   This means that for property updates on selected elements, the `id` parameter is often **not needed** in the API call, as the system will apply the change to all currently selected elements.

### IV. AI Workflow & Collaboration Rules (Consolidated from `AI_WORKFLOW_GUIDE.md`)

This section outlines the standard workflow for AI-assisted tasks, emphasizing upfront planning, human review, and continuous improvement.

1.  **Pre-Implementation Documentation:**
    *   **Golden Path:** Detailed user interaction flow (`.project/golden-paths/`).
    *   **BDD Features:** Behavior-Driven Development feature files (`.project/bdd-features/`).
    *   **Task Breakdowns:** Detailed sub-tasks with objectives, file changes, and dependencies (`.project/task-breakdowns/`).

2.  **User Review & Approval:**
    *   **Absolutely no commits without explicit user review and approval.** (Stored in `save_memory`).
    *   AI will present plans and documentation for review before implementation.

3.  **Self-Verification:**
    *   **Comprehensive Testing:** Plan for and execute unit, integration, and E2E tests. AI will determine the most appropriate test type and framework (e.g., Playwright for E2E on canvas features).
    *   **Code Quality:** Run project-specific linting and type-checking (`yarn lint:ci`).
    *   **Build Verification:** Ensure the project successfully builds (`yarn react:build`).

4.  **Loop Detection & Intervention:**
    *   If the AI finds itself repeatedly executing the same or similar commands, encountering the same errors, or making no discernible progress after a predefined number of attempts (e.g., 3-5 attempts), it will consider itself "stuck in a loop."
    *   In such cases, the AI will immediately halt the current sub-task, report the issue to the user (stating the sub-task, recurring problem, attempted steps, and reason for being stuck), and request user intervention/guidance.

5.  **Communication & Clarification:**
    *   AI will communicate ambiguities, unexpected issues, or deviations from the plan.
    *   User can request the AI to "think out loud" at any point.

6.  **`save_memory` Tool:**
    *   Used to store specific, user-defined facts or critical instructions for long-term retention across sessions.

### V. AI Limitations & Learning Points (Self-Reflection)

This section highlights common pitfalls for the AI to avoid, based on past misunderstandings.

*   **Do not assume general patterns apply:** Always verify existing implementations and architectural patterns within the specific project context before proposing solutions.
*   **Verify existing implementations:** Never assume a feature or flow is absent without thorough investigation of the codebase.
*   **Distinguish event layers:** Clearly differentiate between raw input events, high-level decided actions, and the implementation logic that responds to those actions.
*   **Understand transaction boundaries:** Be precise about when `startTransaction`, `updateTransaction`, and `endTransaction` are used, and when direct, non-undoable updates are appropriate.
### VI. Communication-Driven Development (CDD) Insights

This section summarizes key insights into the CDD paradigm, guiding the "Why" behind the architecture above.

#### 1. Defining CDD
CDD is an **architectural paradigm** where the design and interaction of system components are primarily centered around explicit, well-defined communication channels. It is a specific flavor of Event-Driven Architecture (EDA) tailored for interactive applications.

#### 2. Core Components and Their Roles
*   **Event-Driven Communication (`@asra/reactive-events`)**: The primary *mechanism* for intended actions. Modules publish events to announce intentions ("I want something to happen").
*   **Centralized Orchestration (`@asra/core`)**: Acts as middleware. It listens to inputs/events and decides which subsequent communications need to be initiated.
*   **Collaborative Data Flow (YJS/CRDT)**: Manages *state*. Events signal *actions*, but YJS handles the *real data*. Components observe YJS for granular data changes (CRDT capabilities).
*   **Transaction Management (`@asra/factory`)**: Manages the custom undo/redo system.

#### 3. Key Principles
*   **Event Flow vs. Data Flow**: Events signal *actions* (what happened), while YJS handles *state* (current truth). Separating these is fundamental.
*   **Decoupling**: Components communicate via explicit event contracts, reducing tight coupling.
*   **Dynamic Update Strategies**: Components can choose to react immediately to YJS changes or batch updates based on transaction boundaries for performance.

#### 4. Why CDD?
It provides a resilient foundation that minimizes the need for major architectural refactors by prioritizing explicit communication and decoupling upfront.
