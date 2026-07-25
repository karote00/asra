# AI Agent Runtime Package

`@asyra/ai-agent-runtime` is an optional, provider-replaceable orchestration
runtime for turning natural-language intent into registered app actions. It is
not a model vendor SDK, Feature System replacement, canonical state owner,
transaction engine, permission authority, or collaboration transport.

## Activation and Ownership

Importing the package is inert. An app opts in by creating one runtime with:

- one `AiProvider`;
- app-owned context, schema-backed actions, permission, confirmation, and
  transaction adapters;
- optional bounded retry and redaction options;
- only the resources that this runtime composition explicitly owns.

The app invokes `runtime.run(...)` from its Feature System lifecycle and passes
the Feature-owned abort signal. Feature System retains trigger, exclusivity,
cancel, and completion ownership; the runtime creates no second session queue.

Injected providers and app adapters are borrowed by default. `dispose()` aborts
and awaits active invocations, disposes the instance-local registry, and
disposes only resources listed in `ownedResources`.

## Invocation Flow

```text
app Feature intent + AbortSignal
-> app context provider
-> deterministic provider-safe action catalog
-> replaceable provider candidate output
-> normalize and validate the complete plan
-> app permission for every action
-> optional complete-plan confirmation
-> one app transaction runner
-> registered app executors in order
-> app common/public APIs and canonical owners
-> detached redacted terminal result
```

Provider planning and optional retry complete before the transaction opens.
Validation, permission denial, and confirmation cancellation apply no canonical
prefix. Once execution begins, provider retry is forbidden. Executor failure
propagates through the one app transaction runner so its ordinary rollback
contract owns reversal.

## Public Surface

Composition and execution:

- `createAiAgentRuntime(input)`
- `AiAgentRuntime`
- `CreateAiAgentRuntimeInput`
- `AiRunRequest`
- `AiRuntimeOptions`
- `AiRuntimeResult`
- executed, cancelled, failed, stage, and failure-code result types

Actions and planning:

- `createAiActionRegistry()`
- `AiActionDefinition`
- `AiActionSchema` and strict success/failure result types
- `AiActionDescription`
- `AiPlan`, `AiPreparedPlan`, validation errors, and retry policy types

Provider boundary:

- `AiProvider` and `AiProviderInput`
- `createGenericHttpAiProvider(options)`
- generic HTTP fetch, response, and configuration types
- `AiProviderError`

Policy and evidence:

- context, permission, confirmation, and transaction adapter types
- `redactAiValue(...)`
- `createAiRuntimeAudit(...)`
- detached preview, execution summary, and audit types

Low-level orchestration functions are public for focused adapters and tests:
normalization, validation, permission evaluation, confirmation, action
execution, and transaction wrapping. Apps should normally use
`createAiAgentRuntime(...)` for the complete ordering contract.

## Terminal Results

- `executed`: plan id, complete redacted preview, ordered detached action
  results, committed transaction outcome, and audit.
- `cancelled`: stable `aborted` or `confirmation-cancelled` reason plus a
  detached audit and preview when available.
- `failed`: stable code, owner stage, retry count, stable message, and detached
  audit.

No result grants mutation authority or contains canonical scene state.

## Provider and Secret Boundary

The generic HTTP adapter posts detached JSON to an app-selected HTTPS or
same-origin endpoint. The endpoint may be a backend proxy that owns vendor
selection, authentication, API keys, rate limits, and provider-specific
repair.

The runtime and adapter never read `OPENAI_API_KEY`, environment files,
browser storage, or another implicit credential source. Authorization, token,
key, password, cookie, configured secret keys, and authorization-like values
are recursively redacted from context sent by the runtime, metadata, preview,
executor summaries, audit, and stable failures.

Raw provider bodies and third-party error messages are never terminal output.
See `../SECURITY.md`.

## Reference App

Asyra Design composes the runtime only after explicit enablement. Its bounded
reference catalog contains only:

- `set_element_visibility`
- `select_elements`

Both executors use app common APIs with `undoable: true` and
`sharedDelivery: 'transaction-end'`. Factory, canonical state owners, Render,
and optional Collaboration therefore receive the same route as ordinary app
actions. The reference permission map is explicit and default-deny;
confirmation defaults to cancellation.

## Validation

```bash
yarn workspace @asyra/ai-agent-runtime test:local
yarn workspace @asyra/ai-agent-runtime build:ai-agent-runtime
yarn workspace @asyra/ai-agent-runtime example:ai-agent-runtime
```

Executable example: `docs/examples/ai-agent-runtime.mjs`.

Golden Path: `../golden-paths/compose-ai-agent-runtime.md`.

Product contract:
`../plans/completed/ai-agent-runtime-plan.md`.

Dedicated Inspector:
`../plans/ai-agent-runtime-flow-inspector.html`.
