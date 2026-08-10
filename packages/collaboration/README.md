# `@asyra/collaboration`

Optional provider-replaceable transport for completed Factory publications and separate ephemeral Awareness.

## Install

```bash
npm install @asyra/collaboration
```

```ts
import {
  createCollaboration,
  MemoryHub,
  MemoryProvider
} from '@asyra/collaboration'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- explicit connection lifecycle and FIFO publication handoff
- exclusive inbound callback delivery, provider outcomes, Awareness, and owned-resource cleanup

## Does not own

- canonical documents, payload validation, permissions, conflict policy, durable outboxes, checkpoints, or backend storage

## Start here

Compose it when an App already owns immutable Factory publications, a provider, and a validated canonical remote-apply route.

## Lifecycle and composition

Construction is inert. `start()` connects and subscribes; connected publications are sent once in FIFO order. Disconnected publications are skipped, not retained. `dispose()` releases only resources the composition owns.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/collaboration.md)
- [Compose two non-durable in-memory actors](https://github.com/karote00/asyra/blob/main/docs/examples/network-collaboration-transport.mjs) — `yarn examples:run collaboration-two-memory-actors`
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
