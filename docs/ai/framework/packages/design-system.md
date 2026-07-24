# Package: @asyra/design-system

## Responsibility

Provide reusable React presentation components and their stylesheet for app UI.
This package is a shared UI library, not part of the framework execution kernel.

## Public Surface

- components: `Text`, `Icon`, `IconButton`, `Button`, `Input`, `ColorPicker`,
  and `PropertyControl`;
- `IconName`, the canonical public name contract accepted by `Icon`;
- `IconButtonProps`, the accessible icon-only button contract. `IconButton`
  owns native button semantics and composes the canonical `Icon`; apps provide
  the accessible label, interaction handler, and presentation classes;
- Color Picker public types and helpers exported by its component module;
- stylesheet entrypoint: `@asyra/design-system/index.css`.

## Must Not Own

- Core, Factory, Feature, transaction, persistence, collaboration, or canonical
  document state;
- Asyra Design feature decisions or property mutation policy;
- canvas rendering, hit testing, selection, or input normalization.

Apps own how these components are composed and how UI intent reaches their
canonical app/framework APIs. The package owns presentation behavior only.
