# CDD Validation

**Purpose**: Quality gates and validation patterns for Communication-Driven Development

## Core Validation Principles

### 1. Architectural Compliance

Ensure all code follows CDD patterns.

```typescript
export const validateCDDCompliance = (
  packageContent: PackageContent
): CDDViolation[] => {
  const violations: CDDViolation[] = []

  // Check for direct package dependencies
  const directImports = extractDirectImports(packageContent)
  if (directImports.length > 0) {
    violations.push({
      type: 'direct-package-dependency',
      message: `Direct imports found: ${directImports.join(', ')}`
    })
  }

  // Check for async patterns in sync contexts
  const asyncInSync = findAsyncInSyncContexts(packageContent)
  if (asyncInSync.length > 0) {
    violations.push({
      type: 'async-in-sync-api',
      message: `Async/await used in synchronous contexts: ${asyncInSync.join(', ')}`
    })
  }

  return violations
}
```

### 2. Event Communication Validation

Validate event-driven communication patterns.

```typescript
export const validateEventCommunication = (code: string): EventViolation[] => {
  const violations: EventViolation[] = []

  // Check for missing event subscriptions
  if (!code.includes('subscribe') && code.includes('publish')) {
    violations.push({
      type: 'missing-subscription',
      message: 'Event publishing without subscription'
    })
  }

  // Check for memory leaks
  const subscribeCount = (code.match(/subscribe/g) || []).length
  const unsubscribeCount = (code.match(/unsubscribe/g) || []).length

  if (subscribeCount > unsubscribeCount) {
    violations.push({
      type: 'memory-leak',
      message: `${subscribeCount - unsubscribeCount} potential memory leaks`
    })
  }

  return violations
}
```

### 3. Request API Validation

Ensure request APIs follow synchronous patterns.

```typescript
export const validateRequestAPIs = (apiCode: string): RequestAPIViolation[] => {
  const violations: RequestAPIViolation[] = []

  // Check for async patterns
  if (apiCode.includes('await')) {
    violations.push({
      type: 'async-sync-api',
      message: 'Async/await used in synchronous request API'
    })
  }

  // Check for missing validation
  const hasValidation = /validate|check|verify/.test(apiCode)
  if (!hasValidation) {
    violations.push({
      type: 'missing-validation',
      message: 'Request API missing input validation'
    })
  }

  return violations
}
```

## Automated Validation

### 1. Pre-commit Hooks

Automatically validate CDD compliance before commits.

```bash
#!/bin/bash
# .git/hooks/pre-commit
echo "Validating CDD compliance..."

# Run CDD validation
npx cdd-validate .

# Check exit code
if [ $? -ne 0 ]; then
  echo "❌ CDD validation failed. Fix violations before committing."
  exit 1
fi

echo "✅ CDD validation passed."
exit 0
```

### 2. CI/CD Integration

Integrate validation into build pipeline.

```yaml
# .github/workflows/cdd-validation.yml
name: CDD Validation

on: [push, pull_request]

jobs:
  validate-cdd:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Validate CDD Compliance
        run: |
          npm install -g @asra/cdd-validator
          cdd-validate .

      - name: Upload Validation Report
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: cdd-validation-report
          path: cdd-report.json
```

## Quality Gates

### Before Code Submission

#### Event Communication

- [ ] No direct package dependencies
- [ ] All events use typed interfaces
- [ ] Event subscriptions are properly cleaned up
- [ ] No memory leaks in event handling

#### Request APIs

- [ ] All request APIs are synchronous
- [ ] Input validation with meaningful errors
- [ ] Clear return type contracts
- [ ] Integration with transaction system

#### Transaction Management

- [ ] All state changes wrapped in transactions
- [ ] Proper error handling with rollback
- [ ] Undo/redo functionality works
- [ ] Transaction boundaries are clear

#### Testing

- [ ] Event-driven communication tested
- [ ] Request APIs tested synchronously
- [ ] Transaction behavior tested
- [ ] Integration tests cover workflows
- [ ] Tests are behavior-focused

### Validation Reporting

Generate clear validation reports:

```typescript
interface CDDValidationReport {
  timestamp: string;
  package: string;
  violations: CDDViolation[];
  summary: {
    total: number;
    byType: Record<string, number>;
    blocked: boolean;
  };
}

// Example report
{
  "timestamp": "2026-01-22T10:00:00Z",
  "package": "@asra/my-component",
  "violations": [
    {
      "type": "direct-package-dependency",
      "message": "Direct import from @asra/scene-tree",
      "line": 15,
      "severity": "error"
    }
  ],
  "summary": {
    "total": 1,
    "byType": {
      "direct-package-dependency": 1
    },
    "blocked": true
  }
}
```

## Remediation Guidelines

### 1. Direct Dependencies

**Fix**: Replace direct imports with event communication.

```typescript
// ❌ Before
import { SceneTree } from '@asra/scene-tree'
const element = sceneTree.addElement(data)

// ✅ After
import { reactiveEvents } from '@asra/reactive-events'
reactiveEvents.publish.addElement({ type: 'creation', data })
```

### 2. Async in Sync Context

**Fix**: Remove async/await from synchronous operations.

```typescript
// ❌ Before
const result = await core.requests.someApi.getData()

// ✅ After
const result = core.requests.someApi.getData()
```

### 3. Missing Validation

**Fix**: Add proper input validation.

```typescript
// ❌ Before
addRectangle(data: RectangleData): string {
  return this.sceneTree.addRectangle(data);
}

// ✅ After
addRectangle(data: RectangleData): string {
  if (!this.validateRectangleData(data)) {
    throw new Error('Invalid rectangle data');
  }
  return this.sceneTree.addRectangle(data);
}

private validateRectangleData(data: RectangleData): boolean {
  return data.position &&
         typeof data.position.x === 'number' &&
         typeof data.position.y === 'number';
}
```

## Continuous Integration

### Automated Quality Gates

Set up automated validation in development workflow:

```yaml
# package.json
{
  'scripts':
    {
      'validate:cdd': 'cdd-validate .',
      'precommit': 'npm run validate:cdd',
      'test': 'npm run validate:cdd && jest',
      'build': 'npm run validate:cdd && tsc'
    }
}
```

### Development Environment

Integrate validation into development process:

```bash
# Setup validation
npm install -g @asra/cdd-validator

# Run validation during development
npm run validate:cdd

# Fix violations automatically
cdd-fix --auto . # Auto-fix common violations
```

---

**This specification provides comprehensive validation patterns for maintaining CDD quality standards.**
