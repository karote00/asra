# Compose an Optional AI Agent Runtime

Use this path when an app wants natural-language planning without transferring
Feature, permission, transaction, or canonical-state ownership to the runtime.

## Define App-Owned Actions

```ts
import type {
  AiActionDefinition,
  AiActionSchemaResult
} from '@asyra/ai-agent-runtime'
import { elementApis } from './common-apis'

interface SetVisibilityArgs {
  elementId: string
  visible: boolean
}

const parseSetVisibility = (
  value: unknown
): AiActionSchemaResult<SetVisibilityArgs> => {
  if (
    value &&
    typeof value === 'object' &&
    Reflect.ownKeys(value).length === 2 &&
    'elementId' in value &&
    typeof value.elementId === 'string' &&
    'visible' in value &&
    typeof value.visible === 'boolean'
  ) {
    return {
      success: true,
      value: {
        elementId: value.elementId,
        visible: value.visible
      }
    }
  }
  return {
    success: false,
    issues: [
      {
        code: 'invalid_visibility',
        message: 'Expected exact elementId and visible fields.',
        path: []
      }
    ]
  }
}

const setVisibility: AiActionDefinition<SetVisibilityArgs> = {
  name: 'set_visibility',
  description: 'Set one existing element visibility.',
  schema: {
    providerSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['elementId', 'visible'],
      properties: {
        elementId: { type: 'string', minLength: 1 },
        visible: { type: 'boolean' }
      }
    },
    parse: parseSetVisibility
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

The parser must return the strict `AiActionSchemaResult` contract. Do not
coerce, silently repair, or accept extra keys. Executors use app common/public
APIs; they never expose arbitrary functions, package internals, or Render
objects to the provider.

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
Retry is opt-in, bounded to provider planning, and never repeats action
execution or a transaction.

## Invoke from Feature System

```ts
const result = await runtime.run({
  intent,
  signal: featureSignal,
  metadata: {
    requestId
  }
})
```

The app Feature owns exclusivity, active-task rejection, cancellation, and
lifecycle completion. Pass its signal through; do not build another command
queue or session manager around the runtime.

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
- Every candidate action validates before permission and mutation.
- Denial or cancellation opens no transaction.
- One accepted multi-action plan opens one transaction and produces one
  intended undo entry.
- Executor failure rolls back without an accepted canonical prefix.
- Fake and generic HTTP providers pass the same action/runtime contract.
- Audit, preview, failure, context, and metadata redact secret-like values.

Executable reference:
`docs/examples/ai-agent-runtime.mjs`.
