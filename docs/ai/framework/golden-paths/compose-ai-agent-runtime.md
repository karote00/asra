# Compose an Optional AI Agent Runtime

Use this path when an app wants to execute natural-language intent without
transferring Feature, permission, transaction, or canonical-state ownership to
the runtime.

## Define App-Owned Actions

```ts
import type { AiActionDefinition } from '@asyra/ai-agent-runtime'
import { elementApis } from './common-apis'

interface SetVisibilityArgs {
  elementId: string
  visible: boolean
}

const setVisibility: AiActionDefinition<SetVisibilityArgs> = {
  name: 'set_visibility',
  description: 'Set one existing element visibility.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['elementId', 'visible'],
    properties: {
      elementId: { type: 'string', minLength: 1 },
      visible: { type: 'boolean' }
    }
  },
  execute: async ({ elementId, visible }, { signal }) => {
    if (signal.aborted) {
      throw new Error('App action was aborted.')
    }
    return elementApis.setElementVisible(elementId, visible, {
      undoable: true,
      sharedDelivery: 'transaction-end'
    })
  }
}

const actions = [setVisibility]
```

`inputSchema` is the backend-facing JSON-compatible action description sent to
the provider. The backend prepares each action's execution arguments and
bounded redaction-ready summary before returning an `AiActionBatch`. Runtime
does not parse or validate the model payload against `inputSchema`; permission
and execution receive the exact server-prepared arguments identity.
Confirmation and terminal preview redact and retain only the bounded summary,
never complete action arguments. Executors use app common/public APIs; they
never expose arbitrary functions, package internals, or Render objects to the
provider.

## Select a Replaceable Provider

For deterministic tests, implement `AiProvider` directly. For production HTTP
transport, point the generic adapter at an app/backend endpoint:

```ts
import { createGenericHttpAiProvider } from '@asyra/ai-agent-runtime'

const provider = createGenericHttpAiProvider({
  endpoint: '/api/ai-agent',
  timeoutMs: 30_000
})
```

The backend owns vendor API keys, authentication, rate limits, and
provider-specific repair. Do not put a server API key in browser headers,
metadata, storage, or source.

A test harness may prepare a deterministic response before App startup, but the
composed provider still exposes only `requestActionBatch(input, { signal })`.
Live transport and test transport return the same server-prepared
`AiActionBatch`; neither source selects another Runtime or canonical mutation
path.

## Compose the Runtime

```ts
import { createAiAgentRuntime } from '@asyra/ai-agent-runtime'

const runtime = createAiAgentRuntime({
  provider,
  actionDefinitions: actions,
  contextProvider: appContextProvider,
  permissionPolicy: appPermissionPolicy,
  confirmationHandler: appConfirmationHandler,
  transactionRunner: {
    run: (_label, execute) => transactionApis.runTransaction(execute)
  },
  options: {
    retryPolicy: { maxAttempts: 2 },
    redaction: { additionalSecretKeys: ['tenantCredential'] }
  },
  ownedResources: [provider]
})
```

Injected resources are borrowed unless they also appear in `ownedResources`.
Retry is opt-in, bounded to the provider request, and never repeats action
execution or a transaction.

## Invoke from Feature System

```ts
const result = await runtime.run({
  intent,
  progressObserver: (update) => {
    appAiConversation.projectOperationalProgress(update)
  },
  signal: featureSignal,
  metadata: {
    requestId
  }
})
```

The app Feature owns exclusivity, active-task rejection, cancellation, and
lifecycle completion. Pass its signal through; do not build another command
queue or session manager around the runtime.

The optional invocation-local observer receives only frozen operational
updates. Treat phases as presentation evidence, map them to concise status
labels, and do not infer permission, transaction, or terminal behavior from
them. Observer failure cannot alter the invocation, and abort/disposal prevents
later delivery.

Handle exactly one terminal result:

- `executed`: present or persist only the detached redacted evidence the app
  needs;
- `cancelled`: treat confirmation cancellation as a normal no-mutation outcome;
- `failed`: report the stable code/stage/message, not provider or executor
  exception data.

## Dispose at the Composition Owner

```ts
await runtime.dispose()
```

Disposal prevents new work, aborts and awaits active invocations, and disposes
only explicitly owned resources. It does not dispose app canonical owners,
Render, Collaboration, or borrowed providers.

## Verify

- AI-disabled startup constructs no runtime, provider, Feature, listener, timer,
  network request, or secret read.
- The provider exposes only `requestActionBatch()` and returns one
  server-prepared `AiActionBatch` with one `batchId`.
- `runtime.resolveAiActionBatch()` preflights only the control envelope,
  including the empty-batch rule, duplicate action ids, and unknown actions.
- Runtime never traverses, validates, normalizes, clones, or freezes action
  arguments. Permission and execution receive the exact same arguments
  identity; confirmation and terminal preview receive only the redacted
  bounded summary.
- Denial or cancellation opens no transaction.
- One accepted multi-action batch opens one transaction and produces one
  intended undo entry.
- A resolved app-owned recoverable partial result may commit successful sibling
  mutations in that same undo entry.
- A rejected/throwing executor is fatal and rolls back without an accepted
  canonical prefix.
- Direct test providers and generic HTTP providers pass the same
  action-batch/runtime contract.
- Audit, preview, failure, context, and metadata redact secret-like values.
- Progress contains no provider body, action arguments, context, canonical
  state, secret, or chain-of-thought and stops after abort/disposal.

Executable reference:
`docs/public/build/ai-actions.md`.
