# Package: @asyra/feature-system (Retired)

## Status

Removed from the monorepo runtime graph.

## Conclusion

- Package is removed from active package set.
- `@asyra/feature-system` is the only runtime owner for execute/session/cancel.

## Why

- Two runtime owners create conflicting decisions, duplicate cancel paths, and unstable transaction boundaries.
- Feature-system already provides ordering and conflict controls (`priority`, `exclusive`).

## Migration Status

- Runtime and bootstrap paths no longer import `@asyra/feature-system`.
- Compatibility method `core.registerInteraction(...)` is removed.
- Generator flow `gen:interaction` is removed.
