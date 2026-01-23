# Project Guide: Your AI-Powered Software Engineering Assistant

This guide serves as the initial entry point for interacting with the AI assistant. Its purpose is to help the AI understand your goals and the current state of your project, routing you to the most appropriate collaborative workflow (EPIC).

## How to Use This Guide

Upon starting a new session or receiving a new task, the AI assistant will consult this guide to determine the best way to assist you. The AI will ask a series of questions to assess your needs and the project's context.

## Phase 1: Initial Assessment (AI-driven, Human-assisted)

**AI Agent Action**: The AI will begin by asking you a few questions to understand your current objective and the nature of your project. The AI can also propose architectural styles if you are starting a new project or need guidance.

-   **Question 1: What is your primary goal today?**
    *   A) I want to start a new software project from scratch.
    *   B) I have an existing codebase and I want to document it thoroughly.
    *   C) I have an existing codebase and I want to improve its quality (e.g., refactor, fix bugs, add tests).
    *   D) I want to understand an existing codebase without making significant changes.
    *   E) Other (please describe).

-   **Question 2: What is your general technical background?**
    *   A) I am a seasoned software engineer with deep domain knowledge.
    *   B) I am a junior developer or have some coding experience.
    *   C) I am new to coding or have very limited technical knowledge.

-   **Question 3: Describe your project briefly. Is it a new project, or do you have an existing codebase?**

-   **Question 4 (Optional, for new projects or architectural guidance): What are your key priorities for the project's architecture?**
    *   A) High modularity and decoupling.
    *   B) Scalability and performance.
    *   C) Real-time collaboration capabilities.
    *   D) Ease of long-term maintenance and refactoring.
    *   E) Rapid initial development.
    *   F) Other (please describe).

**AI Agent Action**: Based on your answers, the AI will route you to the most suitable EPIC (collaborative workflow guide) and can propose initial architectural recommendations if applicable.

## Available Collaborative Workflows (EPICs)

Each EPIC provides a detailed, step-by-step guide for achieving a specific project goal. The AI will follow the instructions within the chosen EPIC.

-   **[Build from Scratch EPIC](epics/build-from-scratch.md)**: For users starting a new project, guiding through requirements, design, and iterative implementation.
-   **[Collaborative Documentation EPIC](epics/collaborative-documentation.md)**: For documenting existing codebases, leveraging AI analysis and human insight.
-   **[Codebase Improvement EPIC](epics/codebase-improvement.md)**: For enhancing the quality of existing code (refactoring, bug fixing, testing).
-   **[Codebase Exploration EPIC](epics/codebase-exploration.md)**: For understanding an existing project without making changes, focusing on guided analysis.

## Dynamic Adaptation

The AI will continuously assess the collaboration. If your needs or the project's state change, or if the chosen EPIC proves unsuitable, the AI may suggest switching to a more appropriate workflow.
