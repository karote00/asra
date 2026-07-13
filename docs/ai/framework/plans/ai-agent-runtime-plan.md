# AI Agent Runtime Plan

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

## Proposed Package Responsibility

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

The package should not own app-domain actions. For example, the runtime may know
that an action named `create_shape` exists after the app registers it, but it
must not know how a particular product creates a shape.

## Public Interface Direction

The first implementation should keep interfaces small and app-agnostic.

Candidate contracts:

```ts
export interface AiProvider {
  generateActionPlan(input: AiProviderInput): Promise<AiProviderResult>
}

export interface AiContextProvider<TContext = unknown> {
  getContext(): Promise<TContext>
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
  run(label: string, execute: () => Promise<void>): Promise<void>
}

export interface AiPermissionPolicy {
  evaluate(action: AiPlannedAction): AiPermissionDecision
}
```

Data types to define:
- `AiPlan`
- `AiPlannedAction`
- `AiProviderInput`
- `AiProviderResult`
- `AiExecutionContext`
- `AiExecutionResult`
- `AiActionResult`
- `AiValidationError`
- `AiPermissionDecision`

The schema abstraction should avoid forcing one validation library in the
framework contract. A concrete app may adapt Zod, Valibot, JSON Schema, or a
custom validator behind `AiActionSchema`.

## Provider Strategy

The runtime owns a provider abstraction, not a hard dependency on a model
vendor.

Provider rules:
- first provider adapter may target OpenAI or a generic HTTP provider
- provider configuration comes from app/server environment, for example
  `OPENAI_API_KEY`
- committed source may include `.env.example` values, but never real secrets
- apps may expose self-host or BYOK patterns
- the framework should document the integration boundary without owning secret
  storage policy for every app
- browser clients must not expose secret API keys directly by default

Recommended local development shape:

```txt
.env.example
  ASYRA_AI_ENABLED=false
  OPENAI_API_KEY=
  OPENAI_MODEL=

.env.local
  ASYRA_AI_ENABLED=true
  OPENAI_API_KEY=<developer-owned key>
  OPENAI_MODEL=<chosen model>
```

Apps that want user-owned provider configuration should prefer a custom backend
endpoint or self-hosted setup. Direct browser BYOK can be supported by an app,
but it should be documented as a product-level security decision rather than a
framework default.

## Execution Flow

Canonical AI action flow:

1. User submits a natural-language request.
2. App context provider summarizes current state and constraints.
3. Runtime sends request, context, and available action definitions to the
   provider.
4. Provider returns a structured action plan.
5. Runtime validates the plan.
6. Runtime optionally returns a preview for user confirmation.
7. Runtime executes all accepted actions through app-provided executors inside
   one transaction runner call.
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

## Future Implementation Test Plan

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

## Assumptions

- The package name is `@asyra/ai-agent-runtime`.
- The plan remains in Deferred Plans until implementation priority changes.
- This is a docs-only planning record; no package scaffolding or runtime
  implementation is included yet.
- The framework package remains app-agnostic and optional.
- App-specific AI behavior belongs in each app, not in
  `@asyra/ai-agent-runtime`.
