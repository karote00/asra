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

- Run tests: `yarn workspace @package/name test:ci` or `yarn test:local` for clean output
- Check formatting: `yarn lint:ci`
- Verify build: `yarn react:build`
- Run E2E tests: `yarn test:e2e` (when UI changes are involved)
- Report status to user

### Quality Gates

- All tests pass
- No linting errors
- Successful build
- E2E tests pass (for UI changes)
- Requirements met

## Phase 5: Documentation Sync

**Goal**: Update project knowledge for future sessions

### Actions

- Update `.project/ASSUMPTIONS.md` with new patterns
- Update golden paths for new workflows
- Update architecture docs for new components
- Update BDD features for new behaviors
- Update skills catalog if new capabilities were added
- Create E2E test documentation for new UI flows

### Documentation Checklist

- [ ] Golden paths updated
- [ ] Architecture docs reflect changes
- [ ] BDD features cover new functionality
- [ ] Assumptions log updated
- [ ] Test documentation updated
- [ ] Skills catalog updated (if applicable)
- [ ] E2E test scenarios documented (for UI changes)

## Phase 6: Specialized Workflows

### Skills-Based Development

When encountering specialized tasks:

1. Check `.project/SKILLS.md` for relevant skills
2. Load skill: `npx openskills read <skill-name>`
3. Follow skill-specific guidance
4. Execute using skill patterns

### External API Research

When needing library/framework documentation:

1. Use Context7 MCP server (per `.antigravity/rules.md`)
2. Never hardcode assumptions about external APIs
3. Validate findings with actual documentation

### E2E Testing for UI Changes

For any UI-related implementations:

1. Add `data-testid` attributes to new components
2. Create/update Playwright tests in `apps/ui/e2e/`
3. Run `yarn test:e2e` for verification
4. Ensure tests pass in CI/CD environment

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
