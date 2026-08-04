# Framework Release Support

This document freezes the public support and migration contract for the
Framework `0.2.5` release candidate. Framework Release Gate 5 proves release
readiness; it does not publish packages, create a tag, deploy an app, or grant
release authority.

## Supported package set

The release candidate consists of these 19 public ESM packages:

- `@asyra/ai-agent-runtime`
- `@asyra/collaboration`
- `@asyra/core`
- `@asyra/design-system`
- `@asyra/factory`
- `@asyra/feature-system`
- `@asyra/input-system`
- `@asyra/persistence`
- `@asyra/preset`
- `@asyra/props-manager`
- `@asyra/reactive-events`
- `@asyra/render`
- `@asyra/render-engine`
- `@asyra/render-engine-pixi`
- `@asyra/scene-tree`
- `@asyra/selection`
- `@asyra/system-context`
- `@asyra/ui-context`
- `@asyra/utils`

Consumers must import only package-root or explicitly exported subpaths.
Monorepo aliases, `workspace:*` ranges, package-private source paths, and
dependency hoisting are not part of the public contract.

## Supported environment

| Surface            | Release contract                                                        |
| ------------------ | ----------------------------------------------------------------------- |
| Node.js            | Node.js 20.x                                                            |
| Package manager    | Yarn 4.3.1 for repository and generated-template gates                  |
| TypeScript         | Declared `^5.7.2`; artifact declarations verified with TypeScript 5.8.3 |
| React              | React 19 for `@asyra/design-system` and Asyra Design                    |
| Module format      | ESM package entrypoints and declarations                                |
| Browser evidence   | Current Playwright Chromium from `@playwright/test` 1.57                |
| Framework profiles | 2D and engine-neutral CUSTOM composition                                |

The formal artifact and generated-template gates run on Node.js 20.x. A run on
another Node version is diagnostic evidence only and cannot produce the final
`READY` decision.

The official 2D path uses `@asyra/preset` with
`@asyra/render-engine-pixi`. CUSTOM composition is supported through the
engine-neutral public render contracts; the adopting app owns its renderer and
product behavior. Production 3D and HYBRID profiles are unavailable in this
release. Auto-layout and unit-aware aggregation are also post-release roadmap
items, not hidden or partial release features.

## Public composition and side-effect boundaries

The verified public flow initializes Core, applies Preset 2D, opens
transactions, performs undo/redo, saves and migrates loaded documents, and
groups/ungroups elements through public package APIs.

Collaboration is opt-in. Importing ordinary framework packages or creating a
Core without a Collaboration composition creates no collaboration provider,
connection, timer, or network traffic. An app that opts in owns the provider,
remote validation, permissions, persistence, recovery, and conflict policy.

AI is opt-in. Importing or omitting `@asyra/ai-agent-runtime` creates no model
provider, credential access, network request, timer, listener, or Feature
registration. An app that opts in supplies the provider, permission,
confirmation, public action executors, and transaction runner. Provider output
never receives package-private or canonical-owner access.

Security ownership is defined in
[`SECURITY.md`](SECURITY.md). Public reports follow the repository
[`SECURITY.md`](../../../SECURITY.md); never place credentials or
vulnerability details in a public issue.

## Migration and deprecation

Saved documents enter through `core.setLoadSource(...)` and the app-owned
connected migration chain described by
[`app-owned-versioned-load-migration.mjs`](../../../docs/examples/app-owned-versioned-load-migration.mjs).
Package owners validate their fields before any canonical prefix applies.

These compatibility surfaces remain available during the `0.2.x` migration
window and are planned for removal in the next major release:

| Deprecated surface              | Replacement                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `core.setPersistence(provider)` | `core.setLoadSource(source)`; Core never saves or clears through this adapter |
| `PixiJSRenderer`                | `RenderAdapter` from `@asyra/render`                                          |
| `RenderStrategyGraphic`         | `RenderGraphics`                                                              |
| `RenderStrategy`                | `EngineNeutralRenderStrategy`                                                 |

Runtime compatibility classes/methods warn once where runtime invocation is
observable. Type-only aliases carry their deprecation and replacement in
generated declarations and this migration table.

## Reproducible readiness commands

From a clean Node.js 20.x checkout:

```bash
yarn install --immutable
yarn react:build
yarn release:packages --prebuilt
yarn release:consumer
yarn release:template --prod=asyra-design
yarn release:records
```

The package and template gates install only packed tarballs in isolated,
project-local consumers. The final release decision additionally requires the
formal test, dependency, lint, E2E, performance, visual, and Inspector gates
owned by the Framework Release Gate 5 plan.

## Publication boundary

Version `0.2.5` is the frozen candidate represented by the root and all 19
package manifests. No pending changeset is required merely to audit that
already-versioned candidate. A later explicitly authorized release cut owns
the immutable release decision snapshot, registry publication, tag, and any
deployment. Readiness evidence is not permission to perform those operations.
