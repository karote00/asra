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

## Extension Points

- app-level helpers that compose selection with domain modes
- ui-context aggregate registration for selection-derived properties

## Validation Checklist

- Select and deselect flows produce correct id sets.
- Selection persistence/update works across tool switching.
- Selection reads are stable during long feature sessions.
