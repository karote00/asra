# CDD Testing Patterns

**Purpose**: Testing patterns for Communication-Driven Development compliance

## Unit Testing CDD Components

### 1. Event-Driven Testing

Test event publishers and subscribers in isolation.

```typescript
describe('Event Communication', () => {
  it('should publish and receive events correctly', () => {
    const mockSubscriber = vi.fn()

    // Subscribe to events
    const unsubscribe = reactiveEvents.subscribe.testEvent(mockSubscriber)

    // Publish test event
    reactiveEvents.publish.testEvent({
      type: 'test-action',
      data: { value: 'test-data' }
    })

    // Verify subscriber was called
    expect(mockSubscriber).toHaveBeenCalledWith({
      type: 'test-action',
      data: { value: 'test-data' }
    })

    // Cleanup
    unsubscribe()
  })

  it('should handle multiple subscribers', () => {
    const subscriber1 = vi.fn()
    const subscriber2 = vi.fn()

    const unsubscribe1 = reactiveEvents.subscribe.testEvent(subscriber1)
    const unsubscribe2 = reactiveEvents.subscribe.testEvent(subscriber2)

    reactiveEvents.publish.testEvent({ type: 'test', data: {} })

    // Both subscribers should receive event
    expect(subscriber1).toHaveBeenCalled()
    expect(subscriber2).toHaveBeenCalled()

    unsubscribe1()
    unsubscribe2()
  })
})
```

### 2. Request API Testing

Test synchronous request APIs.

```typescript
describe('Request APIs', () => {
  it('should provide synchronous access to scene tree', () => {
    const mockSceneTree = new MockSceneTree()
    const mockFactory = new MockFactory()
    const core = new Core(mockSceneTree, mockFactory)

    // Test synchronous request
    const elementId = core.requests.sceneTree.addRectangle(testData, true)

    expect(elementId).toBeDefined()
    expect(typeof elementId).toBe('string')
    expect(mockSceneTree.addRectangle).toHaveBeenCalledWith(testData, true)
  })

  it('should handle selection requests', () => {
    const mockSelection = new MockSelectionService()
    const core = new Core(null, mockSelection)

    const selectedIds = core.requests.selection.getElementSelectionIds()
    const newIds = ['test-id-1', 'test-id-2']
    core.requests.selection.setElementSelection(newIds)

    expect(mockSelection.setElementSelection).toHaveBeenCalledWith(newIds)
  })
})
```

### 3. Transaction Testing

Test transaction boundaries and rollback behavior.

```typescript
describe('Transaction Management', () => {
  it('should support undo/redo operations', () => {
    const mockFactory = new MockFactory()
    const service = new TransactionService(mockFactory)

    // Perform operation within transaction
    const elementId = service.createElement(testData)

    expect(mockFactory.startTransaction).toHaveBeenCalled()
    expect(mockFactory.endTransaction).toHaveBeenCalled()
    expect(elementId).toBeDefined()
  })

  it('should rollback on error', () => {
    const mockFactory = new MockFactory()
    const mockSceneTree = new MockSceneTree()
    const service = new TransactionService(mockFactory, mockSceneTree)

    // Mock operation failure
    vi.spyOn(mockSceneTree, 'addElement').mockImplementation(() => {
      throw new Error('Add failed')
    })

    expect(() => service.createElement(testData)).toThrow()
    expect(mockFactory.abortTransaction).toHaveBeenCalled()
  })
})
```

## Integration Testing

### 1. End-to-End Event Flow

Test complete user workflows with event communication.

```typescript
describe('E2E Event Flow', () => {
  it('should create element through event flow', async ({ page }) => {
    await page.goto('/')

    // Select tool
    await page.locator('[data-testid="tool-rectangle"]').click()

    // Focus on canvas
    await page.locator('[data-testid="canvas-container"]').click()

    // Draw rectangle
    await page.mouse.down(100, 100)
    await page.mouse.up(200, 200)

    // Verify element created through event system
    await expect(
      page.locator('[data-testid="rectangle-element"]').first()
    ).toBeVisible()

    // Verify selection event worked
    const selectedElement = page.locator(
      '[data-testid="rectangle-element"][data-selected="true"]'
    )
    await expect(selectedElement).toBeVisible()
  })
})
```

### 2. Request API Integration

Test request APIs work correctly with real components.

```typescript
describe('Request API Integration', () => {
  it('should integrate request APIs with UI components', async ({ page }) => {
    await page.goto('/')

    // Test request API through property panel
    await page.locator('[data-testid="rectangle-element"]').first().click()

    // Modify property through request API
    await page.locator('[data-testid="property-x"]').fill('150')

    // Verify element updated via request API
    const elementBounds = await page
      .locator('[data-testid="rectangle-element"]')
      .first()
      .boundingBox()
    expect(elementBounds.x).toBe(150)
  })
})
```

## Mocking Strategies

### 1. Event System Mocking

Mock reactive events for isolated testing.

```typescript
export class MockReactiveEvents {
  private subscribers: Map<string, Function[]> = new Map()

  subscribe(eventType: string, handler: Function): () => void {
    const handlers = this.subscribers.get(eventType) || []
    handlers.push(handler)
    this.subscribers.set(eventType, handlers)

    return () => {
      const currentHandlers = this.subscribers.get(eventType) || []
      const index = currentHandlers.indexOf(handler)
      if (index > -1) {
        currentHandlers.splice(index, 1)
      }
    }
  }

  publish(eventType: string, data: any): void {
    const handlers = this.subscribers.get(eventType) || []
    handlers.forEach((handler) => handler(data))
  }
}

// Usage in tests
const mockEvents = new MockReactiveEvents()
const component = new Component(mockEvents)
```

### 2. Request API Mocking

Mock request APIs for testing.

```typescript
export class MockCoreRequests {
  sceneTree = {
    addRectangle: vi.fn().mockReturnValue('test-element-id'),
    updateElement: vi.fn(),
    deleteElement: vi.fn()
  }

  selection = {
    getElementSelectionIds: vi.fn().mockReturnValue([]),
    setElementSelection: vi.fn()
  }
}

// Usage in tests
const mockCore = new Core(null, null, mockRequests)
const elementId = mockCore.requests.sceneTree.addRectangle(testData)
expect(elementId).toBe('test-element-id')
```

### 3. Dynamic Method Mocking

For classes using `Object.assign()` for dynamic method assignment.

```typescript
// ✅ Correct - Direct assignment
const core = new Core(eventBus, factory)
core.propsLoadData = vi.fn()

// ❌ Incorrect - Spy on dynamic method
vi.spyOn(core, 'propsLoadData') // This will fail
```

## Testing Best Practices

### 1. Behavior-Focused Tests

Test behaviors and outcomes, not implementation details.

```typescript
// ✅ Good - Behavior focused
it('should create element when user draws rectangle', () => {
  // Test what happens, not how
  drawRectangle()
  expect(elementExists()).toBe(true)
})

// ❌ Bad - Implementation focused
it('should call sceneTree.addRectangle', () => {
  drawRectangle()
  expect(sceneTree.addRectangle).toHaveBeenCalled() // Testing implementation
})
```

### 2. Isolated Component Testing

Test components in isolation with mocked dependencies.

```typescript
describe('RectangleComponent', () => {
  let component: RectangleComponent
  let mockEvents: MockReactiveEvents
  let mockRequests: MockCoreRequests

  beforeEach(() => {
    mockEvents = new MockReactiveEvents()
    mockRequests = new MockCoreRequests()

    component = new RectangleComponent(mockEvents, mockRequests)
  })

  it('should publish events on creation', () => {
    component.create(testData)

    // Verify event published, not internal implementation
    expect(mockEvents.publish.createElement).toHaveBeenCalledWith(testData)
  })
})
```

### 3. Cross-Platform Testing

Ensure tests work on different platforms.

```typescript
describe('Cross-Platform Shortcuts', () => {
  it('should support both Meta and Control keys', () => {
    const mockInputSystem = new InputSystem()

    // Test Mac pattern
    mockInputSystem.handleShortcut('Meta+a')
    expect(mockInputSystem.selectingAll).toHaveBeenCalled()

    // Test Windows/Linux pattern
    mockInputSystem.handleShortcut('Control+a')
    expect(mockInputSystem.selectingAll).toHaveBeenCalled()
  })
})
```

## Quality Gates

### Before Submitting CDD Tests

- [ ] Tests cover event communication patterns
- [ ] Request APIs tested synchronously
- [ ] Transaction boundaries are tested
- [ ] Mocks follow CDD patterns
- [ ] Integration tests cover complete workflows
- [ ] Tests are behavior-focused
- [ ] Cross-platform compatibility verified
- [ ] No implementation-specific testing

### Test Validation Script

```typescript
const validateCDDTests = (testFiles: string[]): TestViolation[] => {
  const violations: TestViolation[] = []

  testFiles.forEach((file) => {
    const content = fs.readFileSync(file, 'utf8')

    // Check for implementation testing
    if (content.includes('expect(sceneTree.addRectangle)')) {
      violations.push({
        type: 'implementation-testing',
        file,
        message: 'Test checks implementation details instead of behavior'
      })
    }

    // Check for async patterns in sync APIs
    if (content.includes('await') && content.includes('requests.')) {
      violations.push({
        type: 'async-sync-api',
        file,
        message: 'Async/await used with synchronous request API'
      })
    }
  })

  return violations
}
```

---

**This specification covers all testing patterns for validating CDD implementation.**
