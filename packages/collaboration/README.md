# `@asyra/collaboration`

Optional, provider-replaceable live transport for completed Asyra Factory
publications and ephemeral Awareness.

The package owns connection lifecycle and FIFO publication handoff only. Apps
remain responsible for payload validation, permissions, canonical remote apply,
conflict policy, persistence, snapshots, and recovery.

Every Provider implements one data method in each direction:
`sendPublication(publication)` and
`onPublication(async (publication) => ...)`. Collaboration hands each immutable
Factory-owned `SharedPublication` to `sendPublication` exactly once and in FIFO
order without cloning or rebuilding it. It does not advance to the next
publication until the current send settles. The receiving callback remains
pending until the app finishes canonical remote apply.

Concrete transports own bounded queues, wire framing, encoding, and any
internal grouping that does not alter publication identity or order. Generic
Collaboration owns none of those transport policies. If the Provider is not
connected when a Factory publication arrives, Collaboration reports it as
skipped and does not replay it after reconnect.

`MemoryHub` and `MemoryProvider` are non-durable development references. They
create one detached publication snapshot per receiving peer, retain no
publication history, and do not echo the sender. Their one-slot peer capacity
bounds pending app work without making the current sender Promise wait for peer
apply. Disconnected peers miss publications and reconnect receives only future
live publications. These in-process semantics are not wire serialization or a
disk/database acknowledgement. Product apps that promise durable collaboration
must supply an app-owned backend.

An app apply failure reports a Collaboration `process-failed` outcome and
rejects the Provider callback. It is not a `ProviderFailure`; that type remains
reserved for connection and transport failures.

```ts
import {
  createCollaboration,
  MemoryHub,
  MemoryProvider
} from '@asyra/collaboration'
```

See the
[Collaboration package contract](https://github.com/karote00/asyra/blob/main/docs/ai/framework/packages/collaboration.md)
for complete composition, lifecycle, provider, and app-ownership details.

## Release support

The `@asyra/collaboration` `0.2.5` ESM artifact supports Node.js 24.x. Use only
package-root exports. The package is opt-in and creates no provider or network
side effect until an app explicitly composes and connects it. See the
[Framework release support contract](../../docs/ai/framework/RELEASE_SUPPORT.md).
