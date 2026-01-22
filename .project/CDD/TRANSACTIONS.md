# CDD Transaction Management

**Purpose**: Specification for transaction patterns in Communication-Driven Development

## Core Transaction Principles

### 1. Atomic Operations

Each user action should be a single undoable unit.

```typescript
// ✅ Good - Single transaction
const elementId = core.requests.sceneTree.addRectangle(data, true)

// ❌ Bad - Multiple operations without transaction
core.requests.sceneTree.addRectangle(data1, false)
core.requests.selection.setElementSelection([id1])
core.requests.sceneTree.addRectangle(data2, false)
```

### 2. Transaction Boundaries

Clearly define start and end points.

```typescript
export class TransactionManager {
  startTransaction(): string {
    return this.factory.startTransaction()
  }

  endTransaction(): void {
    this.factory.endTransaction()
  }

  abortTransaction(error: Error): void {
    this.factory.abortTransaction()
  }
}
```

## Transaction Patterns

### 1. Simple Element Creation

```typescript
export class ElementCreationService {
  createElement(elementData: ElementData): string {
    const transactionId = this.factory.startTransaction()

    try {
      // Create element
      const elementId = this.requests.sceneTree.addElement(elementData)

      // Select new element
      this.requests.selection.setElementSelection([elementId])

      // Publish creation event
      reactiveEvents.publish.elementCreated({
        elementId,
        type: elementData.type
      })

      this.factory.endTransaction()

      return elementId
    } catch (error) {
      this.factory.abortTransaction()
      throw error
    }
  }
}
```

### 2. Complex Multi-Step Operations

```typescript
export class ComplexOperationService {
  createGroupedElements(elementsData: ElementData[]): string[] {
    const transactionId = this.factory.startTransaction()

    try {
      const elementIds: string[] = []

      // Create all elements
      elementsData.forEach((data) => {
        const id = this.requests.sceneTree.addElement(data)
        elementIds.push(id)
      })

      // Create group container
      const groupId = this.requests.sceneTree.addGroup({
        name: 'New Group',
        elementIds
      })

      // Select group
      this.requests.selection.setElementSelection([groupId])

      this.factory.endTransaction()

      return elementIds
    } catch (error) {
      this.factory.abortTransaction()
      throw error
    }
  }
}
```

### 3. Property Updates

```typescript
export class PropertyUpdateService {
  updateElementProperties(
    elementId: string,
    updates: Partial<ElementData>
  ): void {
    const transactionId = this.factory.startTransaction()

    try {
      // Apply updates
      this.requests.sceneTree.updateElement(elementId, updates)

      // Publish property change events
      Object.entries(updates).forEach(([property, value]) => {
        reactiveEvents.publish.propertyChanged({
          elementId,
          property,
          oldValue: this.getCurrentProperty(elementId, property),
          newValue: value
        })
      })

      this.factory.endTransaction()
    } catch (error) {
      this.factory.abortTransaction()
      throw error
    }
  }
}
```

## Transaction Error Handling

### 1. Rollback Strategy

Always provide rollback capability:

```typescript
export class RobustTransactionService {
  updateWithRollback(elementId: string, updates: Partial<ElementData>): void {
    const originalState = this.requests.sceneTree.getElementState(elementId)

    const transactionId = this.factory.startTransaction()

    try {
      // Attempt update
      this.requests.sceneTree.updateElement(elementId, updates)

      // Validate update succeeded
      const newState = this.requests.sceneTree.getElementState(elementId)
      this.validateStateUpdate(originalState, newState, updates)

      this.factory.endTransaction()
    } catch (error) {
      // Automatic rollback to original state
      this.requests.sceneTree.updateElement(elementId, originalState)
      this.factory.abortTransaction()

      // Log transaction failure
      console.error('Transaction failed, rolled back:', error)
    }
  }
}
```

### 2. Transaction Validation

Validate transaction integrity before committing:

```typescript
export class TransactionValidator {
  static validateTransaction(operations: TransactionOperation[]): boolean {
    return operations.every(
      (op) => this.validateOperation(op) && this.checkDependencies(operations)
    )
  }

  private static validateOperation(operation: TransactionOperation): boolean {
    // Check if operation is allowed in current state
    return operation.isValid()
  }

  private static checkDependencies(
    operations: TransactionOperation[]
  ): boolean {
    // Ensure operations don't conflict
    const conflicts = this.findConflicts(operations)
    return conflicts.length === 0
  }
}
```

## Integration with Events

### Transaction Event Flow

```typescript
export class TransactionEventPublisher {
  publishTransactionEvents(
    transactionId: string,
    operations: TransactionOperation[]
  ): void {
    // Transaction started
    reactiveEvents.publish.transactionStarted({
      transactionId,
      operationCount: operations.length
    })

    // Each operation
    operations.forEach((op, index) => {
      reactiveEvents.publish.transactionOperation({
        transactionId,
        operationIndex: index,
        operation: op
      })
    })

    // Transaction completed
    reactiveEvents.publish.transactionCompleted({
      transactionId,
      success: true
    })
  }
}
```

### Undo/Redo Integration

```typescript
export class UndoRedoManager {
  private transactionHistory: TransactionRecord[] = []
  private currentIndex: number = -1

  undo(): boolean {
    if (this.canUndo()) {
      this.currentIndex--
      const transaction = this.transactionHistory[this.currentIndex]
      this.restoreTransaction(transaction)

      reactiveEvents.publish.undone({
        transactionId: transaction.id,
        operations: transaction.operations
      })

      return true
    }
    return false
  }

  redo(): boolean {
    if (this.canRedo()) {
      this.currentIndex++
      const transaction = this.transactionHistory[this.currentIndex]
      this.restoreTransaction(transaction)

      reactiveEvents.publish.redone({
        transactionId: transaction.id,
        operations: transaction.operations
      })

      return true
    }
    return false
  }
}
```

## Testing Transaction Patterns

### Unit Tests

```typescript
describe('Transaction Management', () => {
  it('should rollback on error', () => {
    const service = new TransactionService()

    // Mock failure
    vi.spyOn(sceneTree, 'updateElement').mockImplementation(() => {
      throw new Error('Update failed')
    })

    expect(() => service.updateWithRollback('element-1', { x: 100 })).toThrow(
      'Update failed'
    )

    // Verify rollback
    expect(sceneTree.updateElement).toHaveBeenCalledWith(
      'element-1',
      originalState
    )
  })

  it('should support undo/redo', () => {
    const manager = new UndoRedoManager()

    // Perform actions
    manager.performAction(action1)
    manager.performAction(action2)

    // Test undo
    expect(manager.undo()).toBe(true)
    expect(manager.getState()).toEqual(afterAction1)

    // Test redo
    expect(manager.redo()).toBe(true)
    expect(manager.getState()).toEqual(afterAction2)
  })
})
```

## Quality Gates

### Before Submitting Transaction Code

- [ ] All state changes wrapped in transactions
- [ ] Proper error handling with rollback
- [ ] Transaction boundaries are clear
- [ ] Undo/redo functionality works correctly
- [ ] Events are published for transaction state changes
- [ ] No nested transactions (unless explicitly required)
- [ ] Transaction cleanup on component destruction

### Transaction Validation Script

```typescript
const validateTransactionCode = (code: string): TransactionViolation[] => {
  const violations: TransactionViolation[] = []

  // Check for operations without transaction
  if (code.includes('.addElement(') && !code.includes('startTransaction')) {
    violations.push({
      type: 'missing-transaction',
      message: 'Element addition without transaction'
    })
  }

  // Check for missing error handling
  if (code.includes('startTransaction') && !code.includes('catch')) {
    violations.push({
      type: 'missing-error-handling',
      message: 'Transaction without error handling'
    })
  }

  return violations
}
```

---

**This specification covers all transaction management patterns for reliable undo/redo functionality in CDD.**
