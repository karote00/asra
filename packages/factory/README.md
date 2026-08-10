# `@asyra/factory`

Canonical transaction grouping, rollback, Undo/Redo history, replay, and local shared-publication infrastructure.

## Requirements

- Node.js 24.x
- Yarn 4.3.1 for this repository's maintained workflows

## Install

```bash
npm install @asyra/factory
```

```ts
import factory from '@asyra/factory'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- the active transaction journal, one outer commit, validation, rollback, history, replay, and publication evidence

## Does not own

- product command meaning, package invariants, persistence durability, collaboration transport, or App conflict policy

## Start here

Use Factory whenever one intended canonical action needs atomicity, rollback, history, or shared publication. Core already coordinates the common App instance.

## Lifecycle and composition

Nested starts join one outer journal. A valid outer end creates at most one Undo entry; failure or rejected validation runs inverses in reverse order. Undo/Redo replays owner-issued evidence without creating a parallel mutation route.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/factory.md)
- [Commit one session as one Undo unit](https://github.com/karote00/asyra/blob/main/docs/examples/feature-session-undo.mjs) — `yarn examples:run feature-session-undo`
- [Compose two non-durable in-memory actors](https://github.com/karote00/asyra/blob/main/docs/examples/network-collaboration-transport.mjs) — `yarn examples:run collaboration-two-memory-actors`
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
