# Asyra Framework Getting Started

Use this page when you have just opened the repository and need to decide where
to read or change Asyra Framework code. It is a navigation guide; the linked
owner documents remain the implementation contracts.

## Choose an entry point

- Build a product from public Framework packages with the
  [custom composition guide](../../public/start/custom-composition.md).
- Start from the complete, ready-to-use Asyra Design product with
  [`create-asyra-design-app`](../../../create-app/asyra-design/README.md).
- Learn one Framework capability at a time from the
  [executable examples](../../examples/README.md).
- Read the stable consumer guides in the
  [public documentation](../../public/index.md).
- Change Framework implementation only after following the
  [Framework context read order](README.md#read-order).

## Mental model

Every accepted product intent follows one path:

```text
human / UI / automation / AI / device intent
-> registered Feature
-> App or public Framework API
-> one intended transaction
-> canonical state owner
-> Render / UI / serialization / App service projection
```

Load, undo/redo replay, and accepted remote changes are state-application
paths. They validate and apply canonical data; they do not create another
Feature decision path.

Ownership is equally important:

- Framework owns deterministic runtime mechanics and public extension points.
- Preset owns optional official defaults.
- The App owns domain meaning, workflows, schemas, permissions, and product UI.
- Backends and external services own transport, authorization, durability, and
  provider policy.

## Find the right contract

| You need to…                                   | Start here                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Understand supported versions and environments | [`RELEASE_SUPPORT.md`](RELEASE_SUPPORT.md)                                            |
| Find a public API                              | [`API_SURFACES.md`](API_SURFACES.md)                                                  |
| Route a change to its owner                    | [`REQUEST_ROUTING.md`](REQUEST_ROUTING.md)                                            |
| Understand runtime ownership and flow          | [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`RUNTIME_MATRICES.md`](RUNTIME_MATRICES.md) |
| Register or replace a capability               | [`golden-paths/README.md`](golden-paths/README.md)                                    |
| Change a package                               | [`packages/README.md`](packages/README.md)                                            |
| Implement safely in this monorepo              | [`WORKFLOW.md`](WORKFLOW.md) and [`CODING_STANDARDS.md`](CODING_STANDARDS.md)         |
| Check hard constraints                         | [`rules/`](rules/)                                                                    |

## First successful checks

From the repository root, use the smallest gate that matches the owner you
changed:

```bash
yarn workspace @asyra/package-name test:local
yarn workspace @asyra/package-name build
```

For a cross-package change, also run:

```bash
yarn lint:ci
yarn react:build
```

Generated app templates are never handwritten sources. Change their canonical
App, then use the commands in
[`rules/generated-artifacts.md`](rules/generated-artifacts.md).

## AI agent handoff

Ask an agent to identify the Framework, Preset, App, and backend owners before
editing. Give it one bounded behavior, the relevant owner document, and the
required checks. For bug fixes, require a formal test that detects the failure
before production code changes. The repository's root `AGENTS.md` and the hard
rules in [`rules/`](rules/) are mandatory for repository work.
