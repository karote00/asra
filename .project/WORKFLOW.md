# Development Workflow

Universal AI Software Engineering Workflow for structured development.

## Phase 1: Strategic Thinking
**Goal**: Understand the request and gather project context

### Actions
- Parse user request for requirements and goals
- Explore codebase using file operations
- Understand existing patterns and conventions
- Ask clarifying questions if needed

### Output
- Comprehensive understanding of task scope
- Relevant codebase context

## Phase 2: Planning & Documentation
**Goal**: Create detailed plan with user review

### Actions
- **Golden Path**: Step-by-step user interaction flow (`.project/golden-paths/`)
- **BDD Features**: Behavior-driven feature files (`.project/bdd-features/`)
- **Task Breakdowns**: Implementation sub-tasks (`.project/task-breakdowns/`)
- Plan testing strategy and verification steps

### Output
- Structured documentation for user review
- Concrete implementation plan

## Phase 3: Implementation
**Goal**: Execute approved plan with self-correction

### Actions
- Execute planned file operations
- Monitor outputs and error messages
- Self-correct based on immediate feedback
- Apply changes incrementally

### Self-Correction Loop
- Analyze errors and context
- Re-read relevant code
- Adjust approach
- Retry operation

## Phase 4: Verification
**Goal**: Ensure quality and completeness

### Actions
- Run tests: `yarn workspace @package/name test:ci`
- Check formatting: `yarn lint:ci`
- Verify build: `yarn react:build`
- Report status to user

### Quality Gates
- All tests pass
- No linting errors
- Successful build
- Requirements met

## Phase 5: Documentation Sync
**Goal**: Update project knowledge for future sessions

### Actions
- Update `.project/ASSUMPTIONS.md` with new patterns
- Update golden paths for new workflows
- Update architecture docs for new components
- Update BDD features for new behaviors

### Documentation Checklist
- [ ] Golden paths updated
- [ ] Architecture docs reflect changes
- [ ] BDD features cover new functionality
- [ ] Assumptions log updated
- [ ] Test documentation updated

## Communication Rules

### Loop Detection
If stuck after 3-5 attempts:
1. Halt current sub-task
2. Report issue to user
3. Request intervention/guidance

### User Interaction
- Seek approval at key decision points
- Communicate ambiguities immediately
- "Think out loud" when requested
- No commits without explicit user approval

## Default Operating Mode
Strive for autonomous completion unless explicitly asked for step-by-step interaction.