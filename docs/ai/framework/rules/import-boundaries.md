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

- `@asyra/render` may import `@asyra/render-engine`, but not Pixi or a concrete
  render-engine package.
- Concrete engines may import `@asyra/render-engine`, but not
  `@asyra/render`.
- Only `@asyra/render-engine-pixi` may import `pixi.js`.
- Preset may depend on both the abstract contract and the default concrete
  engine solely to select/inject a factory.
- Core, apps, and other framework packages remain concrete-engine-neutral.
