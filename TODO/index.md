# TODO Checklist

This folder contains task checklists and improvement plans for the @asyra framework.

## 🚨 IMPORTANT: Usage Policy for AI Agents

> This folder is a **record of human ideas and discussion conclusions**.

**DO NOT modify or create files in this folder** when:

- Receiving feature requests
- Breaking down tasks or epics
- Planning implementation steps
- Creating architectural decisions

**Files in TODO are for RECORDING, not for PLANNING.**

### What This Folder Contains:

- ✅ Human-written ideas and concepts
- ✅ Discussion conclusions from human-AI conversations
- ✅ Long-term roadmaps and vision documents
- ✅ Framework maturity assessments
- ✅ Missing feature analysis

### What This Folder Does NOT Contain:

- ❌ AI-generated task breakdowns (use `docs/ai/project/task-breakdowns/` instead)
- ❌ Implementation step-by-step plans
- ❌ Feature epics (use `docs/ai/project/epics/` instead)
- ❌ Code modification instructions

### Where to Put AI-Generated Content:

- **Task breakdowns:** `docs/ai/project/task-breakdowns/`
- **Features/Epics:** `docs/ai/project/epics/`
- **Architecture decisions:** `docs/ai/project/decision-history/`

## Documents

- **[FRAMEWORK_STATUS.md](./FRAMEWORK_STATUS.md)** - Current framework status, improvements, and roadmap
- **[GENERIC_HANDLER_REGISTRY.md](./GENERIC_HANDLER_REGISTRY.md)** - Plan to make subscribe handlers configurable & extend Core APIs (COMPLETES framework transformation)
- **[REMOVE_RULES_BEHAVIORS_FROM_FRAMEWORK.md](./REMOVE_RULES_BEHAVIORS_FROM_FRAMEWORK.md)** - Plan to delete all rules/behaviors from framework, move to app
- **[WORKFLOW_SIMPLIFICATION.md](./WORKFLOW_SIMPLIFICATION.md)** - Architecture documentation for feature system design (historical reference)
- **[FEATURE_SYSTEM_REFACTOR_PLAN.md](./FEATURE_SYSTEM_REFACTOR_PLAN.md)** - Implementation plan for feature-system key combinations (historical reference)
- **[EJECT_COMMAND.md](./EJECT_COMMAND.md)** - Plan for eject command to customize defaults

---

## Purpose

- Track framework maturity and improvements
- Document what's working and what's missing
- Provide actionable TODO items with priorities
- Organize by phases and categories
- Record human ideas and discussion conclusions

## Adding New Checklists

When creating new TODO items:

1. Create a descriptive markdown file: `TOPIC_NAME.md`
2. Include clear sections:
   - Overview
   - Current state
   - Improvements needed
   - TODO checklist with priority
3. Add reference to this index

## Priority Levels

- **High Priority**: Critical for production/stability
- **Medium Priority**: Important but not blocking
- **Low Priority**: Nice to have, can defer

## Progress Tracking

Each document should track progress using checkboxes:

```markdown
- [ ] Task name (Priority: High/Medium/Low)
- [x] Completed task
```

---

**Last Updated:** February 5, 2026
