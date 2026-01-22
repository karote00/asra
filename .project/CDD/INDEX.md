# CDD Specification Index

**Purpose**: Overview and guide for using Communication-Driven Development specifications

## Available CDD Specifications

### Core Patterns

| Specification                      | Purpose                             | When to Use                                          |
| ---------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| [EVENTS.md](EVENTS.md)             | Event-driven communication patterns | Implementing publishers/subscribers, event contracts |
| [TRANSACTIONS.md](TRANSACTIONS.md) | Transaction management patterns     | State changes with undo/redo support                 |
| [REQUEST_APIS.md](REQUEST_APIS.md) | Synchronous API patterns            | Direct API access without async/await                |
| [TESTING.md](TESTING.md)           | Testing patterns                    | Unit/integration testing for CDD compliance          |
| [VALIDATION.md](VALIDATION.md)     | Quality gates                       | Validation rules and automated checking              |

### Supporting Documentation

| Reference                                  | Purpose                             |
| ------------------------------------------ | ----------------------------------- |
| [../AI_ESSENTIALS.md](../AI_ESSENTIALS.md) | Core project rules and CDD overview |
| [../ARCHITECTURE.md](../ARCHITECTURE.md)   | Detailed technical architecture     |

## Usage Guide

### For New Features

Use **[EVENTS.md](EVENTS.md)** for:

- Event type definitions
- Publisher/subscriber patterns
- Event naming conventions

Use **[TRANSACTIONS.md](TRANSACTIONS.md)** for:

- Transaction boundaries
- Error handling and rollback
- Undo/redo integration

Use **[REQUEST_APIS.md](REQUEST_APIS.md)** for:

- Synchronous API design
- Dependency injection patterns
- Input validation

### For Bug Fixes

Use **[VALIDATION.md](VALIDATION.md)** to identify existing violations and ensure fixes follow CDD patterns.

### For Refactoring

Use all relevant specifications to transform existing code:

- **[EVENTS.md](EVENTS.md)** - Convert direct calls to events
- **[TRANSACTIONS.md](TRANSACTIONS.md)** - Add proper transaction support
- **[VALIDATION.md](VALIDATION.md)** - Verify refactored code compliance

### For Testing

Use **[TESTING.md](TESTING.md)** for:

- Event-driven testing patterns
- Request API testing
- Transaction testing
- Mocking strategies

## Quick Reference

### Common CDD Violations

| Violation                   | Specification                      | Solution                         |
| --------------------------- | ---------------------------------- | -------------------------------- |
| Direct package dependencies | [EVENTS.md](EVENTS.md)             | Replace with event communication |
| Async in sync context       | [REQUEST_APIS.md](REQUEST_APIS.md) | Use synchronous patterns         |
| Missing transactions        | [TRANSACTIONS.md](TRANSACTIONS.md) | Wrap state changes               |
| Memory leaks                | [EVENTS.md](EVENTS.md)             | Proper unsubscribe patterns      |

### Validation Commands

```bash
# Validate specific package
npx cdd-validate packages/my-package

# Validate all packages
npx cdd-validate packages/

# Auto-fix common violations
npx cdd-fix --auto .

# Generate validation report
npx cdd-validate . --report cdd-report.json
```

## Integration with Workflows

### Feature Development

```markdown
## Built-in Patterns

- **CDD Events**: Applied from [CDD/EVENTS.md](CDD/EVENTS.md)
- **CDD Transactions**: From [CDD/TRANSACTIONS.md](CDD/TRANSACTIONS.md)
- **CDD Request APIs**: From [CDD/REQUEST_APIS.md](CDD/REQUEST_APIS.md)
- **CDD Testing**: From [CDD/TESTING.md](CDD/TESTING.md)
- **CDD Validation**: From [CDD/VALIDATION.md](CDD/VALIDATION.md)
```

### Refactoring

```markdown
## Built-in Patterns

- **CDD Events**: Applied from [CDD/EVENTS.md](CDD/EVENTS.md)
- **CDD Validation**: From [CDD/VALIDATION.md](CDD/VALIDATION.md)
- **Architecture Guidance**: Transform according to CDD patterns
```

## Versioning

Each CDD specification is versioned independently:

- **EVENTS.md**: v1.0.0
- **TRANSACTIONS.md**: v1.0.0
- **REQUEST_APIS.md**: v1.0.0
- **TESTING.md**: v1.0.0
- **VALIDATION.md**: v1.0.0

Updates to individual specifications don't affect others.

## Migration from Monolithic

Previous monolithic CDD approaches have been replaced:

- **Before**: Single large CDD_SPECIFICATION.md file
- **After**: Modular specifications for focused usage
- **Benefit**: Workflows reference only relevant CDD patterns
- **Compatibility**: Both approaches work during transition

---

**This index provides navigation to all CDD patterns for different use cases.**
