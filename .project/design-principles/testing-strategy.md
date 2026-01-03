# Design Principle: Testing Strategy

This document outlines the core principles for writing unit and integration tests, focusing on the choice between mocking and spying to ensure tests are robust, meaningful, and maintainable.

## Guiding Principle

**Prefer spying on real objects for internal collaborators; reserve mocking for external systems and boundaries.** This approach maximizes test confidence by verifying real integrations, reducing the risk of "green tests, broken app" scenarios.

-   **Spying**: Using the *real* dependency and observing its methods. The original logic runs, providing a mini-integration test.
-   **Mocking**: Completely replacing a dependency with a "stunt double" or fake implementation. The real code does not run.

## Spying on Internal Collaborators (Preferred)

-   **Definition**: When testing the interaction between classes that are both part of your application's codebase (e.g., a `Render` service using a `ViewportLayer` service).
-   **Examples**: A controller calling a service, a service using a repository, a UI component delegating to a state manager.
-   **Handling**: Use the real instances of your classes and `vi.spyOn()` (or the equivalent for your testing framework) to verify that methods are called correctly.
-   **Benefits**:
    -   **High Confidence**: Proves that the components integrate correctly.
    -   **Resilience**: Tests are not tightly coupled to the internal implementation of the dependency, only to its public API.
    -   **Low Maintenance**: No need to maintain complex fake implementations of your own code.

## Mocking External Systems (Use When Necessary)

-   **Definition**: When a dependency is external to your application, has significant side effects, or is difficult to set up in a test environment.
-   **Examples**: Database clients, third-party API services, filesystem writers, system clocks.
-   **Handling**: Use `vi.mock()` to replace the entire module with a simplified fake that you can control directly. This isolates your test from the outside world.
-   **Benefits**:
    -   **Isolation**: Prevents tests from having side effects (like making real network calls).
    -   **Speed**: Avoids slow operations like database queries.
    -   **Control**: Allows you to easily simulate specific scenarios, like API errors or empty database returns.

## Summary

| Scenario | Preferred Method | Rationale |
| :--- | :--- | :--- |
| Testing collaboration between your own classes | **Spy** | Verifies the contract and integration between components. |
| Dependency is a database or 3rd party API | **Mock** | Isolates the test from external systems for speed and reliability. |
| Dependency has side effects (e.g., `fs.writeFile`) | **Mock** | Prevents the test from altering the environment. |
| You need to force a specific error state | **Mock** | Provides direct control over the dependency's behavior. |
