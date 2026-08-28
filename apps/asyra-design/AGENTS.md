# Asyra Design Agent Guide

These instructions apply to this App and are copied into every project created
by `create-asyra-design-app`.

## Read before editing

1. Read [`docs/README.md`](docs/README.md).
2. Read the guide for the area you will change.
3. Identify the Framework, Preset, App, and backend owners involved.
4. State one bounded objective, mutation scope, unchanged behavior, and checks.

In the upstream Asyra monorepo, the root `AGENTS.md` and the
[App source-of-truth](https://github.com/karote00/asyra/blob/main/docs/ai/apps/asyra-design/README.md)
also apply. In a generated standalone project, use the stable upstream links
in [`docs/framework.md`](docs/framework.md) for Framework contracts.

## Required boundaries

- Product intent enters through `src/features`.
- Reusable App mutations and queries belong in `src/common-apis`.
- Canonical mutations use public Asyra APIs and one intended transaction.
- UI and rendering are projections, not canonical state owners.
- App domain rules do not belong in Framework packages or Preset defaults.
- Backend transport, authorization, durability, and model-provider policy stay
  outside browser canonical state.
- Cross-package imports use public `@asyra/package-name` entrypoints; do not use
  package internals or deep relative paths.

## Change discipline

- For a bug fix, first prove whether a formal test detects the failure. Add or
  strengthen that test before changing production code when it does not.
- Fix the first incorrect owner step. Do not hide defects with fallback UI,
  patch rendering, fixture exceptions, or alternate state paths.
- Keep event, feature, tool, and property identifiers in their existing
  registries under `src/constants` or `src/config`.
- Do not commit secrets, generated browser evidence, test reports, or local
  service data.

## Verification

Run the narrow test for the changed owner first, then the standalone gates:

```bash
yarn typecheck
yarn react:build
yarn test
```

Use the documented E2E commands only when the affected behavior requires the
browser or complete collaboration services.
