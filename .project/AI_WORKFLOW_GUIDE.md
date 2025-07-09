## Universal AI Software Engineering Workflow Guide

This guide outlines a universal workflow for AI agents in software engineering projects, designed to be adaptable regardless of the specific editor environment or the presence of multi-agent systems. The core principle is to provide a clear, structured process for an AI to approach and complete tasks, whether operating autonomously or orchestrating other agents.

**Vision**: Any user, regardless of their setup, can describe an EPIC, task, or requirement, and an AI agent can leverage this guide to drive the development process. If multi-agent capabilities are available, the main AI can break down sub-tasks and delegate them. If only a single AI is present, it will execute the entire process autonomously.

---

## Proposed Single-Agent Software Engineering Workflow

**Core Principle**: Iterative refinement and continuous self-verification, with explicit human review points.

---

### Default Operating Mode / Autonomy Principle

Unless explicitly asked for step-by-step interaction or detailed explanations, the AI agent will strive to autonomously complete tasks. Validation and confirmation will primarily be sought at key decision points (e.g., plan approval) and upon task completion.

---

#### **Phase 1: Task Understanding & Context Gathering**
*(AI-driven, Human-assisted)*

*   **Goal**: To fully comprehend the user's request and gather all necessary project context to form an accurate mental model of the problem space.
*   **My Actions**:
    *   **Assess User's Preferred Interaction Model & Environment**:
        *   **Check for Configuration**: Look for a project-specific configuration file (e.g., `GEMINI.md` in the project root) that specifies preferred interaction levels (e.g., "auto-execute," "ask for plan approval," "step-by-step") or available external tools/agents.
        *   **Clarify (if no config)**: If no such configuration is found, or if the task requires overriding defaults, I will ask a clarifying question at the start of a session (e.g., "What is your preferred level of interaction for this task?").
    *   **Initial Request Parsing**: Analyze the user's prompt for keywords, explicit requirements, and implied goals.
    *   **Codebase Exploration**: Extensively use `glob`, `search_file_content`, `read_file`, and `list_directory` to:
        *   Understand relevant file structures and locations.
        *   Identify existing code patterns, conventions, and architectural choices.
        *   Locate related tests, configuration files (e.g., `package.json`, `tsconfig.json`), and documentation.
    *   **Clarification (if needed)**: If the request is ambiguous, or if critical information is missing after initial exploration, I will ask concise, targeted clarifying questions to the user.
*   **Output**: An internal, comprehensive understanding of the task, its scope, and the relevant parts of the codebase.

---

#### **Phase 2: Detailed Planning & Self-Verification Strategy**
*(AI-driven, Human-reviewed)*

*   **Goal**: To develop a concrete, step-by-step plan to achieve the task, explicitly incorporating self-verification mechanisms.
*   **My Actions**:
    *   **Task Decomposition**: Break down the main task into smaller, manageable sub-tasks (e.g., "locate bug," "implement fix," "write test," "refactor function").
    *   **Tool Identification**: For each sub-task, identify the specific tools (`read_file`, `replace`, `write_file`, `run_shell_command`, etc.) and their arguments.
    *   **Self-Verification Integration**: This is crucial. I will plan for:
        *   **Testing**: Identify existing test commands (e.g., `npm test`, `pytest`) or propose writing new unit/integration tests if a safety net is missing.
        *   **Linting/Type-checking**: Identify and plan to run project-specific code quality checks (e.g., `eslint`, `tsc`, `ruff check`).
        *   **Debugging/Logging**: Plan for temporary debug statements or log outputs if complex logic needs to be traced.
    *   **Plan Formulation**: Construct a concise, high-level summary of the plan, including the proposed steps and verification strategy, to present to the user.
*   **Output**: A structured plan (e.g., "Here's my plan: 1. ... 2. ... Verification: ... Should I proceed?"). This is a critical human review point.

---

#### **Phase 3: Implementation & Iteration**
*(AI-driven, Self-correcting)*

*   **Goal**: To execute the approved plan, making necessary code changes and file operations, and to self-correct based on immediate feedback.
*   **My Actions**:
    *   **Execute Tool Calls**: Perform the planned `read_file`, `replace`, `write_file`, `run_shell_command` operations.
    *   **Monitor Outputs**: Carefully analyze the `stdout`, `stderr`, and `exit_code` from `run_shell_command` and the results from other tools.
    *   **Self-Correction Loop**:
        *   If a tool call fails or produces unexpected results (e.g., a linting error, a test failure), I will:
            *   Analyze the error message and context.
            *   Re-read relevant code or search for more information.
            *   Adjust my approach for the current sub-task.
            *   Retry the operation.
        *   This loop continues until the current sub-task is successfully completed or I determine I am fundamentally stuck and require human intervention.
    *   **Iterative Refinement**: Apply changes incrementally, verifying each step where feasible.

---

#### **Phase 4: Final Verification & Confirmation**
*(AI-driven, Human-reviewed)*

*   **Goal**: To ensure the overall task is successfully completed, meets all requirements, and is ready for final human approval.
*   **My Actions**:
    *   **Execute Final Verification**: Run all planned tests, linting, and type-checking commands to confirm code quality and correctness.
    *   **Status Report**:
        *   If all checks pass, I will report successful completion of the task.
        *   If checks fail, I will report the failures and return to Phase 3 for further implementation/correction.
    *   **Commit Proposal**: If the task involves code changes, I will propose a draft commit message and ask for user confirmation before committing.
*   **Output**: Confirmation of task completion, or a report of remaining issues.

---

**The Human's Invaluable Role**: Even with this structured process, your input remains critical for:
*   **Initial Clarification**: Providing context and intent that I cannot infer.
*   **Plan Review**: Approving or refining my proposed plans.
*   **Domain Knowledge**: Correcting my misunderstandings or providing deeper "why" for architectural decisions.
*   **Guidance when Stuck**: Helping me break out of loops or re-evaluate my approach when I encounter complex issues.
