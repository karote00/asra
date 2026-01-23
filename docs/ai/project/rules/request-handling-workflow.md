## 6. Request Handling Workflow

When receiving a new request, follow these steps:

1.  **Start Planning & Context Retrieval:** Begin by thoroughly understanding the request and outlining a high-level plan, including writing down the Product Requirements Document (PRD) and BDD scenarios. Query `context-rag ai "your question"` to retrieve relevant existing documentation and context from the `.project` folder.
2.  **Update Epics:** Use `handoff-ai` commands to document or update relevant epic files in the `docs/ai/project/epics/` directory.
3.  **Update BDD Files:** Use `handoff-ai` commands to document or update Behavior-Driven Development (BDD) files in the `docs/ai/project/features/` directory.
4.  **Update Golden Path Files:** Use `handoff-ai` commands to document or update golden path files in the `docs/ai/project/golden-paths/` directory, ensuring the proposed solution is workable and fits the architecture.
5.  **Review Design Principles:** Review existing design principle files in `docs/ai/project/design-principles/` to ensure alignment. Only update these files if absolutely necessary and after careful consideration, using `handoff-ai` commands if changes are required.
6.  **Confirm Plan (BDD, Golden Paths, PRD):** User/engineers should review the PRD, BDD scenarios, and golden paths to ensure they represent a good and workable plan.
7.  **Implement Iteratively:** Begin implementation, committing changes for each logical step or small, verifiable unit of work.
8.  **Write/Update Unit Tests:** Develop or update unit tests to cover the new or modified functionality. Focus on writing meaningful tests rather than solely aiming for 100% coverage. Ensure tests are comprehensive and pass locally.
9.  **Validate Implementation:** Upon completion of implementation, perform thorough local validation by running:
    *   `yarn lint` (for linting and formatting)
    *   `yarn test:ci` (for unit and integration tests)
    *   `yarn react:build` (for building the application)
10. **Update Changelog:** Add your changes to the `CHANGELOG.md` file under the `## [Unreleased]` section. Follow the guidelines in `docs/ai/project/templates/changelog-template.md`. Document changes from the user's perspective and include `[BREAKING]` prefix for breaking changes.
11. **Push to GitHub:** Push the feature branch to GitHub.
12. **AI-Assisted Code Review:** Initiate an AI-assisted code review on the feature branch. The AI agent should utilize `handoff-ai`'s context-providing script to retrieve relevant project details (e.g., related Epics, BDDs, Golden Paths, API standards) before performing the review, ensuring a high-quality, context-aware assessment that verifies adherence to architecture, rules, and golden paths.
13. **Update Documentation Locally:** Once the AI-assisted code review (Step 12) is passed, the user/AI agent should update related documentation and specifications (e.g., architecture, APIs) locally to reflect the changes. This process should leverage `handoff-ai`'s capabilities for documentation generation and management. After local updates are complete and reviewed, push these changes to GitHub.

**Goals of this Workflow:**

*   Ensure clarity and shared understanding of the request.
*   Maintain a workable and efficient development process.
*   Keep documentation and specifications consistently up-to-date with the latest implementations.
