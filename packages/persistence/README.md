# `@asyra/persistence`

Persistence and load-source contracts for app-owned document storage. Core
consumes only the read boundary during startup; apps own durability and writes.

```ts
import type { DocumentLoadSource } from '@asyra/persistence'
```

## Release support

The `0.2.5` ESM artifact supports Node.js 20.x. Use only package-root exports.
See the [Framework release support contract](../../docs/ai/framework/RELEASE_SUPPORT.md).
