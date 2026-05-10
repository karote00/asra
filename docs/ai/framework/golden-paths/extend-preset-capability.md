# Golden Path: Extend a Preset Capability

## Preconditions

- The target behavior belongs to preset defaults, not framework runtime ownership.
- The app/product requirement is domain-specific or product-specific.
- The target registration key, feature name, property type, event name, render layer name, or selection channel is known.

## Steps

1. Classify the target
- feature behavior
- shortcut/input mapping
- event contract
- component/property/schema behavior
- render layer or interaction target
- selection channel/default wiring

2. Prefer extension when available
- use the documented extension hook or registration surface
- keep extension ordering explicit
- fail fast when the target is missing or ambiguous

3. Use replacement when extension is unavailable
- unregister the preset capability through an approved API
- register the app/product-owned replacement
- preserve stable public contracts unless intentionally breaking them

4. Keep ownership explicit
- framework owns runtime primitives and validation
- preset owns optional defaults
- app/product owns domain behavior and workflows

5. Verify behavior
- test the app/product behavior directly
- verify transaction grouping and undo/redo semantics
- verify runtime invalid writes are rejected
- verify load-time fallback still works when persisted data is invalid or old
- verify render remains derived from framework/system state

## Verification Checklist

- The extension or replacement does not import preset/framework internals for app policy.
- The default can still be skipped, replaced, or moved in future package extraction.
- Duplicate registration, missing target, and override conflicts fail with actionable errors.
- Active observers, handlers, or render targets are cleaned up when unregistering.
- The feature or capability remains deterministic across startup order and reload.

## Common Failure Cases

- patching a preset implementation file for product-specific behavior
- relying on registration order instead of explicit priority/strategy
- replacing a capability without cleaning up observers or render interaction targets
- preserving UI behavior while breaking save/load or undo/redo contracts
