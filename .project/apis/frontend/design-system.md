# API Reference: @asra/design-system

The `@asra/design-system` package provides a set of reusable UI components styled with Tailwind CSS. These components are used to build the application interface in `apps/ui`.

## Components

### `Button`
Standard interactive button component.

-   **Props**: `ButtonProps`
    -   `label` (`string`): The text content of the button.
    -   `variant` (`'primary' | 'secondary' | 'accent' | 'warning'`): Controls the visual style/color. Default: `'primary'`.
    -   `size` (`'sm' | 'md' | 'lg'`): Controls padding and font size. Default: `'md'`.
    -   `disabled` (`boolean`): Whether the button is interactive.
    -   `onClick` (`() => void`): Click handler.

### `Icon`
Displays an SVG icon.

-   **Props**: `IconProps` (Inferred)
    -   `name`: Name of the icon to display.
    -   `size`: Size in pixels or class.
    -   `color`: Fill/Stroke color.

### `Input`
Text input field.

-   **Props**: `InputProps` (Inferred)
    -   `value`: Current value.
    -   `onChange`: Change handler that emits the new value.
    -   `placeholder`: Placeholder text.
    -   `disabled`: Disabled state.

### `Text`
Typography component for consistent text styling.

-   **Props**: `TextProps` (Inferred)
    -   `variant`: Title, subtitle, body, caption, etc.
    -   `children`: Text content.
