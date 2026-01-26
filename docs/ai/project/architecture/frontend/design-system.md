# Architecture: @asyra/design-system

## Core Responsibility

The `@asyra/design-system` package serves as the **Component Library** for the application. Its primary responsibility is to encapsulated visual styles and UI behaviors into reusable React components.

## Design Philosophy

1.  **Atomic Design**: Components are built from the smallest units (atoms like text, icons) up to molecules (inputs with labels) and organisms.
2.  **Tailwind CSS**: Styling is handled via Tailwind CSS utility classes, ensuring a consistent design token system (colors, spacing, typography) is applied across all components.
3.  **Encapsulation**: Components encapsulate their own structure and styling. Consumers (like `apps/asyra-design`) should not need to override styles heavily.

## Integration

-   **Props Interface**: All components expose strongly-typed TypeScript interfaces for their props.
-   **Events**: Interactive components expose standard React event handlers (e.g., `onClick`, `onChange`).
-   **Usage**: Components are imported directly into `apps/asyra-design` or other frontend packages that require UI elements.

## Key Components

-   **`Button`**: Primary interaction element.
-   **`Input`**: Text and data entry.
-   **`Icon`**: Iconography system.
-   **`Text`**: Typography standardization.
