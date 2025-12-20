# Agent Protocol

## 1. The Prime Directive
You are working in a highly structured environment defined by the `.project/` directory.
Your FIRST action in any session MUST be to read `.project/AI_QUICK_START.md`.

## 2. Development Process
You MUST follow the **Universal AI Software Engineering Workflow** defined in `.project/AI_WORKFLOW_GUIDE.md`.
- **Start**: Phase 1 (Strategic Thinking)
- **Implement**: Phase 3 (Iterative)
- **Verify**: Phase 4 (Lint/Test `yarn test:ci` before commit)
- **Finish**: Phase 5 (Sync Documentation)

## 3. Tool Awareness
Before writing custom scripts or manual code, check for existing project tools.
- **Event Generation**: Use `yarn gen:event` (See `.project/EVENT_ARCHITECT_CLI.md`).

## 4. Documentation Strategy
- Never invent new conventions without updating `.project/ASSUMPTIONS.md`.
- All architectural decisions must be reflected in `.project/AI_ARCHITECTURAL_GUIDE.md`.
