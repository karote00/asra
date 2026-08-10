# Support, security, and release boundaries

This page describes the current release candidate. It is not publication,
merge, tagging, registry, or deployment authorization.

## Candidate package set

The Framework candidate contains exactly 19 public ESM packages. The set,
versions, exports, dependencies, and artifact names are read from package
manifests by the release/documentation gates; this page does not duplicate
version constants. Root `asyra`, private Asyra Design, and
`create-asyra-design-app` have independently owned versions and release flows.

Consumers may import only package roots and explicitly exported subpaths.
Workspace aliases, `workspace:*`, hoisting assumptions, monorepo-only paths,
and package-private `src` imports are not public contracts.

## Supported environment

- Node.js `24.x` for formal artifact/release gates
- Yarn `4.3.1` for repository release gates
- public ESM entrypoints and TypeScript declarations
- React 19 for Asyra Design and `@asyra/design-system`
- current browser evidence through the project-owned Playwright Chromium gate
- official `2D` and engine-neutral `CUSTOM` composition

Input System and default Core entries import without eager DOM access in the
supported Node runtime. That proves import safety, not a public Headless Core,
Core Kernel, server/worker lifecycle, no-Render dependency, or multi-runtime
isolation.

Production `3D`, `HYBRID`, auto layout, and unit-aware aggregation are not in
this candidate.

## Optional systems

Collaboration is opt-in. Without explicit composition, no provider, room,
connection, timer, Awareness runtime, or network side effect exists. Apps own
transport, authorization, persistence, recovery, and conflict policy.

AI is opt-in. Without explicit composition and invocation, no model provider,
credential access, network request, timer, listener, or Feature registration
exists. Apps own provider/backend policy, permissions, confirmation, action
executors, and transactions.

## Security reporting

Report suspected vulnerabilities through the repository's
[private GitHub security advisory](https://github.com/karote00/asyra/security/advisories/new).
Do not disclose vulnerability details, credentials, provider tokens, document
contents, or personal data in a public issue. This repository does not promise
support through public issues or pull requests.

## Migration and deprecation

App documents enter through `core.setLoadSource(...)` and app-owned migration
before package-owner validation. These compatibility surfaces remain in the
current candidate family and are planned for removal in the next major release:

| Deprecated surface              | Replacement                          |
| ------------------------------- | ------------------------------------ |
| `core.setPersistence(provider)` | `core.setLoadSource(source)`         |
| `PixiJSRenderer`                | `RenderAdapter` from `@asyra/render` |
| `RenderStrategyGraphic`         | `RenderGraphics`                     |
| `RenderStrategy`                | `EngineNeutralRenderStrategy`        |

Runtime compatibility warns once where observable. Type-only aliases carry
deprecation and replacement in declarations. New code should use replacements
now; do not build new dependencies on compatibility names.

## Reproducible readiness

From a clean Node.js 24.x checkout:

```shell
yarn install --immutable
yarn react:build
yarn release:packages --prebuilt
yarn release:consumer
yarn release:records
```

Final release acceptance additionally requires formal tests, dependency/lint,
E2E, performance, visual, Inspector, exact package artifacts, and registry-only
consumer gates. A successful candidate run is evidence, not publication
permission.

## License

Asyra Framework packages are released under the MIT License. Include the
copyright and permission notice in copies or substantial portions. The
software is provided without warranty under the terms in the repository
[LICENSE](../../../LICENSE).

## Canonical sources

- [Framework release support](../../ai/framework/RELEASE_SUPPORT.md)
- [Security policy](../../../SECURITY.md)
- [MIT License](../../../LICENSE)
- [Runtime roadmap](../learn/runtime-boundaries-roadmap.md)
