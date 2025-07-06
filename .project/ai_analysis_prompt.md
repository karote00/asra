## AI Initial Project Analysis Prompt

This section outlines the key information an AI agent should prioritize identifying during its initial, unguided analysis of a new software project. The goal is to quickly build a foundational understanding to facilitate effective human-AI collaboration.

**Upon starting a new project analysis, the AI agent should systematically seek to identify the following:**

1.  **Project Type & Core Purpose**:
    *   Determine if it's a web application (frontend/backend/fullstack), mobile app, desktop app, CLI tool, library, or game.
    *   Identify its primary function or domain (e.g., "a collaborative design tool," "a task management system," "a data visualization library").
    *   *Inference Sources*: `README.md`, `package.json` (`name`, `description`), top-level directory names (`apps/`, `packages/`), common file names (`App.tsx`, `server.js`).

2.  **Primary Technologies & Frameworks**:
    *   Identify the main programming languages (e.g., TypeScript, JavaScript, Python, Go).
    *   List dominant frameworks/libraries (e.g., React, Vue, Angular, Node.js, Express, FastAPI, Django, RxJS, YJS, Pixi.js, Three.js, Tailwind CSS).
    *   *Inference Sources*: `package.json` (`dependencies`, `devDependencies`), `tsconfig.json`, `requirements.txt`, `Cargo.toml`, `build.gradle`, import statements, file extensions.

3.  **Codebase Structure & Modularity**:
    *   Determine if it's a monorepo (e.g., using Lerna, Turborepo, Yarn Workspaces).
    *   Understand how logical units are organized (e.g., `apps/`, `packages/`, `src/`, `components/`, `modules/`).
    *   Identify the apparent boundaries and responsibilities of top-level modules/packages.
    *   *Inference Sources*: Directory structure, `package.json` (`workspaces`), `turbo.json`, `lerna.json`.

4.  **Key Entry Points & Execution Flow**:
    *   Locate where the application typically starts execution (e.g., `index.ts`, `main.py`, `App.tsx`).
    *   Understand how user interactions or external events are typically initiated and processed at a high level.
    *   *Inference Sources*: `package.json` (`scripts` like `start`, `dev`), `vite.config.ts`, `webpack.config.js`, `main.yml` (CI/CD workflows), top-level `index` files.

5.  **Data Management & State Flow**:
    *   Identify how application state is managed (e.g., local component state, global state management libraries, centralized stores).
    *   Determine if there are indications of collaborative data structures (e.g., YJS, CRDTs).
    *   Understand how data is persisted or synchronized.
    *   *Inference Sources*: Imports of state management libraries (Redux, Zustand, MobX), YJS imports/instantiations, database connection files, API client configurations.

6.  **Inter-Module Communication Mechanisms**:
    *   Identify how different parts of the system communicate with each other (e.g., explicit event buses, pub/sub patterns, direct function calls, API endpoints, message queues).
    *   *Inference Sources*: Imports of event emitter libraries, custom event bus implementations, `publish`/`subscribe` patterns, API route definitions.

7.  **Testing & Quality Assurance Indicators**:
    *   Determine if test directories exist (`__tests__`, `tests`, `e2e`).
    *   Identify testing frameworks used (e.g., Jest, Vitest, Playwright, Cypress, Pytest).
    *   Note any linting or formatting configurations (e.g., `.eslintrc`, `.prettierrc`, `ruff.toml`).
    *   *Inference Sources*: `package.json` (`scripts` like `test`, `lint`), configuration files (`.eslintrc`, `prettierrc`), test file patterns (`.test.ts`, `.spec.js`).

8.  **Build, Development, and Deployment Commands**:
    *   Identify how the project is built, run locally, and potentially deployed.
    *   *Inference Sources*: `package.json` (`scripts`), `Dockerfile`, `vercel.json`, CI/CD workflow files (`.github/workflows/`).

9.  **External Documentation & Project-Specific Terminology**:
    *   Actively search for and prioritize learning from external documentation links (e.g., in `README.md`, comments, or other project guides) that define architectural styles or project-specific terms.
    *   Note any unique acronyms or terms used within the codebase that might require clarification.
    *   *Inference Sources*: `README.md`, project-specific `.md` files, code comments, variable/function names that appear to be acronyms or unique terms.
