# Rule: Testing Contracts

## E2E Selector Contract

Keep these stable where possible:
- `data-testid="toolbar"`
- `data-testid="contents-panel"`
- `data-testid="properties-panel"`
- `data-testid="reset-button"`
- `data-testid="tool-select|tool-rectangle|tool-oval|tool-pen"`
- `data-testid="zoom-level"`

## State Exposure Contract

- Tool active state should remain readable via `data-active` attributes on tool buttons.
- Content items should expose stable row selectors (`data-layer-element`).

## Behavior Contract

Behavior coverage source-of-truth:
- `docs/ai/apps/asyra-design/bdd-features/README.md`
