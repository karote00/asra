# Asyra

**Asyra** is an open-source design tool prototype engineered to demonstrate advanced application architecture and human-AI collaboration patterns.

🌐 **[Live Demo](https://cdd-demo.vercel.app/)** - Try Asyra in your browser

## 🎯 Project Goals

Design tools involve complex architectural challenges and specialized patterns. Asyra aims to share proven solutions by embedding **expert-level patterns** directly into the codebase, helping developers and AI agents build with confidence. It serves as a reference implementation for:

*   **Communication-Driven Development (CDD)**: A philosophy prioritizing clear communication, implemented in this project via Event-Driven Architecture, BDD, and TDD. [Learn more about CDD →](https://cdd-docs.vercel.app/)
*   **AI-Native Workflow**: A repository structure (`.project/`) specifically optimized to allow AI agents to understand, navigate, and contribute to the codebase effectively.
*   **Knowledge Encoding**: Reducing the gap between developers by documenting not just the *code*, but the *decisions* and *patterns* (Golden Paths, Design Principles) directly in the repo.

## 🏗 Architecture: Communication-Driven Development (CDD)

Asyra follows **Communication-Driven Development (CDD)**. The core belief is simple: **No matter what tools or methodologies we use, their primary purpose must be to facilitate Communication.**

> 📖 **Learn More**: For a comprehensive guide to CDD principles and implementation patterns, visit the [CDD Documentation](https://cdd-docs.vercel.app/).

In this project, we implement CDD using:

*   **Architecture (Event-Driven)**: Components communicate via explicit **Events**, never direct calls. This ensures system parts understand *intent* without knowing *implementation*.
*   **Specification (BDD)**: We use Behavior-Driven Development to communicate requirements clearly between **Humans and AI**, reducing the gap between "what we want" and "what we build."
*   **Verification (TDD)**: We use Test-Driven Development to communicate reliability, ensuring that the system's behavior remains consistent as it evolves.

## 🛠 Repository Features

This repository includes a suite of tools and documentation located in the `.project/` directory to facilitate rapid development and onboarding:

*   **Golden Paths**: Step-by-step implementation guides for common patterns (e.g., "Adding a new tool").
*   **Generators**: CLI tools to scaffold events, interactions, and boilerplate code.
*   **Design Principles**: Codified rules to ensure architectural alignment.
*   **Task Breakdowns & Epics**: Comprehensive context for project features.

## 🚀 Getting Started

### Prerequisites
*   Node.js (v20.x)
*   Yarn (v4.3.1+)

### Installation

```bash
# Install dependencies
yarn install
```

### Running the App

```bash
# Start the development server
yarn dev:all
```

The app will run at `http://localhost:3000` (or similar, check console output).


## 🤝 Human & AI Collaboration

This project relies on structured documentation to enable AI agents to code effectively.
*   **Human Developers**: Refer to `.project/PROJECT_GUIDE.md`.
*   **AI Agents**: Refer to `.project/AI_QUICK_START.md`.


## 🤝 Contribution Policy

Asyra is an open-source project and is publicly available for reference, learning, and use.

However, this repository is **not accepting external contributions** at this time.
This includes pull requests, issues, and other forms of direct contribution.

The codebase is intentionally curated to serve as a **cohesive reference implementation**
for Communication-Driven Development (CDD) and AI-native workflows.

You are welcome to fork the project and adapt it for your own needs.


## License

MIT
