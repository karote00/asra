# Collaborative Documentation Guide: An AI-Human Partnership

This guide outlines a systematic process for an AI agent and a human collaborator to work together in generating comprehensive, accurate, and valuable project documentation. It leverages the strengths of both AI (rapid analysis, pattern recognition) and human insight (intent, context, strategic decisions).

## Goal

To produce a complete set of project metadata including Architecture overviews, detailed API references, explicit Design Principles, illustrative Golden Paths, and behavioral BDD Gherkin specifications, ensuring a shared understanding of the codebase.

## Phase 1: Initial Project Analysis (AI-driven)

**AI Agent Action**: Upon receiving this guide, the AI agent's first task is to perform a comprehensive, unguided analysis of the entire project codebase. The goal is to build a foundational understanding of the project's structure, technologies, and apparent patterns.

-   **Reference**: The AI agent should consult the [Appendix: AI Initial Project Analysis Prompt](#appendix-ai-initial-project-analysis-prompt) for specific areas to prioritize during this analysis.
-   **Output**: The AI agent will generate an "Initial Project Understanding Report." This report will be written to a file (e.g., `.project/reports/project_understanding_report.md`) and will serve as a **single, consolidated, living document** that evolves throughout all phases of the collaboration. It will summarize its findings, including identified technologies, module structures, observed code patterns, and a preliminary assessment of potential documentation gaps or ambiguities.

## Appendix: AI Initial Project Analysis Prompt
This checklist outlines the key information an AI agent should prioritize identifying during Phase 1.

1.  **Project Type & Core Purpose**: Web app? Lib? CLI? Primary function?
2.  **Primary Technologies**: Languages, Frameworks.
3.  **Codebase Structure**: Monorepo? Logical units?
4.  **Key Entry Points**: Execution flow start.
5.  **Data Management**: State flow, YJS/CRDT presence?
6.  **Inter-Module Communication**: Event bus? APIs?
7.  **Testing & QA**: Test directories, frameworks.
8.  **Build & Deploy**: Scripts, CI/CD.
9.  **External Docs**: README links, project terminology.
