## Universal AI Software Engineering Workflow Guide

This guide outlines a universal workflow for AI agents in software engineering projects, designed to be adaptable regardless of the specific editor environment or the presence of multi-agent systems. The core principle is to provide a clear, structured process for an AI to approach and complete tasks, whether operating autonomously or orchestrating other agents.

**Vision**: Any user, regardless of their setup, can describe an EPIC, task, or requirement, and an AI agent can leverage this guide to drive the development process. If multi-agent capabilities are available, the main AI can break down sub-tasks and delegate them. If only a single AI is present, it will execute the entire process autonomously.

---

### Phase 1: Strategic Thinking & Task Understanding

*   **Goal**: To fully comprehend the user's request, its strategic importance, and gather all necessary project context to form an accurate mental model of the problem space.
*   **AI Actions**:
    *   **Assess User's Preferred Interaction Model & Environment**:
        *   **Check for Configuration**: Look for a project-specific configuration file (e.g., `GEMINI.md` in the project root) that specifies preferred interaction levels (e.g., "auto-execute," "ask for plan approval," "step-by-step") or available external tools/agents.
        *   **Clarify (if no config)**: If no such configuration is found, or if the task requires overriding defaults, the AI will ask a clarifying question at the start of a session (e.g., "What is your preferred level of interaction for this task?").
    *   **Initial Request Parsing**: Analyze the user's prompt for keywords, explicit requirements, and implied goals.
    *   **Codebase Exploration**: Extensively use `glob`, `search_file_content`, `read_file`, and `list_directory` to:
        *   Understand relevant file structures and locations.
        *   Identify existing code patterns, conventions, and architectural choices.
        *   Locate related tests, configuration files (e.g., `package.json`, `tsconfig.json`), and documentation.
    *   **Clarification (if needed)**: If the request is ambiguous, or if critical information is missing after initial exploration, the AI will ask concise, targeted clarifying questions to the user.
*   **Output**: An internal, comprehensive understanding of the task, its scope, and the relevant parts of the codebase.

---

### Phase 2: Requirement Double-Check & Detailed Planning

*   **Goal**: To confirm requirements with the user and develop a concrete, step-by-step plan, explicitly incorporating self-verification mechanisms.
*   **AI Actions**:
    *   **Pre-Implementation Documentation**: Generate the following documentation:
        *   **Golden Path:** A detailed, step-by-step description of the ideal user interaction or system flow for the new feature. This will be stored in `.project/golden-paths/`.
        *   **BDD Features:** Behavior-Driven Development (BDD) feature files outlining the desired behavior from a user's perspective. These will be stored in `.project/bdd-features/`.
        *   **Task Breakdowns:** A detailed plan breaking down the implementation into smaller, manageable sub-tasks. For each sub-task, the plan will specify:
            *   The objective of the sub-task.
            *   The specific code changes required (files to be modified, new files to be created).
            *   Any dependencies or prerequisites.
            These breakdowns will be stored in `.project/task-breakdowns/`.
    *   **Task Decomposition**: Break down the main task into smaller, manageable sub-tasks (e.g., "locate bug," "implement fix," "write test," "refactor function").
    *   **Tool Identification**: For each sub-task, identify the specific tools (`read_file`, `replace`, `write_file`, `run_shell_command`, etc.) and their arguments.
    *   **Self-Verification Integration**: This is crucial. The AI will plan for:
        *   **Testing**: Identify existing test commands (e.g., `npm test`, `pytest`). The AI will also determine the most appropriate test type (unit, integration, E2E) and framework (e.g., Playwright for E2E on canvas features) based on the task and project context, and propose writing new tests if a safety net is missing.
        *   **Linting/Type-checking**: Identify and plan to run project-specific code quality checks (e.g., `eslint`, `tsc`, `ruff check`).
        *   **Debugging/Logging**: Plan for temporary debug statements or log outputs if complex logic needs to be traced.
    *   **Plan Formulation**: Construct a concise, high-level summary of the plan, including the proposed steps and verification strategy, to present to the user.
*   **Output**: Structured documentation (Golden Path, BDD Features, Task Breakdowns) and a concise plan for user review and approval. This is a critical human review point.

---

### Phase 3: Implementation Path & Iteration

*   **Goal**: To execute the approved plan, making necessary code changes and file operations, and to self-correct based on immediate feedback.
*   **AI Actions**:
    *   **Execute Tool Calls**: Perform the planned `read_file`, `replace`, `write_file`, `run_shell_command` operations.
    *   **Monitor Outputs**: Carefully analyze the `stdout`, `stderr`, and `exit_code` from `run_shell_command` and the results from other tools.
    *   **Self-Correction Loop**:
        *   If a tool call fails or produces unexpected results (e.g., a linting error, a test failure), the AI will:
            *   Analyze the error message and context.
            *   Re-read relevant code or search for more information.
            *   Adjust its approach for the current sub-task.
            *   Retry the operation.
        *   This loop continues until the current sub-task is successfully completed or the AI determines it is fundamentally stuck and requires human intervention.
    *   **Iterative Refinement**: Apply changes incrementally, verifying each step where feasible.
*   **Output**: Progress on sub-tasks, with continuous self-verification.

---

### Phase 4: Review & Fix Issues

*   **Goal**: To ensure the overall task is successfully completed, meets all requirements, and is ready for final human approval.
*   **AI Actions**:
    *   **Execute Final Verification**: Run all planned tests (unit, integration, E2E), linting, and type-checking commands to confirm code quality and correctness.
    *   **Build Verification**: Ensure the project successfully builds, confirming it's ready for deployment.
    *   **Status Report**:
        *   If all checks pass, the AI will report successful completion of the task.
        *   If checks fail, the AI will report the failures and return to Phase 3 for further implementation/correction.
    *   **Commit Proposal**: If the task involves code changes, the AI will propose a draft commit message and ask for user confirmation before committing.
*   **Output**: Confirmation of task completion, or a report of remaining issues.

---

### Phase 5: Communication & Continuous Improvement

*   **Goal**: To maintain clear communication, address ambiguities, and learn from the process to enhance future performance.
*   **AI Actions**:
    *   **Communication and Clarification**: If the AI encounters ambiguities, unexpected issues, or needs to deviate from the approved plan, it will communicate these to the user for clarification and re-alignment. The user can also request the AI to "think out loud" at any point to understand its reasoning or current state.
    *   **Loop Detection and Intervention**: If the AI finds itself repeatedly executing the same or similar commands, encountering the same errors, or making no discernible progress towards a sub-task's objective after a predefined number of attempts (e.g., 3-5 attempts), it will consider itself "stuck in a loop." In such cases, the AI will immediately halt the current sub-task's execution, report the issue to the user (stating the sub-task, recurring problem, attempted steps, and reason for being stuck), and request user intervention/guidance.
    *   **Learning from Interactions**: The AI will continuously learn from user feedback, successful and unsuccessful attempts, and new information to improve its understanding and execution of future tasks.
*   **Output**: Clear communication with the user, and improved future performance.

---

### Default Operating Mode / Autonomy Principle

Unless explicitly asked for step-by-step interaction or detailed explanations, the AI agent will strive to autonomously complete tasks. Validation and confirmation will primarily be sought at key decision points (e.g., plan approval) and upon task completion.

---

### The Human's Invaluable Role

Even with this structured process, your input remains critical for:
*   **Initial Clarification**: Providing context and intent that the AI cannot infer.
*   **Plan Review**: Approving or refining the AI's proposed plans.
*   **Domain Knowledge**: Correcting the AI's misunderstandings or providing deeper "why" for architectural decisions.
*   **Guidance when Stuck**: Helping the AI break out of loops or re-evaluate its approach when it encounters complex issues.
