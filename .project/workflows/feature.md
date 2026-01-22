# /feature Workflow

**Purpose**: Implement new features following complete Asra development process with guaranteed CDD compliance

## Usage

```bash
/feature <feature-description>
```

Example:

```bash
/feature User wants to delete selected elements
/feature Add rectangle drawing tool with keyboard shortcuts
/feature Implement element grouping functionality
```

## Pre-requisites

- Must have read `AI_ESSENTIALS.md` (loaded automatically)
- Must follow Communication-Driven Development (CDD) patterns
- Must use `@asra/reactive-events` for inter-package communication
- Must use request APIs for synchronous operations

## Workflow Steps

### Phase 1: Strategic Thinking (Automatic)

1. **Load CDD Rules**: Automatically load `cdd-development` skill for architecture patterns
2. **Parse Request**: Analyze feature description for requirements and constraints
3. **Explore Codebase**: Identify relevant packages and existing patterns
4. **Ask Clarifying Questions**: If requirements are ambiguous

### Phase 2: Planning & Documentation (Following request-handling-workflow.md)

1. **Create PRD**: Write Product Requirements Document in `.project/prd/`
2. **Write BDD Scenarios**: Create behavior files in `.project/features/`
3. **Plan Task Breakdown**: Document implementation steps in `.project/task-breakdowns/`
4. **Design Golden Path**: Create user journey in `.project/golden-paths/`
5. **Plan Testing Strategy**: Define unit, integration, and E2E test approach

### Phase 3: Architecture Design

1. **Event Flow Design**: Define reactive events for communication
2. **Request API Design**: Specify synchronous APIs needed
3. **Transaction Planning**: Plan undo/redo boundaries
4. **Package Integration**: Identify which packages are involved

### Phase 4: Implementation

1. **Load Testing Skill**: Load `e2e-testing` skill for UI testing patterns
2. **Implement Events**: Add event types to `@asra/reactive-events`
3. **Implement Publishers**: Create event publishers in source packages
4. **Implement Subscribers**: Create event handlers in target packages
5. **Implement Request APIs**: Add synchronous APIs to appropriate packages
6. **Wrap in Transactions**: Ensure all state changes support undo/redo
7. **Implement Iteratively**: Commit each logical step separately

### Phase 5: Testing

1. **Unit Tests**: Write behavior-focused tests for new functionality
2. **Integration Tests**: Test event-driven communication
3. **E2E Tests**: Create Playwright tests for UI interactions
4. **Cross-Platform Tests**: Verify keyboard shortcuts work on all platforms

### Phase 6: Verification

1. **Linting**: `yarn lint:ci` - Check formatting
2. **Unit Tests**: `yarn workspace @package/name test:ci`
3. **Build**: `yarn react:build` - Verify production build
4. **E2E Tests**: `yarn test:e2e` - Complete UI testing

### Phase 7: Documentation Sync

1. **Update Architecture Docs**: Document new patterns in `ARCHITECTURE.md`
2. **Update Golden Paths**: Refine user journey documentation
3. **Update BDD Features**: Add new behavior scenarios
4. **Update API Docs**: Document new request APIs
5. **Update E2E Documentation**: Document new test scenarios

## Required Skills Loading

This workflow automatically loads these skills at appropriate phases:

- **`cdd-development`**: Loaded immediately for architecture guidance
- **`e2e-testing`**: Loaded in Phase 4 for testing patterns
- **Additional skills**: Loaded based on specific feature requirements

## Quality Gates

Before completing feature, ensure:

- [ ] All inter-package communication uses reactive events
- [ ] No direct package dependencies
- [ ] Synchronous operations use request APIs
- [ ] All state changes wrapped in transactions
- [ ] Tests use data-testid attributes
- [ ] Cross-platform keyboard shortcuts supported
- [ ] All quality checks pass (lint, test, build)
- [ ] Documentation updated

## Error Handling

If any phase fails:

1. **Halt** current implementation
2. **Report** specific issue to user
3. **Request** guidance before proceeding
4. **Document** decision in relevant files

## Expected Output

- **Working feature** that follows CDD architecture
- **Comprehensive test coverage** with E2E scenarios
- **Updated documentation** reflecting new patterns
- **Clean git history** with logical commits
- **Ready for code review** with all artifacts

## Integration with Existing Tools

This workflow integrates with:

- `handoff-ai` commands for documentation updates
- `.project/templates/` for consistent formatting
- Existing testing infrastructure
- Current CI/CD pipeline

---

**This workflow guarantees that every new feature follows Asra's Communication-Driven Development principles while maintaining complete documentation and testing standards.**
