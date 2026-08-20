# `@asyra/design-system`

Optional reusable React presentation components for product UI. It is not part
of the Core execution kernel.

## Owns

- public React components such as `Text`, `Icon`, `IconButton`, `ContextMenu`,
  `Button`, `Input`, `ColorPicker`, and `PropertyControl`
- accessible reusable presentation behavior within those components
- canonical icon names and the package stylesheet

## Does not own

Core, transactions, canonical documents, app command policy, canvas rendering,
selection, input normalization, persistence, Collaboration, or app-specific
panel decisions.

## Compose when

Compose it when a React app wants Asyra's maintained UI pieces. Do not compose
it merely because the app uses Core; Framework packages do not require this UI
library. A custom app can use another design system without changing canonical
Asyra behavior.

## Public entrypoints and prerequisites

- `@asyra/design-system` for components, props, types, and helpers
- `@asyra/design-system/index.css` for package styles

Use a React host and import the stylesheet once at the app boundary. The app
supplies accessible labels, command handlers, item eligibility, session state,
and canonical write routes.

## Lifecycle, inputs, outputs, and failure

Components receive ordinary React props and emit UI intent callbacks. They may
own temporary focus, measurement, dismissal, and portal cleanup, but no
canonical state. Invalid app policy or mutation failure remains with the app
handler; a component must not fabricate successful document output.

## Relationships

Asyra Design composes this package for its interface. UI Context may provide
derived values to app controls, while Features/common APIs own commands and
canonical updates. Utils supplies shared low-level types; there is no Core
dependency.

## Maintained use path

Create a ready-to-use design-tool product with
[`create-asyra-design-app`](../../start/create-design-app.md) and inspect its
component composition. The verified generated-app extension demonstrates that
new app behavior can be registered without changing the Design System.

## Replacement and disabled behavior

Every component can be replaced at the app boundary. Omitting the package and
stylesheet has no effect on Core, Preset capability registration, canonical
state, rendering, or transactions. Do not copy app command policy into a
replacement component.

## Support, migration, and deprecation

The current package is a React UI library. Component props and icon-name
contracts are public; visual styling may evolve within semver. App migration
must preserve accessible semantics and event routing. No Design System API is
a canonical Framework mutation API.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/design-system.md)
- [Package manifest](../../../../packages/design-system/package.json)
- [Asyra Design case study](../../cases/asyra-design.md)

Version, `.` and `./index.css` entrypoints are generated from the manifest.
The documentation gate checks this guide against the release inventory.
