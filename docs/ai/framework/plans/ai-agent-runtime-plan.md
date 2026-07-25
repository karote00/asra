# AI Agent Runtime Plan

## Status

Framework Release Gate 4 is active from baseline `0e3eee620`, after the
completed Gate 1 app-level migration, Gate 2 network collaboration transport,
and Gate 3 Group hierarchy contracts were verified on `main`.

The package ships in the first public framework release but remains optional to
install and activate at app runtime. Production implementation begins only after
this product contract, the matching Inspector owner flow, the bounded product
cases, and the readiness gates agree.

Release inclusion requires at least one production-capable provider adapter or
generic provider integration through the replaceable boundary. The exact first
adapter is the generic HTTP provider defined below. It does not make a model
vendor mandatory and does not read or expose a browser-held server API key.

## Product Contract

### Supported Behavior

- An app-owned Feature receives natural-language intent and invokes one
  app-composed AI runtime instance with the Feature lifecycle `AbortSignal`.
- The Feature uses the Feature System's programmatic task lifecycle for this
  non-mutating async planning boundary. The Feature System creates the signal,
  rejects overlapping invocation of the same Feature, owns explicit
  cancellation and active-unregister protection, and does not open a canonical
  transaction around provider work.
- The app supplies context, schema-backed action definitions, permission
  policy, confirmation UI, transaction runner, and domain executors.
- The runtime sends detached intent/context/action descriptions through one
  replaceable provider, treats the result as a candidate plan, and validates
  the complete plan before the first mutation.
- Only registered actions with schema-valid arguments may reach app executors.
- Permission denial and required confirmation are decided before transaction
  execution. Confirmation cancellation is a successful no-mutation terminal
  outcome, not an execution failure.
- One accepted plan enters one app-owned transaction runner call by default.
  Executor failure is owned by that runner's rollback contract and leaves no
  accepted canonical prefix.
- App executors mutate through app common/public APIs. Canonical package owners,
  ordinary Render derivation, persistence, undo/redo, and optional
  Collaboration publication remain unchanged.
- The runtime returns detached preview, execution, audit, explanation, and
  failure results with configured secret fields redacted.
- Abort, provider timeout, bounded retry, failure, and disposal remove runtime
  listeners/timers and do not create a second execute/session/cancel owner.
- Separate runtime instances keep providers, registries, policies, audit
  results, cancellation, retry state, and in-flight work isolated.

### Unsupported Behavior

- No arbitrary code, script, expression, dynamic import, package-private API,
  renderer object, engine object, or app-private store may be selected by model
  output.
- The runtime does not own app Feature registration, domain semantics,
  confirmation UI, canonical state, transaction history, collaboration
  conflict policy, persistence, or provider credentials.
- Importing the package or starting an app without explicit AI activation must
  not construct a provider/runtime instance, read a secret, open a network
  connection, or install a Feature.
- A provider-disabled composition makes no provider request. An AI-disabled app
  omits the composition entirely.
- Direct browser use of a server model API key is not the default or reference
  contract. Live vendor smoke tests are opt-in and never required by CI.

### Public Input Contracts

- `AiRunRequest`: non-empty natural-language `intent`, Feature-owned
  `AbortSignal`, and optional app metadata safe to disclose to the provider.
- `AiContextProvider`: returns a detached app-owned context value for the
  current request.
- `AiActionDefinition<TArgs>`: stable name, description,
  library-agnostic `AiActionSchema<TArgs>`, and app-owned executor.
- `AiProvider`: receives a detached request containing intent, context, and
  deterministic action descriptions; it returns `unknown` provider output for
  runtime validation.
- `AiPermissionPolicy`: returns `allow`, `deny`, or `confirm` for every prepared
  action before execution.
- `AiConfirmationHandler`: receives one immutable complete preview and returns
  accepted or cancelled.
- `AiTransactionRunner`: owns commit/rollback behavior for the complete accepted
  action sequence.
- Runtime options may define provider timeout, bounded retry policy, and
  additional secret-key names; defaults remain finite and deterministic.

### Public Output Contracts

- `preview`: a detached, immutable complete plan with action names, validated
  arguments, permission decisions, and a redacted explanation.
- `executed`: the accepted plan id, ordered app action results, one transaction
  outcome, and redacted audit/explanation output.
- `cancelled`: a no-mutation confirmation or Feature abort outcome with a stable
  reason.
- `failed`: a stable runtime error code, stage, retry count, and redacted
  diagnostics. Raw provider responses, credentials, authorization headers, and
  secret-like values are never returned.
- No result type contains canonical scene state or grants authority to apply
  model output directly.

### Ownership And Forbidden Boundaries

- App Feature System owner: natural-language trigger, priority/exclusive mode,
  programmatic task execution/cancel lifecycle, active-unregister protection,
  and the lifecycle signal.
- App owners: context, action definitions, schemas, permission, confirmation,
  transaction adapter, domain executors, common/public API calls, collaboration
  options, and product UI.
- `@asyra/ai-agent-runtime`: isolated registry, provider orchestration, provider
  result normalization, complete plan validation, preflight sequencing, redacted
  preview/audit/failure output, bounded retry, timeout, and listener/timer
  cleanup.
- Replaceable provider: request transport and untrusted result production only.
- Factory/app transaction adapter: one accepted plan to one intended undo commit
  and rollback on executor failure.
- Canonical state packages: their existing validation and mutation invariants.
- Render/UI and Collaboration: existing derived and transport-only routes.
- Forbidden contributors: Render/Pixi/Three objects, package internals,
  local-only stores as canonical state, provider-side mutation, arbitrary model
  code, a second session queue, framework-owned app permission/domain policy,
  or diagnostic/audit values used as product input.

### Provider Adapter Decision

The first production-capable adapter is a generic HTTP provider:

- it uses platform `fetch` or an injected fetch-compatible function and adds no
  SDK or schema dependency;
- it posts the detached `AiProviderInput` as JSON to an app-selected HTTPS or
  same-origin endpoint and treats the JSON response as untrusted `unknown`;
- the endpoint may be an app/backend proxy that owns vendor selection,
  authentication, server API keys, rate limits, and provider-specific repair;
- the adapter never reads `OPENAI_API_KEY`, environment files, local storage, or
  browser globals for credentials;
- app-supplied headers are accepted only as provider configuration and are
  redacted from diagnostics; the reference app does not supply a server secret
  to browser code;
- transport failure, non-success status, malformed JSON, abort, timeout, and
  disposal use stable redacted failures and release request resources;
- deterministic fake providers remain the formal test and CI authority. A live
  provider test is a separate opt-in smoke gate.

### Failure Cleanup And Bypass Contract

- AI-disabled: no package composition, provider, network, secret read, Feature,
  runtime, listener, timer, or startup side effect.
- Provider-disabled: the app Feature returns a stable unavailable result without
  invoking context collection or provider transport.
- Feature task cancellation aborts the Feature-owned signal and releases its
  external abort listener after settlement. A second invocation of the same
  active Feature is rejected rather than placed in another runtime queue.
- Non-collaborative: accepted actions use the same app common APIs without a
  shared channel; no Collaboration object is created by the runtime.
- Malformed provider result, unknown/duplicate action, invalid schema,
  permission denial, confirmation cancellation, abort, or timeout terminates
  before mutation.
- Executor failure occurs inside the one transaction runner and must roll back
  all rollbackable canonical writes before the runtime reports failure.
- Retry is bounded, opt-in, provider-stage-only, and never repeats a transaction
  or action executor.
- The app Feature owns lifecycle completion. The runtime owns only listeners,
  timers, request attempts, and detached orchestration state created by its
  invocation.

### Product Cases

Formal product cases cover:

1. deterministic registration/listing and duplicate-name rejection;
2. known action with valid arguments and unknown/invalid action rejection;
3. permission allow/deny and confirmation accepted/cancelled;
4. complete multi-action preflight before the first executor call;
5. one accepted multi-action plan through one transaction runner call;
6. executor failure rollback with no canonical prefix;
7. malformed output, provider failure, bounded retry, abort, timeout, disposal,
   and cleanup;
8. redaction of configured keys, authorization values, tokens, and nested
   provider failures;
9. isolated registries/providers/in-flight state across runtime instances;
10. app-owned common API execution, ordinary Render derivation, and optional
    canonical Collaboration publication;
11. AI-disabled and provider-disabled zero-side-effect bypasses;
12. provider replacement between deterministic fake and generic HTTP adapters
    without changing runtime or app action contracts.

### Definition Of Done

- The product contract and AI Agent Runtime Flow Inspector agree on every owner,
  input/output, route, condition, bypass, forbidden contributor, failure owner,
  cleanup owner, product case, and gate.
- Inspector structure, readiness, Gherkin synchronization, and executable
  runtime BDD contracts pass.
- `@asyra/ai-agent-runtime` builds and exposes documented public types,
  registry, runtime, redaction utility, deterministic fake test support, and the
  generic HTTP provider without a model SDK or schema-library dependency.
- Package tests prove registry, schema, permission, confirmation, preflight,
  transaction, rollback/no-prefix, provider failure/retry, abort/timeout,
  redaction, cleanup, and instance isolation.
- Asyra Design proves one app-owned Feature, context provider, action registry,
  permission/confirmation adapter, and common-API transaction execution. Its
  disabled route has zero AI startup/network/secret side effects.
- The reference integration proves one accepted plan is one undo commit and,
  when Collaboration is already enabled by the app, AI-originated mutations use
  the ordinary canonical publication route.
- Public API, package, security, Golden Path, app behavior, and release decision
  documents agree; all focused package/app tests, dependency validation, lint,
  production builds, and bounded final review pass.
- No live API key or live vendor smoke test is required for contract,
  implementation, deterministic tests, or CI completion.

## Context

Asyra is a canvas-tool framework, not a model provider. AI support should
therefore enter the system as another controlled input source, not as a new
source of truth.

The framework already has useful boundaries for AI-assisted editing:

- feature/session flow for user intent execution
- app/common APIs for domain-specific mutations and queries
- schema validation for safe persisted data
- transaction boundaries for undo/redo
- persistence hooks for save/load
- shared data channels for collaborative state propagation
- render as derived output rather than authoritative state

An AI agent runtime should use those existing contracts. It must not directly
mutate renderer state, Pixi/Three objects, local-only stores, or app internals.

## Goal

Provide an optional reusable package:

```txt
@asyra/ai-agent-runtime
```

The package should convert natural-language user intent into structured,
validated app actions while leaving all app-specific domain behavior in the app
that opts into AI.

End-state:

- apps can opt into AI without making AI a core framework dependency
- natural-language intent becomes structured action plans
- action plans are validated before execution
- the app invokes planning/execution inside an app-owned Feature System
  execution or session; the AI runtime does not become another intent lifecycle
  owner
- accepted plans execute through app-owned APIs and transaction runners
- one accepted AI plan maps to one intended undo commit by default
- collaboration-compatible apps can route AI-originated changes through the same
  shared mutation path as ordinary user actions
- model providers remain replaceable

## Non-Goals

Out of scope for this framework plan:

- building a full product-specific design, CAD, or whiteboard agent
- storing, committing, or shipping API keys
- making OpenAI, Codex, or any provider mandatory
- allowing arbitrary code execution from model output
- allowing AI to bypass Asyra transaction, validation, persistence, or
  collaboration paths
- creating another execute/session/cancel runtime beside Feature System
- requiring apps to use AI at all
- requiring browser clients to hold secret API keys directly

## Conflict Review

No blocking conflicts were found in the prior design discussion.

Clarifications:

- AI changes do not automatically get undo/redo or collaboration merely because
  a model is used. They get those guarantees only when executed through Asyra
  transaction/common-API/shared mutation paths.
- The AI runtime must not depend on concrete app behavior. Apps register their
  own actions, context providers, prompts, permission policies, and executors.
- CRDT/Yjs collaboration should be described as a compatible execution path, not
  as direct renderer or local-state mutation.
- API keys must come from app/server environment or user-owned configuration,
  not committed framework/app source.

## Package Responsibility

`@asyra/ai-agent-runtime` owns reusable orchestration only.

Responsibilities:

- provider interface and provider adapter boundary
- action registry with schema-backed action definitions
- context provider interface for app-provided scene/state summaries
- planner pipeline:
  - user request
  - app context
  - available action descriptions
  - structured action plan output
- validator pipeline:
  - known action names
  - action argument schemas
  - permission policy
  - execution policy
- preview/confirm pipeline for user-visible review before execution
- transaction runner interface so apps can execute one accepted plan as one
  undoable user action
- error handling for invalid action plans, validation failures, partial execution
  prevention, and retry planning
- optional audit/explanation output describing what the AI planned and executed

The runtime is invoked by an app-owned feature and consumes that feature's
cancellation/lifecycle signal. It may coordinate provider planning, validation,
and the accepted action sequence, but Feature System remains the sole owner of
execute/session/cancel decisions and operation serialization.

The package should not own app-domain actions. For example, the runtime may know
that an action named `create_shape` exists after the app registers it, but it
must not know how a particular product creates a shape.

## Public Interface Contract

The public interfaces remain small and app-agnostic:

```ts
export interface AiProvider {
  generateActionPlan(
    input: AiProviderInput,
    options: { signal: AbortSignal }
  ): Promise<unknown>
}

export interface AiContextProvider<TContext = unknown> {
  getContext(input: { intent: string; signal: AbortSignal }): Promise<TContext>
}

export interface AiActionDefinition<TArgs = unknown> {
  name: string
  description: string
  schema: AiActionSchema<TArgs>
  execute(args: TArgs, context: AiExecutionContext): Promise<AiActionResult>
}

export interface AiActionRegistry {
  register(action: AiActionDefinition): void
  get(name: string): AiActionDefinition | undefined
  list(): AiActionDefinition[]
}

export interface AiTransactionRunner {
  run<T>(label: string, execute: () => Promise<T>): Promise<T>
}

export interface AiPermissionPolicy {
  evaluate(action: AiPreparedAction): AiPermissionDecision
}
```

Data types to define:

- `AiPlan`
- `AiPlannedAction`
- `AiProviderInput`
- `AiProviderOutput`
- `AiExecutionContext`
- `AiExecutionResult`
- `AiActionResult`
- `AiValidationError`
- `AiPermissionDecision`
- `AiConfirmationHandler`
- `AiRuntimeOptions`

`AiActionSchema` returns a stable success/failure result with parsed typed
arguments and detached issues. It does not force one validation library. A
concrete app may adapt an existing schema tool or a custom validator behind that
contract.

## Provider Strategy

The runtime owns a provider abstraction, not a hard dependency on a model
vendor.

Provider rules:

- the first adapter is the generic HTTP provider in
  [Provider Adapter Decision](#provider-adapter-decision);
- app/server composition owns endpoint selection, vendor credentials,
  authentication, rate limits, and deployment secret storage;
- the runtime and adapter never read a server API key from browser environment,
  storage, source, test fixtures, or logs;
- deterministic fake providers prove CI behavior without network or secrets;
- apps may compose a self-hosted or vendor-specific provider through the same
  public interface without changing runtime validation/execution.

## Execution Flow

Canonical AI action flow:

1. An app-owned feature receives the user's natural-language request and invokes
   the AI runtime with its lifecycle/cancellation context.
2. App context provider summarizes current state and constraints.
3. Runtime sends request, context, and available action definitions to the
   provider.
4. Provider returns a structured action plan.
5. Runtime validates the plan.
6. Runtime optionally returns a preview for user confirmation.
7. Runtime executes all accepted actions through app-provided executors inside
   one transaction runner call while the app feature remains the lifecycle
   owner.
8. Render updates as derived output from state changes.
9. If the app uses shared mutation channels, collaborators receive the same state
   changes through the normal collaborative path.

The model response is never persisted as authoritative scene state. Validated
Asyra mutations are the source of truth.

## Undo/Redo and Collaboration Rules

Default behavior:

- one accepted AI plan maps to one intended undo commit
- apps may split very large plans into explicit transaction groups only when
  that matches the user-facing action model
- AI execution must use app/common APIs that already preserve transaction
  behavior
- AI execution must use shared mutation options/channels when collaboration is
  enabled
- model output itself is only a plan; the framework state mutation is the actual
  committed result

The runtime should expose enough metadata for user-action completion events and
audit logs, but it should not define app-specific history UI behavior.

## Security and Safety

Safety rules:

- no arbitrary code execution from model output
- only registered actions are executable
- all action arguments must pass schema validation
- unknown actions fail validation
- destructive or broad actions require explicit permission policy support
- provider errors, invalid JSON, unknown actions, and schema mismatches must fail
  without partial state mutation
- logs should avoid storing secrets or full user data unless apps explicitly opt
  in
- secret values must be redacted from diagnostics and provider error surfaces

The executor should validate the full plan before executing the first mutating
action whenever possible. If an app action can fail during execution, the app
must decide whether its transaction runner supports rollback or whether the
runtime should only execute actions that passed all preflight checks.

## Cost and Testing Notes

Cost-control principles:

- typical action-planning requests should be designed as one model call plus
  optional repair/summary calls
- compact app context should be preferred over dumping full scene state
- available action definitions should be concise and schema-driven
- web search, image generation, and video generation are out of scope for the
  core runtime and should be treated as optional provider capabilities
- local development should use developer-owned API keys through uncommitted
  environment files

The runtime should support useful behavior without requiring web search or
generated media. Apps can add those capabilities as separate registered actions
or provider extensions.

## Implementation Test Plan

Action registry tests:

- registers actions
- rejects duplicate action names
- lists available actions deterministically
- rejects unknown planned actions

Validation tests:

- accepts schema-valid action arguments
- rejects schema-invalid arguments
- blocks actions denied by permission policy
- preserves no-mutation behavior on invalid plans

Execution tests:

- executes a valid multi-action plan in one transaction
- rolls back or prevents execution on preflight validation failure
- returns clear execution results and action summaries
- does not call renderer or app internals directly

Provider adapter tests:

- maps provider structured output into `AiPlan`
- handles malformed provider output
- handles provider errors and retries where configured
- never requires a provider when AI runtime is not used

Integration tests:

- app registers app-owned actions and context provider
- accepted AI action plan updates state through common APIs
- undo reverts the full AI action batch
- shared/collaborative mutation path receives AI-originated changes when enabled

Release-boundary tests:

- importing and starting an app without AI activation creates no provider,
  network request, model configuration, secret read, or AI runtime side effect
- the production-capable adapter passes structured-output, malformed-result,
  provider-failure, redaction, abort, timeout, and cleanup cases
- all planned actions validate before the first mutation and a rejected plan
  applies no canonical prefix
- one accepted plan creates one intended undo commit unless the approved plan
  explicitly declares bounded transaction groups
- AI-originated shared changes use the same origin/dedupe/conflict/remote apply
  path as ordinary app actions when collaboration is enabled
- model output cannot call unregistered actions, internal package APIs, Render
  objects, arbitrary code, or app-private state
- provider planning and action execution honor the owning Feature System abort,
  timeout, and cleanup lifecycle without introducing another session queue

## Release-Gate Definition of Done

- the product contract and Inspector agree on every owner, input/output,
  Feature System lifecycle, permission, transaction, provider, collaboration,
  failure, and cleanup route;
- the reusable runtime package and first production-capable adapter are built,
  typed, documented, and independently replaceable;
- registry, validation, permission, confirmation, preflight, execution,
  rollback/no-partial-mutation, audit, redaction, abort, timeout, and instance
  isolation tests pass;
- one reference-app integration proves app-owned actions, complete undo,
  optional collaboration delivery, and provider replacement through public APIs;
- non-AI consumers retain unchanged startup, bundle/runtime ownership, and no
  provider or secret side effect;
- public package/API/security/example/Golden Path docs and release decisions
  agree;
- the plan is archived and the final release-readiness gate may begin.

## Assumptions

- The package name is `@asyra/ai-agent-runtime`.
- Gates 1-3 are closed on the active baseline.
- Readiness artifacts precede production package scaffolding.
- The framework package remains app-agnostic and optional.
- App-specific AI behavior belongs in each app, not in
  `@asyra/ai-agent-runtime`.
