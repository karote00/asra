# Collaborative Documentation EPIC: Handoff-Powered Documentation

This EPIC outlines a systematic process for generating comprehensive project documentation that serves as persistent knowledge for both humans and AI. It adapts to different levels of human engagement while ensuring consistent, valuable output.

## Goal

To produce a complete Handoff knowledge base including Architecture overviews, API references, Design Principles, Golden Paths, and BDD specifications that enable smooth knowledge transfer across team members and AI sessions.

## Engagement Level Selection

**Choose your preferred engagement level:**

### 🤝 High Engagement (Collaborative)
- You'll provide detailed architectural insights and review each phase
- Best for: Senior developers, architects, or when building critical documentation

### 🎯 Medium Engagement (Guided)  
- You'll provide high-level goals, AI handles details with your approval
- Best for: Busy developers who want quality output with minimal time investment

### 🚀 Auto-Pilot (Autonomous)
- You describe what you want, AI figures out everything else
- Best for: Junior developers, rapid prototyping, or when you trust AI judgment

*AI will adapt the process below based on your chosen engagement level.*

## Phase 1: Initial Project Analysis (AI-driven)

**AI Agent Action**: Upon receiving this guide, the AI agent's first task is to perform a comprehensive, unguided analysis of the entire project codebase. The goal is to build a foundational understanding of the project's structure, technologies, and apparent patterns.

-   **Reference**: The AI agent should consult the [Analysis Prompt Appendix](../COLLABORATIVE_DOCUMENTATION_GUIDE.md#appendix-ai-initial-project-analysis-prompt) for specific areas to prioritize during this analysis.
-   **Output**: The AI agent will generate an "Initial Project Understanding Report." This report will be written to a file (e.g., `.project/reports/initial_project_understanding.md`) to avoid excessive token usage and provide a persistent record. It will summarize its findings, including identified technologies, module structures, observed code patterns, and a preliminary assessment of potential documentation gaps or ambiguities.

## Phase 2: Collaborative Refinement & Gap Identification

### 🤝 High Engagement Mode
**AI Agent Action**: Present the "Initial Project Understanding Report" to the human collaborator.

**Human Collaborator Action**: Review the report, confirm accurate inferences, correct misunderstandings, and provide the crucial "why" and "intent" behind design decisions.

**AI Agent Action**: Engage in detailed dialogue, asking targeted questions about:
- **Core Responsibilities**: Purpose and boundaries of each module/package
- **Design Principles**: Architectural rules, conventions, and strategic decisions
- **Golden Paths**: Critical end-to-end user journeys
- **API Details**: Precise behavior, parameters, and return values
- **Technical Debt/Known Issues**: Undocumented complexities

### 🎯 Medium Engagement Mode
**AI Agent Action**: Present key findings and ask focused, multiple-choice questions.

**Human Collaborator Action**: Answer high-level questions about project goals and priorities.

**AI Agent Action**: Make reasonable assumptions for detailed decisions, document them in `.project/ASSUMPTIONS.md` for later review.

### 🚀 Auto-Pilot Mode
**AI Agent Action**: Analyze existing codebase patterns to infer:
- Module responsibilities from code structure and naming
- Design principles from consistent patterns across the codebase
- API behavior from implementation and usage patterns
- Critical paths from main application flows

**Fallback Strategy**: When human input is unavailable:
1. Infer principles from existing code patterns
2. Apply industry best practices as defaults
3. Document all assumptions in `.project/ASSUMPTIONS.md`
4. Use conservative, safe architectural choices
5. Flag areas needing future human review

## Phase 3: Systematic Documentation Generation

### Documentation Types Generated
- **Architecture Documents**: For each major package/module (`architecture/<package-name>.md`)
- **API Reference Documents**: Detailed specifications (`apis/frontend/<package-name>.md` or `apis/backend/<service-name>.md`)
- **Design Principle Documents**: Architectural rules and conventions (`design-principles/`)
- **Golden Path Narratives**: Critical user journeys (`golden-paths/<feature-name>.md`)
- **BDD Gherkin Specifications**: Behavioral specifications (`bdd-features/<feature-name>.feature`)
- **Assumptions Log**: AI decisions and reasoning (`.project/ASSUMPTIONS.md`)

### 🤝 High Engagement Process
For each document, AI will:
1. Generate initial content
2. Present to human for detailed review
3. Incorporate feedback through iterative discussion
4. **ONLY COMMIT AFTER EXPLICIT HUMAN APPROVAL**

### 🎯 Medium Engagement Process
For each document, AI will:
1. Generate content based on Phase 2 assumptions
2. Present summary and key decisions to human
3. Human provides quick approve/reject/modify feedback
4. AI makes adjustments and commits with human sign-off

### 🚀 Auto-Pilot Process
AI will:
1. Generate all documentation based on codebase analysis
2. Create comprehensive `.project/assumptions.md` explaining all decisions
3. Commit documentation with clear assumption markers
4. Flag areas where human review would be most valuable

### Quality Assurance (All Modes)
- **Consistency Check**: Ensure all documents align with detected patterns
- **Completeness Check**: Verify all major components are documented
- **Accuracy Validation**: Cross-reference documentation with actual code
- **Future-Proofing**: Mark areas likely to need updates as code evolves

## Phase 4: Maintenance & Evolution

**Human Collaborator Action**: The human collaborator is responsible for initiating updates to this documentation as the project evolves.

-   **AI Agent Action**: The AI agent can assist in maintaining documentation by:
    *   Identifying discrepancies between code and existing documentation.
    *   Generating new documentation for new features or refactorings, following the established process.
    *   Answering queries based on the documented knowledge base.

## Conclusion

This collaborative framework ensures that project documentation is not merely a static artifact, but a living, accurate, and invaluable resource that grows with the project, fostering a deep shared understanding between human developers and AI agents.
