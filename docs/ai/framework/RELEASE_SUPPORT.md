# Framework Release Support

This document freezes the public support and migration contract for the release
candidates defined by the current Framework package manifests. Historical
release-readiness evidence remains reproducible context only; it never supplies
the current candidate versions. The current release decision remains `PENDING`
until a clean exact source commit reproduces the accepted artifacts,
publication is authorized, and the registry-only consumer passes.

The candidate record does not authorize merge, tagging, registry publication,
deployment, or a formal release.

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
| Node.js            | Node.js 24.x                                                            |
| Package manager    | Yarn 4.3.1 for repository release gates                                  |
| TypeScript         | Declared `^5.7.2`; artifact declarations verified with TypeScript 5.8.3 |
| React              | React 19 for `@asyra/design-system` and Asyra Design                    |
| Module format      | ESM package entrypoints and declarations                                |
| Browser evidence   | Current Playwright Chromium from `@playwright/test` 1.57                |
| Framework profiles | 2D and engine-neutral CUSTOM composition                                |

The formal artifact gates run on Node.js 24.x. A run on another Node version is
diagnostic evidence only and cannot produce the final `READY` decision.

The `@asyra/input-system` and default `@asyra/core` public entries import in the
supported Node runtime without eager DOM access. `InputSystem` construction also
registers no browser listeners. Browser consumers explicitly attach a host, or
use the existing Core visual startup route that selects the rendered canvas.
This environment-safety statement is not a supported Headless Core startup,
Core Kernel, server runtime, worker runtime, no-Render/UI dependency, or
multi-runtime isolation claim. Those remain unscheduled roadmap research.

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

These compatibility surfaces remain available in the current candidate family
and are planned for removal in the next major release:

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

From a clean Node.js 24.x checkout:

```bash
yarn install --immutable
yarn react:build
yarn release:packages --prebuilt
yarn release:consumer
yarn release:records
```

The package gate installs only the complete packed tarball set in an isolated,
project-local consumer. The final release decision additionally requires the
formal test, dependency, lint, E2E, performance, visual, Inspector, and
registry-only consumer gates owned by the Framework package release plan.

`create-asyra-design-app`, its committed template, root `asyra`, and private
`@asyra/asyra-design` are excluded from this Framework release. Their
versioning, template proof, and publication remain separately owned.

## Publication boundary

The frozen candidate is represented by exactly the 19 Framework package
manifests. Root `asyra`, private `@asyra/asyra-design`, and
`create-asyra-design-app` retain their independently owned manifest versions.
Release records read those versions from the manifests; documentation does not
duplicate them as constants. A Changeset may already have been consumed by
version materialization, so publication readiness never depends on a pending
Changeset file.

Publication may run from clean `main` or a clean feature-branch source commit
after artifact checksum reproduction. An explicitly authorized release cut
owns registry publication, the successful package Git tags, and any deployment.
The source branch does not authorize merge, and readiness evidence is not
permission to perform those operations.
