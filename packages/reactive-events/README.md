# `@asyra/reactive-events`

Typed cross-package communication, transaction-owner routing, persistence signals, and cooperative settlement primitives.

## Requirements

- Node.js 24.x
- Yarn 4.3.1 for this repository's maintained workflows

## Install

```bash
npm install @asyra/reactive-events
```

```ts
import { eventRegistry } from '@asyra/reactive-events'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- typed event registration/publication/subscription, package-neutral payload contracts, transaction-owner routing, and cooperative host-yield policy

## Does not own

- canonical package state, App command policy, a second transaction journal, renderer output, or provider networking

## Start here

Use typed routes when packages must communicate without transferring ownership. Apps normally prefer Core or App facades over low-level publication.

## Lifecycle and composition

Register stable definitions before use and release exact subscriptions. Missing owners, duplicate definitions, subscriber failure, or failed settlement stays explicit; no event fallback may mutate another package directly.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/reactive-events.md)
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
