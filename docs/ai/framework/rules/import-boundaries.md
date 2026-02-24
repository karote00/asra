# Rule: Import Boundaries

1. Cross-package imports
- Use `@asyra/package-name`.

2. Same-package imports
- Use relative paths.

3. App-level safety
- Use `core` and app-level API wrappers.
- Avoid direct package singleton manipulation where framework API exists.

Allowed:
- app feature -> app/common API -> `core.xxx` -> package runtime

Avoid:
- app feature -> direct package singleton mutation
- non-render package -> engine-specific runtime imports

4. Render boundary
- No Pixi imports outside `@asyra/render`.
