# `@asyra/scene-tree`

Canonical entity graph, parent/child hierarchy, identity, element/property relations, serialization, and local computed projection.

## Requirements

- Node.js 24.x
- Yarn 4.3.1 for this repository's maintained workflows

## Install

```bash
npm install @asyra/scene-tree
```

```ts
import sceneTree from '@asyra/scene-tree'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- entity lifecycle, hierarchy/order, relation indexes, batch-only local computed projection, and prepared atomic hierarchy artifacts

## Does not own

- property definitions, UI policy, render objects, App Group command meaning, or computed data as canonical/shared/history state

## Start here

Use it for canonical entity and hierarchy products; coordinate property relations and cross-owner work through Core.

## Lifecycle and composition

Batches validate identity, membership, cycles, order, relations, and staleness before mutation. Prepared artifacts are instance-bound and one-shot. Local computed projection remains derived and never enters history, collaboration publication, or persistence.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/scene-tree.md)
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
