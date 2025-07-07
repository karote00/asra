# Collaborative Documentation Guide: An AI-Human Partnership

This guide outlines a systematic process for an AI agent and a human collaborator to work together in generating comprehensive, accurate, and valuable project documentation. It leverages the strengths of both AI (rapid analysis, pattern recognition) and human insight (intent, context, strategic decisions).

## Goal

To produce a complete set of project metadata including Architecture overviews, detailed API references, explicit Design Principles, illustrative Golden Paths, and behavioral BDD Gherkin specifications, ensuring a shared understanding of the codebase.

## Phase 1: Initial Project Analysis (AI-driven)

**AI Agent Action**: Upon receiving this guide, the AI agent's first task is to perform a comprehensive, unguided analysis of the entire project codebase. The goal is to build a foundational understanding of the project's structure, technologies, and apparent patterns.

-   **Reference**: The AI agent should consult the guidelines in `ai_analysis_prompt.md` for specific areas to prioritize during this analysis.
-   **Output**: The AI agent will generate an "Initial Project Understanding Report." This report will be written to a file (e.g., `.project/reports/initial_project_understanding.md`) to avoid excessive token usage and provide a persistent record. It will summarize its findings, including identified technologies, module structures, observed code patterns, and a preliminary assessment of potential documentation gaps or ambiguities.

## Phase 2: Collaborative Refinement & Gap Identification (AI & Human)

**AI Agent Action**: The AI agent will present the "Initial Project Understanding Report" to the human collaborator.

-   **Human Collaborator Action**: The human collaborator will review the report, confirming accurate inferences, correcting misunderstandings, and, most importantly, providing the crucial "why" and "intent" behind the project's design. The human will also identify specific areas where deeper documentation is needed.
-   **AI Agent Action**: The AI agent will engage in a dialogue with the human, asking targeted questions in **small, focused groups** to clarify ambiguities and gather missing context. Key areas for human input include:
    *   **Core Responsibilities**: Explicitly define the purpose and boundaries of each major module/package.
    *   **Design Principles**: Articulate strict architectural rules, conventions, and strategic decisions (e.g., state management, transaction patterns, coding style).
    *   **Golden Paths**: Identify critical, end-to-end user journeys that demonstrate core functionality.
    *   **API Details**: Clarify the precise behavior, parameters, and return values of public APIs, especially where JSDoc is missing or unclear.
    *   **Technical Debt/Known Issues**: Any undocumented complexities or areas requiring future attention.

## Phase 3: Systematic Documentation Generation (AI-driven, Human-validated)

**AI Agent Action**: Based on the refined understanding from Phase 2, the AI agent will systematically generate the required documentation, adhering to established standards.

-   **Documentation Types to Generate (as guided by human)**:
    *   **Architecture Documents**: For each major package/module (e.g., `architecture/<package-name>.md`).
    *   **API Reference Documents**: Detailed API specifications for public interfaces (e.g., `apis/<package-name>.md`), following `api_documentation_standard.md`.
    *   **Design Principle Documents**: Formalizing architectural rules and conventions (e.g., `design-principles/event-creation-process.md`, `state-management.md`, `transaction-management.md`, `update-strategies.md`).
    *   **Golden Path Narratives**: Step-by-step descriptions of critical user journeys (e.g., `golden-paths/<feature-name>.md`).
    *   **BDD Gherkin Specifications**: Behavioral specifications for features (e.g., `features/<feature-name>.feature`).

-   **Process for Each Document**: For each document, the AI agent will:
    1.  Generate the content.
    2.  Present it to the human collaborator for review.
    3.  Incorporate feedback and make revisions.
    4.  **ONLY COMMIT AFTER EXPLICIT HUMAN APPROVAL.**

## Phase 4: Maintenance & Evolution

**Human Collaborator Action**: The human collaborator is responsible for initiating updates to this documentation as the project evolves.

-   **AI Agent Action**: The AI agent can assist in maintaining documentation by:
    *   Identifying discrepancies between code and existing documentation.
    *   Generating new documentation for new features or refactorings, following the established process.
    *   Answering queries based on the documented knowledge base.

## Conclusion

This collaborative framework ensures that project documentation is not merely a static artifact, but a living, accurate, and invaluable resource that grows with the project, fostering a deep shared understanding between human developers and AI agents.
