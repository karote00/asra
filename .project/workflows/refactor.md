# /refactor Workflow

**Purpose**: Refactor existing code to improve architecture, performance, or maintainability while preserving functionality

## Usage

```bash
/refactor <refactor-description>
```

Example:

```bash
/refactor Get selected element API should return string array
/refactor Convert direct function calls to use reactive events
/refactor Optimize scene tree performance for large documents
/refactor Improve error handling in core package
```

## Pre-requisites

- Must have read `AI_ESSENTIALS.md` (loaded automatically)
- Must follow Communication-Driven Development (CDD) patterns
- Must preserve existing functionality while improving implementation
- Must maintain backward compatibility where possible

## Workflow Steps

### Phase 1: Analysis (Automatic)

1. **Load CDD Rules**: Apply Communication-Driven Development patterns from [CDD_SPECIFICATION.md](CDD_SPECIFICATION.md)
2. **Parse Request**: Identify what needs to be refactored and why
3. **Explore Target Code**: Analyze current implementation
4. **Identify Violations**: Find CDD violations, performance issues, or maintainability problems
5. **Assess Impact**: Determine what other code/packages might be affected

### Phase 2: Refactoring Planning

1. **Create Refactoring Plan**: Document step-by-step approach in `.project/task-breakdowns/`
2. **Risk Assessment**: Identify potential breaking changes and migration strategies
3. **Test Strategy**: Plan how to verify functionality is preserved
4. **Documentation Plan**: Identify what documentation needs updating

### Phase 3: Architecture Compliance

1. **Ensure Event-Driven Communication**: Convert direct calls to reactive events
2. **Implement Request APIs**: Add synchronous APIs where needed
3. **Fix Package Coupling**: Remove direct package dependencies
4. **Add Transaction Support**: Wrap state changes for undo/redo
5. **Improve Error Handling**: Add proper error boundaries and recovery

### Phase 4: Implementation

1. **Apply E2E Testing Patterns**: Use data-testid attributes if UI components are affected
2. **Implement Changes**: Apply refactoring following CDD patterns
3. **Maintain API Compatibility**: Ensure existing interfaces still work
4. **Add Migration Paths**: Help users transition from old to new implementation
5. **Implement Iteratively**: Commit each logical refactoring step

### Phase 5: Testing & Verification

1. **Unit Tests**: Update or create tests for refactored code
2. **Integration Tests**: Verify event-driven communication works
3. **Regression Tests**: Ensure existing functionality still works
4. **Performance Tests**: Verify improvements (if performance refactor)
5. **E2E Tests**: Test complete user flows if UI changed

### Phase 6: Documentation Updates

1. **API Documentation**: Update request APIs and event contracts
2. **Architecture Documentation**: Document new patterns in `ARCHITECTURE.md`
3. **Migration Guides**: Create guides for breaking changes
4. **Update Golden Paths**: Refine user journeys if behavior changed
5. **Update BDD Features**: Modify behavior scenarios if needed

### Phase 7: Quality Assurance

1. **Linting**: `yarn lint:ci` - Check formatting
2. **Unit Tests**: `yarn workspace @package/name test:ci` - All tests must pass
3. **Build**: `yarn react:build` - Verify production build
4. **E2E Tests**: `yarn test:e2e` - Complete UI testing
5. **Performance Benchmarks**: Verify improvements (if applicable)

## Built-in Patterns

This workflow includes focused CDD patterns:

- **CDD Events**: Applied from [CDD/EVENTS.md](CDD/EVENTS.md)
- **CDD Transactions**: From [CDD/TRANSACTIONS.md](CDD/TRANSACTIONS.md) for state changes
- **CDD Request APIs**: From [CDD/REQUEST_APIS.md](CDD/REQUEST_APIS.md) for synchronous operations
- **E2E Testing**: Playwright patterns from [e2e-best-practices.md](rules/e2e-best-practices.md)
- **CDD Validation**: From [CDD/VALIDATION.md](CDD/VALIDATION.md) for quality gates

## Common Refactoring Patterns

### 1. Direct Calls to Events

```typescript
// Before (Direct call)
const result = sceneTree.addElement(data)

// After (Event-driven)
reactiveEvents.publish.addElement({
  type: 'element-creation',
  payload: data
})
```

### 2. Async to Sync Conversion

```typescript
// Before (Async)
const result = await someApi.getData()

// After (Request API)
const result = core.requests.someApi.getData()
```

### 3. Package Decoupling

```typescript
// Before (Direct import)
import { SceneTree } from '@asra/scene-tree'

// After (Event communication)
import { reactiveEvents } from '@asra/reactive-events'
```

## Quality Gates

Before completing refactor, ensure:

- [ ] All CDD violations are resolved
- [ ] Event-driven communication implemented
- [ ] Request APIs used for synchronous operations
- [ ] No direct package dependencies
- [ ] All existing functionality preserved
- [ ] Backward compatibility maintained (or documented breaking changes)
- [ ] Tests updated and passing
- [ ] Documentation updated
- [ ] Performance improved (if performance refactor)

## Error Handling

If refactoring breaks functionality:

1. **Rollback** to working implementation
2. **Analyze** what went wrong
3. **Adjust** approach based on findings
4. **Re-implement** with corrected strategy
5. **Document** lessons learned

## Migration Strategy

For breaking changes:

1. **Deprecate Old APIs** with clear warnings
2. **Provide New APIs** with improved patterns
3. **Migration Period** = Support both APIs temporarily
4. **Documentation** with clear migration examples
5. **Remove Old APIs** after migration period

## Expected Output

- **Improved code** following CDD architecture
- **Preserved functionality** with better implementation
- **Updated tests** covering new patterns
- **Current documentation** reflecting changes
- **Migration path** for any breaking changes
- **Clean git history** with logical refactoring commits

## Integration with Existing Tools

This workflow integrates with:

- `handoff-ai` commands for documentation updates
- `.project/templates/` for consistent formatting
- Existing test infrastructure
- Current CI/CD pipeline
- Performance monitoring tools

---

**This workflow guarantees that all refactoring improves code quality while maintaining Communication-Driven Development principles and preserving existing functionality.**
