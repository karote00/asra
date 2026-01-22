# /bugfix Workflow

**Purpose**: Fix bugs systematically while maintaining CDD principles and preventing regressions

## Usage

```bash
/bugfix <bug-description>
```

Example:

```bash
/bugfix Selected elements not highlighting properly on canvas
/bugfix Rectangle tool creates elements at wrong position
/bugfix Undo/redo not working for property changes
/bugfix Memory leak when deleting many elements
```

## Pre-requisites

- Must have read `AI_ESSENTIALS.md` (loaded automatically)
- Must follow Communication-Driven Development (CDD) patterns
- Must preserve existing functionality while fixing bug
- Must add tests to prevent regression

## Workflow Steps

### Phase 1: Bug Analysis (Automatic)

1. **Load CDD Rules**: Apply Communication-Driven Development patterns from AI_ESSENTIALS.md
2. **Parse Bug Report**: Understand what's broken and expected behavior
3. **Identify Affected Code**: Locate relevant packages and components
4. **Reproduce Bug**: Create minimal reproduction case
5. **Assess Impact**: Determine severity and affected user flows

### Phase 2: Root Cause Analysis

1. **Event Flow Analysis**: Check if bug is in event communication
2. **State Management Review**: Verify YJS/CRDT synchronization
3. **Transaction Issues**: Check undo/redo implementation
4. **Request API Problems**: Verify synchronous operation handling
5. **Package Coupling**: Identify direct dependency issues

### Phase 3: Fix Planning

1. **Minimal Fix Strategy**: Plan smallest change that resolves issue
2. **Test Case Design**: Create tests that reproduce and verify fix
3. **Regression Prevention**: Plan tests to catch similar bugs
4. **Documentation Plan**: Identify what needs updating

### Phase 4: Implementation

1. **Apply E2E Testing Patterns**: Use data-testid attributes if UI components are affected
2. **Implement Minimal Fix**: Apply targeted solution following CDD patterns
3. **Maintain Architecture**: Ensure fix doesn't break CDD principles
4. **Add Event Handling**: Fix event-driven communication if needed
5. **Preserve APIs**: Don't change public interfaces unless necessary

### Phase 5: Testing & Verification

1. **Reproduction Test**: Verify bug is fixed with reproduction case
2. **Unit Tests**: Add tests covering the fix and edge cases
3. **Integration Tests**: Verify event communication still works
4. **Regression Tests**: Test related functionality to prevent new bugs
5. **E2E Tests**: Test complete user flows if UI affected
6. **Cross-Platform Tests**: Verify fix works on all platforms

### Phase 6: Documentation Updates

1. **Update Bug Tracking**: Document fix in issue tracker
2. **Update API Docs**: Document any behavior changes
3. **Update Golden Paths**: Modify if user flow changed
4. **Update Troubleshooting**: Add known issues and solutions
5. **Update BDD Features**: Fix behavior scenarios if needed

### Phase 7: Quality Assurance

1. **Linting**: `yarn lint:ci` - Check formatting
2. **Unit Tests**: `yarn workspace @package/name test:ci` - All tests must pass
3. **Build**: `yarn react:build` - Verify production build
4. **E2E Tests**: `yarn test:e2e` - Complete UI testing
5. **Regression Test Suite**: Run full regression test battery

## Built-in Patterns

This workflow includes CDD and testing patterns directly:

- **CDD Principles**: Event-driven communication and request APIs embedded in workflow steps
- **E2E Testing**: Playwright testing patterns included in testing phases
- **Architecture Guidance**: Communication-Driven Development patterns applied throughout

## Common Bug Categories & Patterns

### 1. Event-Related Bugs

```typescript
// Bug: Event not propagated
// Fix: Check event subscription and publishing
reactiveEvents.publish.someEvent(data) // Ensure this is called
```

### 2. State Synchronization Bugs

```typescript
// Bug: YJS not updating UI
// Fix: Check YJS observation setup
yjsDocument.observe((updates) => {
  // Handle updates
})
```

### 3. Transaction Bugs

```typescript
// Bug: Undo not working
// Fix: Ensure proper transaction wrapping
factory.startTransaction()
try {
  // Make changes
  factory.endTransaction()
} catch (error) {
  factory.abortTransaction()
}
```

### 4. Request API Bugs

```typescript
// Bug: API not returning correct data
// Fix: Verify request method implementation
const result = core.requests.someApi.getData()
// Ensure this method exists and works
```

## Quality Gates

Before completing bugfix, ensure:

- [ ] Bug is completely fixed (verified with reproduction case)
- [ ] Fix follows CDD patterns
- [ ] No new bugs introduced
- [ ] Tests added to prevent regression
- [ ] All existing tests still pass
- [ ] Cross-platform compatibility maintained
- [ ] Documentation updated
- [ ] Performance not degraded

## Regression Prevention

### 1. Test Coverage

- Add unit tests for the fixed code path
- Add integration tests for event flows
- Add E2E tests for user interactions
- Add edge case tests for boundary conditions

### 2. Automated Monitoring

- Add error tracking for the fixed area
- Add performance monitoring if performance-related bug
- Add user analytics to detect recurrence

### 3. Documentation Updates

- Document known pitfalls in troubleshooting guides
- Update architecture docs with new patterns
- Add examples to golden paths

## Error Handling

If fix doesn't work:

1. **Rollback** to original implementation
2. **Re-analyze** root cause more thoroughly
3. **Consider** architectural vs implementation issue
4. **Implement** alternative approach
5. **Test** more comprehensively

## Expected Output

- **Working fix** that resolves reported issue
- **Regression tests** to prevent similar bugs
- **Updated documentation** reflecting fix
- **Clean git history** with logical fix commits
- **Quality assurance** confirming no regressions

## Integration with Existing Tools

This workflow integrates with:

- `handoff-ai` commands for documentation updates
- `.project/templates/` for consistent formatting
- Existing test infrastructure
- Current CI/CD pipeline
- Bug tracking systems

---

**This workflow ensures systematic bug resolution while maintaining Communication-Driven Development principles and preventing future regressions.**
