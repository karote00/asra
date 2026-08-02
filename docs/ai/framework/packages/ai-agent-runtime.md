# AI Agent Runtime Package

`@asyra/ai-agent-runtime` is an optional, provider-replaceable orchestration
runtime for turning natural-language intent into registered app actions. It is
not a model vendor SDK, Feature System replacement, canonical state owner,
transaction engine, permission authority, or collaboration transport.

## Activation and Ownership

Importing the package is inert. An app opts in by creating one runtime with:

- one `AiProvider`;
- app-owned context, action definitions, permission, confirmation, and
  transaction adapters;
- optional bounded retry and redaction options;
- only the resources that this runtime composition explicitly owns.

The app invokes `runtime.run(...)` from its Feature System lifecycle and passes
the Feature-owned abort signal. One invocation may also pass an optional
`progressObserver`; Feature System retains trigger, exclusivity, cancel, and
completion ownership, and the runtime creates no second session queue.

Injected providers and app adapters are borrowed by default. `dispose()` aborts
and awaits active invocations, disposes the instance-local registry, and
disposes only resources listed in `ownedResources`.

## Invocation Flow

```text
app Feature intent + AbortSignal
-> app context provider
-> deterministic provider-safe action catalog
-> provider.requestActionBatch()
-> server-prepared AiActionBatch
-> Runtime.resolveAiActionBatch()
   -> preflight the small control envelope
   -> bind ordered actions to registered executors
-> app permission for every action
-> optional complete-batch confirmation through AiActionBatchPreview
-> one app transaction runner
-> registered app executors in order
-> app common/public APIs and canonical owners
-> optional detached operational progress observations
-> detached redacted terminal result
```

The provider request and optional retry complete before the transaction opens.
`AiProvider.requestActionBatch()` is the only provider request contract. It
returns one server-prepared `AiActionBatch` with one `batchId`, optional
explanation, and ordered actions containing execution arguments plus a bounded
redaction-ready summary. A live backend provider and a test transport return
that same contract; the response source cannot select a different resolution,
permission, confirmation, execution, or canonical mutation path.

`runtime.resolveAiActionBatch()` checks only the small control envelope:
required data properties, a non-empty `batchId`, the non-empty actions rule,
duplicate action ids, and registered action names. It does not traverse,
validate, normalize, clone, or freeze nested arguments. The resulting
`ResolvedAiActionBatch`, permission policy, and executor preserve the exact
server-prepared arguments identity. `PermissionReadyAiActionBatch` adds only
permission decisions; `AiActionBatchPreview` redacts and retains only bounded
summaries. Invalid control envelopes, permission denial, and confirmation
cancellation apply no canonical prefix. Once execution begins, provider retry
is forbidden. Executor failure means a rejected/throwing executor or fatal
canonical consistency failure; it propagates through the one app transaction
runner so its ordinary rollback contract owns reversal. An app may instead
resolve an executor with detached recoverable partial-item evidence, allowing
successful sibling mutations to commit in the same intended undo unit.

## Public Surface

Composition and execution:

- `createAiAgentRuntime(input)`
- `AiAgentRuntime`
- `CreateAiAgentRuntimeInput`
- `AiRunRequest`
- `AiRuntimeOptions`
- `AiRuntimeResult`
- executed, cancelled, failed, stage, and failure-code result types
- `AiRuntimeProgressObserver`, `AiRuntimeProgressUpdate`,
  `AiRuntimeProgressPhase`, and `AiRuntimeProgressOutcome`

Actions and action batches:

- `createAiActionRegistry()`
- `AiActionDefinition`
- `AiActionDefinition.inputSchema` is the JSON-compatible backend-facing action
  description; `AiActionDefinition.execute` is the app-owned executor
- `AiActionDescription`
- `AiActionBatch`, `AiActionBatchAction`, `ResolvedAiActionBatch`,
  `PermissionReadyAiActionBatch`, and `AiActionBatchPreview`
- action-batch resolution failures and retry policy types

Provider boundary:

- `AiProvider` and `AiProviderInput`
- `AiProvider.requestActionBatch(input, { signal })`
- `createGenericHttpAiProvider(options)`
- generic HTTP fetch, response, and configuration types
- `AiProviderError`

Policy and evidence:

- context, permission, confirmation, and transaction adapter types
- `redactAiValue(...)`
- `createAiRuntimeAudit(...)`
- detached preview, execution summary, and audit types

Permission evaluation, confirmation, action execution, and transaction
wrapping remain focused orchestration surfaces. The runtime instance exposes
`resolveAiActionBatch(batch, { signal })`; there is no top-level resolution
helper, client payload preparation API, compatibility wrapper, or alternate
payload mode. Apps use `runtime.run()` for the complete ordering contract.

## Terminal Results

- `executed`: batch id, bounded summary-only preview, ordered detached action
  results, committed transaction outcome, and audit.
- `cancelled`: stable `aborted` or `confirmation-cancelled` reason plus a
  detached audit and preview when available.
- `failed`: stable code, owner stage, retry count, stable message, and detached
  audit.

No result grants mutation authority or contains canonical scene state.
`AiActionBatchPreview` contains only redacted server-prepared summaries. It
never retains complete item, path, point, geometry, or other action-argument
graphs. The runtime does not require an app to render its low-level actions or
provide a visual preview to the user.

An invocation-local progress observer receives ordered frozen updates for
context, provider attempts, resolution, permission, confirmation wait when
required, execution, and non-abort settlement. Updates contain only stable
operational summaries plus safe attempt, batch id, action count, and terminal
outcome fields. They never contain provider bodies, action arguments, app
context, canonical state, secrets, or model chain-of-thought. Observer
exceptions are contained. Caller abort or runtime disposal prevents later
progress delivery and releases the invocation-owned reference.

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

Asyra Design composes one formal provider during App startup. Its bounded
reference catalog contains only:

- `request_drawing_detail_choice`
- `insert_vector_composition`
- `update_composition_elements`
- `remove_ai_composition`
- `set_element_visibility`
- `select_elements`

The backend prepares the insert action's compact transferable geometry and
bounded summary before the provider returns its `AiActionBatch`; Runtime does
not redo that model work. The executor materializes only the current ordered
progressive slice on the main thread. Executors use app common APIs with
`undoable: true`; their declared transaction-end or progressive shared
delivery remains inside one outer App transaction. Factory, canonical state
owners, Render, and optional Collaboration therefore receive the same route as
ordinary app actions. The reference permission map is explicit and
default-deny; confirmation defaults to cancellation.

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
