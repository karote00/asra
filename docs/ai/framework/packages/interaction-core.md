# Package: @asyra/interaction-core (Deprecated)

## Status

Deprecated compatibility package.

## Conclusion

- Keep it in the monorepo for now.
- Do not use it as the active runtime owner for new app flows.
- `@asyra/feature-system` is the only runtime owner for execute/session/cancel.

## Why

- Two runtime owners create conflicting decisions, duplicate cancel paths, and unstable transaction boundaries.
- Feature-system already provides ordering and conflict controls (`priority`, `exclusive`).

## What Changes Now

- No functional migration required immediately.
- Keep existing deprecation warning at runtime/export surface.
- Freeze new feature additions in interaction-core.
- Do not wire new app flows through interaction-core.

## Future Removal Trigger

Interaction-core can be removed after all apps/features run exclusively through feature-system and no compatibility subscribers depend on it.
