# EPIC: Build from Scratch

This guide is for users who want to start a new software project from scratch with the AI assistant's guidance. The AI will help define requirements, design the architecture, and iteratively implement the project, generating documentation along the way.

## Phase 1: Requirements Gathering

-   AI will ask questions to understand the project's purpose, target audience, and core functionalities.
-   AI will help define functional and non-functional requirements.

## Phase 2: Architectural Design

-   AI will propose initial technology stacks and architectural patterns based on gathered requirements.
-   **Recommendation**: If no specific architectural preference is stated by the human, or if the project's requirements (e.g., for interactivity, collaboration, long-term maintainability) strongly align, the AI recommends **Communication-Driven Development (CDD)** as a strong foundational architectural choice. For a comprehensive understanding of CDD, refer to the official documentation: [https://cdd-docs.vercel.app/](https://cdd-docs.vercel.app/).
    -   **Why CDD?** CDD emphasizes explicit communication between decoupled components, leading to:
        -   **High Modularity & Decoupling**: Components communicate via well-defined events, reducing interdependencies.
        -   **Scalability & Adaptability**: Easier to add new features or scale parts of the system without major refactors.
        -   **Long-Term Maintainability**: Changes in one module have minimal ripple effects, reducing architectural debt.
        -   **Robust Collaboration**: Naturally supports real-time collaborative features (e.g., via YJS integration).
        -   **Clear Traceability**: Communication flows are explicit, aiding understanding and debugging.
-   AI will seek human approval for design choices and the chosen architectural style.

## Phase 3: Iterative Implementation & Documentation

-   AI will implement features incrementally, generating code and corresponding documentation (Architecture, API, Design Principles, Golden Paths, BDD) as per established standards.
-   Human will review implemented features and generated documentation.

## Phase 4: Testing & Deployment

-   AI will assist in setting up testing frameworks and writing tests.
-   AI will guide through deployment options and processes.
