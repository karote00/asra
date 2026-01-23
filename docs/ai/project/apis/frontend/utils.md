# API Reference: @asra/utils

The `@asra/utils` package acts as the shared utility library for the entire monorepo. It contains shared types, constants, helper functions, and domain-agnostic logic.

## Module Structure

The package is organized into several key modules:

### `constants/`
Contains global application constants.
-   **System Constants**: Defaults for system behavior.
-   **Event mappings**: Input event definitions.
-   **Styling**: Shared style constants.

### `helpers/`
Pure utility functions for common operations.
-   **`string-utils`**: String manipulation.
-   **`type-checks`**: Runtime type guard functions.
-   **`validators`**: Input validation helpers.

### `types/`
Shared TypeScript interfaces and types used across multiple packages.
-   **`DataTypes`**: Base types for data models.
-   **`Events`**: Event payload definitions.

### `setter/`
Helper functions for safely setting values on objects, potentially with validation or side effects (though `utils` aims to be side-effect free).

### `naming/`
Utilities for generating or validating names (e.g., ensuring unique element names).
