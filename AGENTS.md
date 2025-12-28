# Agent Protocol

## 1. The Prime Directive
You are working in a highly structured environment defined by the `.project/` directory.
Your FIRST action in any session MUST be to read `.project/AI_QUICK_START.md`.

## 2. Development Process
You MUST follow the **Universal AI Software Engineering Workflow** defined in `.project/AI_WORKFLOW_GUIDE.md`.
- **Start**: Phase 1 (Strategic Thinking)
- **Implement**: Phase 3 (Iterative)
- **Verify**: Phase 4 (Validate changes by running lint, test, and build scripts before committing. Use `yarn lint`, `yarn test:ci`, and `yarn react:build`.)
- **Finish**: Phase 5 (Sync Documentation)

## 3. Tool Awareness
Before writing custom scripts or manual code, check for existing project tools.
- **Event Generation**: Use `yarn gen:event` (See `.project/EVENT_ARCHITECT_CLI.md`).

## 4. Documentation Strategy
- Never invent new conventions without updating `.project/ASSUMPTIONS.md`.
- All architectural decisions must be reflected in `.project/AI_ARCHITECTURAL_GUIDE.md`.

## 6. Request Handling Workflow

When receiving a new request, follow these steps:

1.  **Start Planning & Context Retrieval:** Begin by thoroughly understanding the request and outlining a high-level plan, including writing down the Product Requirements Document (PRD) and BDD scenarios. Query `context-rag ai "your question"` to retrieve relevant existing documentation and context from the `.project` folder.
2.  **Update Epics:** Use `handoff-ai` commands to document or update relevant epic files in the `.project/epics/` directory.
3.  **Update BDD Files:** Use `handoff-ai` commands to document or update Behavior-Driven Development (BDD) files in the `.project/features/` directory.
4.  **Update Golden Path Files:** Use `handoff-ai` commands to document or update golden path files in the `.project/golden-paths/` directory, ensuring the proposed solution is workable and fits the architecture.
5.  **Review Design Principles:** Review existing design principle files in `.project/design-principles/` to ensure alignment. Only update these files if absolutely necessary and after careful consideration, using `handoff-ai` commands if changes are required.
6.  **Confirm Plan (BDD, Golden Paths, PRD):** User/engineers should review the PRD, BDD scenarios, and golden paths to ensure they represent a good and workable plan.
7.  **Implement Iteratively:** Begin implementation, committing changes for each logical step or small, verifiable unit of work.
8.  **Write/Update Unit Tests:** Develop or update unit tests to cover the new or modified functionality. Focus on writing meaningful tests rather than solely aiming for 100% coverage. Ensure tests are comprehensive and pass locally.
9.  **Validate Implementation:** Upon completion of implementation, perform thorough local validation by running:
    *   `yarn lint` (for linting and formatting)
    *   `yarn test:ci` (for unit and integration tests)
    *   `yarn react:build` (for building the application)
10. **Push to GitHub:** Push the feature branch to GitHub.
11. **AI-Assisted Code Review:** Initiate an AI-assisted code review on the feature branch. The AI agent should utilize `handoff-ai`'s context-providing script to retrieve relevant project details (e.g., related Epics, BDDs, Golden Paths, API standards) before performing the review, ensuring a high-quality, context-aware assessment that verifies adherence to architecture, rules, and golden paths.
12. **Automated Documentation Update (Post-CI):** After all CI checks have passed, ensure that related documentation and specifications (e.g., architecture, APIs) are automatically updated to reflect the changes. This can happen in two ways:
    *   **Scenario 1 (Local Update):** The user's PR is ready to merge. Docs are updated locally (e.g., via `handoff-ai` commands), reviewed, and pushed to the PR for merge.
    *   **Scenario 2 (CI-driven Update):** During the PR merge process, CI automatically triggers updates for specific documentation types (e.g., API reference generation from code). This is more complex for narrative docs and might involve automated validation or deployment of a static site. This step should leverage `handoff-ai`'s capabilities (e.g., `handoff-ai inject-docs`) and potentially custom scripts for `.project` Markdown files.

**Goals of this Workflow:**

*   Ensure clarity and shared understanding of the request.
*   Maintain a workable and efficient development process.
*   Keep documentation and specifications consistently up-to-date with the latest implementations.
