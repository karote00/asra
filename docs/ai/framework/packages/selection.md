# Package: @asyra/selection

## Responsibility

Own selection state for entities and selection-oriented queries.

## Owns

- selected entity ids
- selection replace/add/remove behavior
- selection query APIs for active selection state

## Must Not Own

- tool/mode decision logic
- rendering overlays directly
- entity mutation business logic

## Rules

- Selection state should be independent from UI framework state.
- Selection operations should be explicit (replace/add/remove/clear).
- Multi-selection behavior should be deterministic.
- Selection APIs are read/write boundary for selection data.
- Selection metadata (`selectionType`, `action`, `eventName`) is string-based and registration-driven.

## Extension Points

- app-level helpers that compose selection with domain modes
- ui-context aggregate registration for selection-derived properties
- selection type registration (for example element/vertex/custom selection channels)

## Notes

- This package does not auto-register builtin selection types by default.
- This package does not ship concrete default selection classes; defaults are constructed by preset registration.
- Default selection registrations are preset-owned (`@asyra/preset`).
- This package does not own default reactive-event/data-channel subscription wiring.
- Default selection shared-channel apply wiring is preset-owned.
- Selection transaction publishing for core selection APIs is core-owned.

## Explicit Runtime Reset

`SelectionManager.resetRuntime(): void` removes runtime channel registrations
and attempts every registered instance's disposal without publishing selection
mutations. Cleanup failures are reported after all attempts. Another manager
remains unchanged; fresh composition may register new instances under the same
names. Core owns orchestration; ordinary clear/unregister is unchanged.

## Validation Checklist

- Select and deselect flows produce correct id sets.
- Selection persistence/update works across tool switching.
- Selection reads are stable during long feature sessions.
