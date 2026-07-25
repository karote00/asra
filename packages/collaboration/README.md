# `@asyra/collaboration`

Optional, provider-replaceable live transport for completed Asyra Factory
publications and ephemeral Awareness.

The package owns connection lifecycle and FIFO publication handoff only. Apps
remain responsible for payload validation, permissions, canonical remote apply,
conflict policy, persistence, snapshots, and recovery.

`MemoryHub` and `MemoryProvider` are non-durable development references. They
retain no publication history, disconnected peers miss publications, and
Provider Promise settlement is not a disk or database acknowledgement. Product
apps that promise durable collaboration must supply an app-owned backend.

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
