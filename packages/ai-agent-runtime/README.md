# `@asyra/ai-agent-runtime`

Optional AI action-plan orchestration for framework applications. The app owns the
model provider, permissions, confirmation, registered public action executors,
and enclosing transaction.

```ts
import { createAIAgentRuntime } from '@asyra/ai-agent-runtime'
```

Importing this package creates no provider, secret access, model request,
network traffic, timer, listener, or canonical mutation.

## Release support

The `0.2.5` ESM artifact supports Node.js 24.x. Use only package-root exports.
See the [Framework release support contract](../../docs/ai/framework/RELEASE_SUPPORT.md).
