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

1.  **Start Planning & Context Retrieval:** Begin by thoroughly understanding the request and outlining a high-level plan. Query `context-rag ai "your question"` to retrieve relevant existing documentation and context from the `.project` folder.
2.  **Update Epics:** Use `handoff-ai` commands to document or update relevant epic files in the `.project/epics/` directory.
3.  **Update BDD Files:** Use `handoff-ai` commands to document or update Behavior-Driven Development (BDD) files in the `.project/features/` directory.
4.  **Update Golden Path Files:** Use `handoff-ai` commands to document or update golden path files in the `.project/golden-paths/` directory.
5.  **Review Design Principles:** Only update design principle files in `.project/design-principles/` if absolutely necessary and after careful consideration. These files are generally stable. Use `handoff-ai` commands if changes are required.
6.  **Confirm BDD and Golden Paths:** Double-check that the BDD and golden path definitions accurately reflect the request and are comprehensive.
7.  **Implement Iteratively:** Begin implementation, committing changes for each logical step or small, verifiable unit of work.
8.  **Write/Update Unit Tests:** Develop or update unit tests to cover the new or modified functionality. Ensure tests are comprehensive and pass locally.
9.  **Validate Implementation:** Upon completion of implementation, perform thorough validation by running:
    *   `yarn lint` (for linting and formatting)
    *   `yarn test:ci` (for unit and integration tests)
    *   `yarn react:build` (for building the application)
10. **Push to GitHub:** Push the feature branch to GitHub.
11. **AI-Assisted Code Review:** Initiate an AI-assisted code review on the feature branch. The AI agent should utilize `handoff-ai`'s context-providing script to retrieve relevant project details (e.g., related Epics, BDDs, Golden Paths, API standards) before performing the review, ensuring a high-quality, context-aware assessment.
12. **Automated Documentation Update (Post-CI):** After all CI checks have passed, ensure that related documentation and specifications (e.g., architecture, APIs) are automatically updated to reflect the changes. This step should leverage `handoff-ai`'s capabilities (e.g., `handoff-ai inject-docs`) and potentially custom scripts for `.project` Markdown files.

**Goals of this Workflow:**

*   Ensure clarity and shared understanding of the request.
*   Maintain a workable and efficient development process.
*   Keep documentation and specifications consistently up-to-date with the latest implementations.
