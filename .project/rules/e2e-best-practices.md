# E2E Testing Best Practices

To ensure robust and maintainable end-to-end tests, follow these rules when developing UI components:

## 1. Use Dedicated Test Attributes
Always use `data-testid` for elements that need to be targeted by E2E tests. Avoid relying on:
- CSS classes (especially utility classes like Tailwind, which may change).
- HTML structure (e.g., `.parent > div:nth-child(2)`).
- Text content (unless it's a stable label).

## 2. Indicate State with Data Attributes
Use `data-active`, `data-selected`, or `data-value` to expose internal state to the testing framework.
- **Example**: `<div data-testid="tool-rectangle" data-active="true">`

## 3. Support Cross-Platform Shortcuts
When mapping keyboard shortcuts in the input system, support both `Meta` (for Mac) and `Control` (for Windows/Linux) to ensure tests pass in all environments (including headless CI).

## 4. Focus Neutral Areas
When gaining focus for keyboard shortcuts, click on neutral areas (like headers or sidebars) rather than the canvas to avoid accidentally triggering drawing tools.
