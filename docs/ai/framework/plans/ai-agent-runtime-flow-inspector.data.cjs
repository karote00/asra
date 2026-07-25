/* global module */

;(function () {
  'use strict'

  const specPath = 'docs/ai/framework/plans/ai-agent-runtime-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/ai-agent-runtime-flow-inspector.data.cjs'

  const lanes = [
    {
      id: 'composition',
      title: 'App Composition and Feature Lifecycle',
      order: 1
    },
    {
      id: 'planning',
      title: 'Context, Registry, and Provider Planning',
      order: 2
    },
    { id: 'preflight', title: 'Complete Plan Preflight', order: 3 },
    { id: 'execution', title: 'Transaction and Canonical Execution', order: 4 },
    {
      id: 'projection',
      title: 'Projection and Optional Publication',
      order: 5
    },
    { id: 'observability', title: 'Audit, Failure, and Cleanup', order: 6 }
  ]

  const steps = [
    {
      id: 'compose-ai-runtime',
      order: 1,
      laneId: 'composition',
      title: 'Compose one optional AI runtime instance',
      ownerPackage: 'app composition root',
      purpose:
        'Opt one app instance into an isolated runtime/provider/registry composition without adding Core, Preset, or non-AI startup side effects.',
      inputs: [
        'app-owned AI enabled decision',
        'app-owned provider enabled decision',
        'app-selected provider, registry, context, policy, confirmation, and transaction adapters'
      ],
      outputs: ['artifact:runtime-composition', 'artifact:ai-disabled-bypass'],
      conditions: [
        'Composition occurs only after the app explicitly enables AI.',
        'Every runtime instance receives its own provider, registry, policies, cancellation state, retry state, and audit state.',
        'The generic HTTP adapter receives an app-selected endpoint and injected or platform fetch; it never reads a browser-held server API key.',
        'Cleanup owner: compose-ai-runtime disposes only the runtime instance and resources explicitly owned by this app composition.'
      ],
      bypasses: [
        'AI-disabled apps omit the package composition and produce artifact:ai-disabled-bypass with no runtime, provider, network, secret read, listener, timer, or Feature side effect.',
        'Importing types or package exports alone is inert.'
      ],
      allowedContributors: [
        'app startup composition',
        'public @asyra/ai-agent-runtime constructors and types',
        'app-owned provider and policy adapters'
      ],
      forbiddenContributors: [
        '@asyra/core or @asyra/preset implicit AI startup',
        'module-level provider construction',
        'environment or local-storage secret reads',
        'shared singleton registry or in-flight state across runtime instances'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/package.json',
        'packages/ai-agent-runtime/tsconfig.json',
        'packages/ai-agent-runtime/src/index.ts',
        'packages/ai-agent-runtime/src/runtime.ts',
        'packages/ai-agent-runtime/src/__tests__/composition.test.ts',
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/ai/composition.ts',
        'apps/asyra-design/src/ai/__tests__/composition.test.ts',
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__/init-app.test.ts',
        'scripts/__tests__/workspace-automation.test.mjs',
        'turbo.json',
        'yarn.lock'
      ],
      specRefs: [
        '#supported-behavior',
        '#unsupported-behavior',
        '#ownership-and-forbidden-boundaries',
        '#failure-cleanup-and-bypass-contract'
      ],
      failureOwnerStepId: 'compose-ai-runtime'
    },
    {
      id: 'route-natural-language-intent',
      order: 2,
      laneId: 'composition',
      title: 'Route natural-language intent through an app Feature',
      ownerPackage: 'app-owned @asyra/feature-system Feature',
      purpose:
        'Receive natural-language intent with explicit priority/exclusive behavior and retain sole Feature System ownership of execute/session/cancel serialization.',
      inputs: [
        'artifact:runtime-composition',
        'non-empty natural-language intent',
        'Feature-owned AbortSignal'
      ],
      outputs: [
        'artifact:feature-invocation',
        'artifact:provider-disabled-bypass'
      ],
      conditions: [
        'The app Feature owns the trigger, execution mode, priority, exclusive policy, lifecycle result, and cancellation signal.',
        'The Feature uses the public Feature System programmatic task lifecycle so provider wait time opens no canonical transaction.',
        'The Feature System creates the AbortSignal, rejects overlapping invocation of the same Feature, and protects active unregister; the runtime creates no second command/session queue.',
        'Cleanup owner: cleanup-feature-invocation completes invocation cleanup while the app Feature owns lifecycle completion.'
      ],
      bypasses: [
        'A provider-disabled composition returns artifact:provider-disabled-bypass before context collection or provider transport.',
        'A pre-aborted Feature signal reaches cleanup without provider or mutation work.'
      ],
      allowedContributors: [
        'app constants and Feature registration',
        'artifact:runtime-composition',
        'Feature-owned intent and AbortSignal',
        'public @asyra/feature-system task invocation and cancellation'
      ],
      forbiddenContributors: [
        'runtime-owned Feature registration or session queue',
        'input mapping business rules',
        'direct canonical mutation from the Feature',
        'provider-owned lifecycle completion'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/feature-system/src/types/task.ts',
        'packages/feature-system/src/types/feature.ts',
        'packages/feature-system/src/types/index.ts',
        'packages/feature-system/src/core/feature-task-registry.ts',
        'packages/feature-system/src/core/feature.ts',
        'packages/feature-system/src/index.ts',
        'packages/feature-system/__tests__/feature-task.test.ts',
        'apps/asyra-design/src/ai/composition.ts',
        'apps/asyra-design/src/ai/__tests__/composition.test.ts',
        'apps/asyra-design/src/constants/feature-names.ts',
        'apps/asyra-design/src/features/ai-agent/index.ts',
        'apps/asyra-design/src/features/ai-agent/__tests__/index.test.ts',
        'apps/asyra-design/src/init/foundation/init-features.ts',
        'apps/asyra-design/src/init/foundation/__tests__/init-features.test.ts',
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__/init-app.test.ts',
        'docs/ai/framework/packages/feature-system.md',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/ARCHITECTURE.md',
        'docs/ai/framework/RUNTIME_MATRICES.md',
        'docs/ai/framework/design-principles/extensible-runtime-guarantees.md',
        'docs/ai/apps/asyra-design/rules/feature-authoring.md'
      ],
      specRefs: [
        '#supported-behavior',
        '#public-input-contracts',
        '#ownership-and-forbidden-boundaries',
        '#failure-cleanup-and-bypass-contract'
      ],
      failureOwnerStepId: 'cleanup-feature-invocation'
    },
    {
      id: 'collect-app-context',
      order: 3,
      laneId: 'planning',
      title: 'Collect app-owned planning context',
      ownerPackage: 'app context provider',
      purpose:
        'Summarize only the current app state and constraints intentionally disclosed for this request without transferring domain ownership to the runtime.',
      inputs: [
        'artifact:feature-invocation',
        'app-owned context provider',
        'Feature-owned AbortSignal'
      ],
      outputs: ['artifact:app-context', 'artifact:context-failure'],
      conditions: [
        'Context collection receives the intent and Feature signal.',
        'The provider returns a detached app-owned context value and checks abort after awaited work.',
        'Cleanup owner: cleanup-feature-invocation releases invocation listeners; the app context provider owns any resource it created.'
      ],
      bypasses: [
        'Abort or context failure produces artifact:context-failure and no provider request.',
        'No full canonical document or secret is included unless the app contract explicitly elects to disclose it.'
      ],
      allowedContributors: [
        'artifact:feature-invocation',
        'app common/public query APIs',
        'app-owned disclosure policy'
      ],
      forbiddenContributors: [
        'Render or engine objects as state authority',
        'package-private state access',
        'runtime inference of app domain context',
        'secret values not explicitly safe for provider disclosure'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/ai/context.ts',
        'apps/asyra-design/src/ai/__tests__/context.test.ts',
        'apps/asyra-design/src/common-apis'
      ],
      specRefs: [
        '#supported-behavior',
        '#public-input-contracts',
        '#ownership-and-forbidden-boundaries'
      ],
      failureOwnerStepId: 'cleanup-feature-invocation'
    },
    {
      id: 'describe-action-registry',
      order: 4,
      laneId: 'planning',
      title: 'Describe registered schema-backed actions',
      ownerPackage: '@asyra/ai-agent-runtime action registry',
      purpose:
        'Expose deterministic detached action descriptions while preserving app ownership of names, schemas, permission meaning, and executors.',
      inputs: ['artifact:app-context', 'instance-local app action definitions'],
      outputs: ['artifact:action-catalog', 'artifact:registry-failure'],
      conditions: [
        'Registration rejects empty or duplicate names before changing the registry.',
        'Listing is deterministic by successful registration order and returns detached provider-safe descriptions without executor functions.',
        'Schemas and executors remain instance-local and are resolved again only during complete plan validation and accepted execution.',
        'Cleanup owner: compose-ai-runtime owns registry disposal; cleanup-feature-invocation owns request-local catalog data.'
      ],
      bypasses: [
        'An empty registry fails before provider transport.',
        'A duplicate definition never replaces the prior registered action.'
      ],
      allowedContributors: [
        'app-owned action definition',
        'library-agnostic AiActionSchema',
        'instance-local runtime registry'
      ],
      forbiddenContributors: [
        'model-created action definitions',
        'arbitrary code or dynamic import targets',
        'package-private or Render executor paths',
        'cross-instance registry sharing'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src/action-registry.ts',
        'packages/ai-agent-runtime/src/types.ts',
        'apps/asyra-design/src/ai/actions.ts'
      ],
      specRefs: [
        '#supported-behavior',
        '#public-input-contracts',
        '#ownership-and-forbidden-boundaries',
        '#product-cases'
      ],
      failureOwnerStepId: 'cleanup-feature-invocation'
    },
    {
      id: 'request-provider-plan',
      order: 5,
      laneId: 'planning',
      title: 'Request one candidate plan from a replaceable provider',
      ownerPackage: 'replaceable AiProvider adapter',
      purpose:
        'Transport detached intent, context, and action descriptions and return untrusted output without mutating app or framework state.',
      inputs: [
        'artifact:feature-invocation',
        'artifact:app-context',
        'artifact:action-catalog',
        'artifact:retry-request',
        'Feature-owned AbortSignal'
      ],
      outputs: [
        'artifact:provider-output',
        'artifact:provider-failure',
        'artifact:provider-abort'
      ],
      conditions: [
        'The first production adapter is GenericHttpAiProvider using platform or injected fetch and an app-selected endpoint.',
        'The provider receives only detached provider-safe input and the current Feature signal.',
        'Each retry is a new provider-stage attempt; action execution is never retried.',
        'Cleanup owner: cleanup-feature-invocation aborts the current attempt and clears its timeout/listener resources; provider-owned transport cleanup remains provider-owned.'
      ],
      bypasses: [
        'Pre-abort or runtime disposal emits artifact:provider-abort without a new request.',
        'Deterministic fake providers replace this adapter in tests without changing downstream contracts.'
      ],
      allowedContributors: [
        'artifact:feature-invocation',
        'artifact:app-context',
        'artifact:action-catalog',
        'artifact:retry-request',
        'replaceable provider transport'
      ],
      forbiddenContributors: [
        'canonical mutation or app executor calls',
        'browser-held server API key reads',
        'provider-specific types in runtime public contracts',
        'unbounded retries'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src/provider.ts',
        'packages/ai-agent-runtime/src/providers/generic-http.ts'
      ],
      specRefs: [
        '#provider-adapter-decision',
        '#public-input-contracts',
        '#failure-cleanup-and-bypass-contract'
      ],
      failureOwnerStepId: 'normalize-provider-result'
    },
    {
      id: 'normalize-provider-result',
      order: 6,
      laneId: 'planning',
      title: 'Normalize untrusted provider output and retry decisions',
      ownerPackage: '@asyra/ai-agent-runtime',
      purpose:
        'Convert untrusted output into one candidate plan or a stable redacted planning failure while bounding provider-only retry.',
      inputs: [
        'artifact:provider-output',
        'artifact:provider-failure',
        'runtime retry policy',
        'runtime redaction policy'
      ],
      outputs: [
        'artifact:candidate-plan',
        'artifact:retry-request',
        'artifact:planning-failure'
      ],
      conditions: [
        'Provider output must be a detached object with one plan id, optional explanation, and an ordered action array.',
        'Malformed JSON/result and transport failures are untrusted and never become canonical or audit output without redaction.',
        'Retry is finite, opt-in, provider-stage-only, and receives attempt/failure metadata without secret values.',
        'Cleanup owner: cleanup-feature-invocation owns attempt counters and request-local normalized values.'
      ],
      bypasses: [
        'A non-retryable or exhausted failure emits artifact:planning-failure.',
        'Abort never becomes a retry request.'
      ],
      allowedContributors: [
        'artifact:provider-output',
        'artifact:provider-failure',
        'bounded app-configured retry policy',
        'runtime redaction utility'
      ],
      forbiddenContributors: [
        'schema-validity assumptions',
        'permission or confirmation decisions',
        'executor calls',
        'raw headers, credentials, or provider body in errors'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src/runtime.ts',
        'packages/ai-agent-runtime/src/plan.ts',
        'packages/ai-agent-runtime/src/redaction.ts'
      ],
      specRefs: [
        '#public-output-contracts',
        '#provider-adapter-decision',
        '#failure-cleanup-and-bypass-contract',
        '#product-cases'
      ],
      failureOwnerStepId: 'normalize-provider-result'
    },
    {
      id: 'validate-complete-plan',
      order: 7,
      laneId: 'preflight',
      title: 'Validate the complete candidate plan',
      ownerPackage: '@asyra/ai-agent-runtime',
      purpose:
        'Resolve every action against the instance registry and parse every argument schema before permission, confirmation, transaction, or mutation.',
      inputs: [
        'artifact:candidate-plan',
        'instance-local action definitions and schemas'
      ],
      outputs: ['artifact:prepared-plan', 'artifact:validation-failure'],
      conditions: [
        'Every action name must resolve to exactly one registered definition.',
        'Every argument value must produce a successful typed AiActionSchema result.',
        'The complete ordered plan validates before the first permission side effect or mutation.',
        'Prepared actions retain only registered executor references and detached typed arguments.',
        'Cleanup owner: cleanup-feature-invocation owns prepared request-local values.'
      ],
      bypasses: [
        'Unknown action, duplicate planned action id, empty plan, invalid schema, or malformed plan emits artifact:validation-failure.',
        'No valid prefix is exposed to transaction execution when any later action fails.'
      ],
      allowedContributors: [
        'artifact:candidate-plan',
        'instance-local action registry',
        'app-owned AiActionSchema results'
      ],
      forbiddenContributors: [
        'partial plan execution',
        'model-selected executor or code',
        'permission or confirmation as schema substitutes',
        'runtime repair of app arguments'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src/plan.ts',
        'packages/ai-agent-runtime/src/action-registry.ts',
        'packages/ai-agent-runtime/src/types.ts'
      ],
      specRefs: [
        '#supported-behavior',
        '#public-input-contracts',
        '#failure-cleanup-and-bypass-contract',
        '#product-cases'
      ],
      failureOwnerStepId: 'validate-complete-plan'
    },
    {
      id: 'evaluate-app-permissions',
      order: 8,
      laneId: 'preflight',
      title: 'Evaluate app-owned permission policy',
      ownerPackage: 'app permission policy',
      purpose:
        'Decide allow, deny, or confirmation requirement for every prepared action without moving product authorization into the reusable runtime.',
      inputs: [
        'artifact:prepared-plan',
        'app-owned permission policy',
        'artifact:app-context'
      ],
      outputs: ['artifact:permission-ready-plan', 'artifact:permission-denial'],
      conditions: [
        'Every prepared action receives one explicit permission decision before transaction execution.',
        'Any deny decision rejects the complete plan.',
        'Any confirm decision marks the complete plan for one preview/confirmation handoff.',
        'Cleanup owner: cleanup-feature-invocation owns request-local decisions; the app owns external authorization resources.'
      ],
      bypasses: [
        'A complete allow decision may bypass visible confirmation only when app policy explicitly permits it.',
        'Permission denial emits artifact:permission-denial with no executor call.'
      ],
      allowedContributors: [
        'artifact:prepared-plan',
        'artifact:app-context',
        'app/backend authorization context'
      ],
      forbiddenContributors: [
        '@asyra/ai-agent-runtime app-domain permission rules',
        'provider or model permission decisions',
        'partial action filtering followed by prefix execution',
        'Render/UI state as authorization authority'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src/runtime.ts',
        'apps/asyra-design/src/ai/permission.ts'
      ],
      specRefs: [
        '#supported-behavior',
        '#public-input-contracts',
        '#ownership-and-forbidden-boundaries',
        '#product-cases'
      ],
      failureOwnerStepId: 'evaluate-app-permissions'
    },
    {
      id: 'preview-confirm-plan',
      order: 9,
      laneId: 'preflight',
      title: 'Preview and explicitly confirm when required',
      ownerPackage: 'app confirmation UI adapter',
      purpose:
        'Present one immutable complete redacted preview and return accepted or cancelled before transaction execution.',
      inputs: [
        'artifact:permission-ready-plan',
        'app-owned confirmation handler',
        'Feature-owned AbortSignal'
      ],
      outputs: ['artifact:confirmed-plan', 'artifact:confirmation-cancelled'],
      conditions: [
        'A confirmation-required plan invokes the app handler exactly once with the complete preview.',
        'An allow-only plan produces artifact:confirmed-plan through the explicit no-visible-confirmation bypass.',
        'The handler result is accepted or cancelled; it cannot replace action names or typed arguments.',
        'Cleanup owner: cleanup-feature-invocation closes request-owned confirmation work; the app UI owns its mounted view cleanup.'
      ],
      bypasses: [
        'Allow-only app policy bypasses visible UI and preserves the same confirmed-plan artifact contract.',
        'Cancellation or abort produces artifact:confirmation-cancelled and no transaction.'
      ],
      allowedContributors: [
        'artifact:permission-ready-plan',
        'app confirmation UI/handler',
        'runtime redaction utility'
      ],
      forbiddenContributors: [
        'provider-owned confirmation',
        'confirmation after the first mutation',
        'preview mutation of prepared arguments',
        'implicit destructive-action approval'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src/runtime.ts',
        'apps/asyra-design/src/ai/confirmation.ts'
      ],
      specRefs: [
        '#supported-behavior',
        '#public-output-contracts',
        '#failure-cleanup-and-bypass-contract',
        '#product-cases'
      ],
      failureOwnerStepId: 'preview-confirm-plan'
    },
    {
      id: 'run-plan-transaction',
      order: 10,
      laneId: 'execution',
      title: 'Open one app-owned transaction for the accepted plan',
      ownerPackage: 'app AiTransactionRunner adapter',
      purpose:
        'Map one confirmed plan to one intended undo transaction and delegate rollback/commit semantics to the app Factory boundary.',
      inputs: [
        'artifact:confirmed-plan',
        'app-owned transaction runner',
        'Feature-owned AbortSignal'
      ],
      outputs: ['artifact:transaction-execution-scope'],
      conditions: [
        'The runner is invoked exactly once for one accepted plan by default.',
        'The runner executes the complete ordered action callback and commits only after it resolves.',
        'Throw, rejection, timeout, or abort after transaction start must roll back all rollbackable writes through the existing Factory contract.',
        'Cleanup owner: settle-plan-transaction closes transaction state; cleanup-feature-invocation releases request listeners after settlement.'
      ],
      bypasses: [
        'No transaction opens for planning, validation, permission, or confirmation terminal results.',
        'Explicit transaction groups are unsupported in this bounded first release.'
      ],
      allowedContributors: [
        'artifact:confirmed-plan',
        'app transaction adapter',
        'public runTransaction-compatible boundary'
      ],
      forbiddenContributors: [
        'runtime-owned undo/history implementation',
        'one transaction per action',
        'mutation before the runner callback',
        'retry of an action transaction'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src/runtime.ts',
        'apps/asyra-design/src/ai/transaction.ts',
        'apps/asyra-design/src/common-apis/transaction.ts'
      ],
      specRefs: [
        '#supported-behavior',
        '#ownership-and-forbidden-boundaries',
        '#failure-cleanup-and-bypass-contract',
        '#product-cases'
      ],
      failureOwnerStepId: 'settle-plan-transaction'
    },
    {
      id: 'execute-app-actions',
      order: 11,
      laneId: 'execution',
      title: 'Execute registered app-owned actions in order',
      ownerPackage: 'app action executors',
      purpose:
        'Invoke only the registered executors with validated typed arguments and app execution context inside the accepted transaction.',
      inputs: [
        'artifact:transaction-execution-scope',
        'artifact:canonical-mutation-evidence',
        'registered app executors',
        'Feature-owned AbortSignal'
      ],
      outputs: [
        'artifact:state-mutation-request',
        'artifact:action-result-batch',
        'artifact:executor-failure'
      ],
      conditions: [
        'Actions execute in prepared plan order and check abort after awaited work before the next mutation.',
        'Each executor receives only its validated typed arguments and app execution context.',
        'Action results are detached summaries and never canonical state authority.',
        'Cleanup owner: settle-plan-transaction owns rollback/commit; cleanup-feature-invocation owns request-local executor result storage.'
      ],
      bypasses: [
        'A thrown/rejected executor stops later actions and produces artifact:executor-failure for transaction rollback.',
        'An aborted signal stops before the next executor or mutation request.'
      ],
      allowedContributors: [
        'artifact:transaction-execution-scope',
        'registered app action executor',
        'app common/public APIs'
      ],
      forbiddenContributors: [
        'unregistered action or model-provided function',
        'direct Render/Pixi/Three mutation',
        'package-private API or app-private store mutation',
        'execution outside the transaction runner'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src/runtime.ts',
        'apps/asyra-design/src/ai/actions.ts',
        'apps/asyra-design/src/common-apis'
      ],
      specRefs: [
        '#supported-behavior',
        '#ownership-and-forbidden-boundaries',
        '#failure-cleanup-and-bypass-contract',
        '#product-cases'
      ],
      failureOwnerStepId: 'settle-plan-transaction'
    },
    {
      id: 'mutate-canonical-state',
      order: 12,
      laneId: 'execution',
      title: 'Apply ordinary canonical state mutations',
      ownerPackage: 'app-selected canonical state owners',
      purpose:
        'Validate and apply app common/public API requests through the same Scene Tree, Props Manager, System Context, or Selection owners as ordinary user actions.',
      inputs: ['artifact:state-mutation-request'],
      outputs: [
        'artifact:canonical-mutation-evidence',
        'artifact:canonical-mutation-failure'
      ],
      conditions: [
        'Each state owner enforces its existing runtime validation and mutation invariants.',
        'Mutation options are app-owned and may select the ordinary shared publication path when Collaboration is already enabled.',
        'No model plan or audit value becomes canonical state.',
        'Cleanup owner: settle-plan-transaction rolls back recorded mutations; each state owner owns its ordinary resource invariants.'
      ],
      bypasses: [
        'A semantic no-op remains a no-op under the existing state-owner contract.',
        'A validation failure throws before an invalid write and returns to executor/transaction failure handling.'
      ],
      allowedContributors: [
        'artifact:state-mutation-request',
        'app common/public API',
        'canonical package validators and mutators'
      ],
      forbiddenContributors: [
        'runtime direct state mutation',
        'Render or UI state as authority',
        'provider-side mutation',
        'diagnostic repair or fallback state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/common-apis',
        'packages/scene-tree/src',
        'packages/props-manager/src',
        'packages/system-context/src',
        'packages/selection/src'
      ],
      specRefs: [
        '#supported-behavior',
        '#ownership-and-forbidden-boundaries',
        '#failure-cleanup-and-bypass-contract'
      ],
      failureOwnerStepId: 'settle-plan-transaction'
    },
    {
      id: 'settle-plan-transaction',
      order: 13,
      laneId: 'execution',
      title: 'Settle one transaction, undo commit, and publication batch',
      ownerPackage: '@asyra/factory through app transaction adapter',
      purpose:
        'Commit one accepted plan as one intended undo entry or roll back its complete rollbackable journal with no accepted canonical prefix.',
      inputs: [
        'artifact:action-result-batch',
        'artifact:executor-failure',
        'artifact:canonical-mutation-failure',
        'active Factory transaction journal'
      ],
      outputs: [
        'artifact:transaction-outcome',
        'artifact:transaction-failure',
        'artifact:canonical-change',
        'artifact:shared-publication',
        'artifact:no-collaboration-bypass'
      ],
      conditions: [
        'Successful completion validates and commits the existing Factory transaction exactly once.',
        'Failure, abort, or timeout rolls back the complete rollbackable journal and creates no normal undo entry.',
        'A successful accepted plan creates one intended undo commit by default.',
        'Shared changes settle through the same Factory publication path and options as ordinary app actions.',
        'Cleanup owner: settle-plan-transaction closes Factory transaction state; cleanup-feature-invocation performs only request-local cleanup afterward.'
      ],
      bypasses: [
        'No canonical mutation produces a valid no-change transaction outcome without fabricated history.',
        'When the app is non-collaborative or actions are not shared, artifact:no-collaboration-bypass is terminal and no Collaboration instance is created.'
      ],
      allowedContributors: [
        'app transaction adapter',
        'Factory journal, validation, rollback, history, and shared settlement',
        'artifact:action-result-batch',
        'artifact:executor-failure',
        'artifact:canonical-mutation-failure'
      ],
      forbiddenContributors: [
        'runtime-owned transaction journal or history',
        'partial commit after executor failure',
        'Collaboration-owned rollback or undo',
        'provider retry after transaction start'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/ai/transaction.ts',
        'apps/asyra-design/src/common-apis/transaction.ts',
        'packages/factory/src'
      ],
      specRefs: [
        '#supported-behavior',
        '#ownership-and-forbidden-boundaries',
        '#failure-cleanup-and-bypass-contract',
        '#product-cases'
      ],
      failureOwnerStepId: 'settle-plan-transaction'
    },
    {
      id: 'project-derived-output',
      order: 14,
      laneId: 'projection',
      title: 'Derive ordinary Render and UI output',
      ownerPackage: '@asyra/render and app UI observers',
      purpose:
        'Project committed canonical state through unchanged Render/UI derivation without consuming model plans, audits, or diagnostics as product input.',
      inputs: ['artifact:canonical-change'],
      outputs: ['artifact:derived-output'],
      conditions: [
        'Render/UI consume the same canonical state-owner change route as ordinary user actions.',
        'No AI-specific renderer, patch geometry, or fallback state is introduced.',
        'Cleanup owner: ordinary Render/UI owners retain their existing lifecycle; AI cleanup owns no Render resource.'
      ],
      bypasses: [
        'Headless actions may complete without a Render instance.',
        'A rolled-back or rejected plan produces no committed canonical change to project.'
      ],
      allowedContributors: [
        'artifact:canonical-change',
        'existing Render and UI-context projection contracts'
      ],
      forbiddenContributors: [
        'provider output',
        'candidate or prepared plan',
        'audit/explanation values',
        'AI-specific patch Render object'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src',
        'apps/asyra-design/src/providers'
      ],
      specRefs: [
        '#supported-behavior',
        '#ownership-and-forbidden-boundaries',
        '#product-cases'
      ],
      failureOwnerStepId: 'project-derived-output'
    },
    {
      id: 'transport-optional-publication',
      order: 15,
      laneId: 'projection',
      title: 'Transport optional canonical shared publication',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Carry an existing Factory publication through the unchanged transport-only route when the app already opted into Collaboration.',
      inputs: ['artifact:shared-publication'],
      outputs: ['artifact:collaboration-outcome'],
      conditions: [
        'One Factory publication remains one Collaboration/provider handoff under the Gate 2 contract.',
        'AI origin does not add dedupe, permission, conflict, ordering, persistence, or recovery policy.',
        'Receiving apps use their ordinary app-owned remote validation and canonical transaction path.',
        'Cleanup owner: the app-owned Collaboration lifecycle remains unchanged; AI cleanup owns no Provider or Awareness resource.'
      ],
      bypasses: [
        'artifact:no-collaboration-bypass terminates without constructing Collaboration or a Provider.',
        'A non-shared action commits locally without a network route.'
      ],
      allowedContributors: [
        'artifact:shared-publication',
        'existing app-owned Collaboration composition',
        'Gate 2 Provider contract'
      ],
      forbiddenContributors: [
        'AI runtime network transport for canonical state',
        'model output publication',
        'Collaboration permission or domain policy',
        'AI-owned reconnect or history'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src',
        'apps/asyra-design/src/collaboration'
      ],
      specRefs: [
        '#supported-behavior',
        '#ownership-and-forbidden-boundaries',
        '#product-cases'
      ],
      failureOwnerStepId: 'transport-optional-publication'
    },
    {
      id: 'produce-redacted-audit',
      order: 16,
      laneId: 'observability',
      title: 'Produce detached redacted audit and explanation output',
      ownerPackage: '@asyra/ai-agent-runtime',
      purpose:
        'Return stable preview/execution/failure evidence without exposing credentials, raw provider bodies, or canonical state authority.',
      inputs: [
        'artifact:transaction-outcome',
        'artifact:transaction-failure',
        'candidate/prepared plan explanation',
        'runtime redaction policy'
      ],
      outputs: ['artifact:audit-result'],
      conditions: [
        'Audit output includes plan id, ordered action summaries, outcome stage, retry count, and redacted explanation as applicable.',
        'Configured secret keys and built-in authorization/token/key patterns are redacted recursively.',
        'Returned values are detached and cannot alter plan, executor, transaction, or canonical state.',
        'Cleanup owner: cleanup-feature-invocation owns request-local audit buffers after the result is detached.'
      ],
      bypasses: [
        'A no-mutation terminal result still receives a stable redacted reason through cleanup.',
        'Apps may omit persistence of audit output; the runtime owns no audit database.'
      ],
      allowedContributors: [
        'artifact:transaction-outcome',
        'artifact:transaction-failure',
        'runtime-owned redaction utility',
        'detached executor summaries'
      ],
      forbiddenContributors: [
        'authorization headers or raw credentials',
        'raw provider response bodies',
        'audit output used as product mutation input',
        'app-private state dumps by default'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src/audit.ts',
        'packages/ai-agent-runtime/src/redaction.ts',
        'packages/ai-agent-runtime/src/runtime.ts'
      ],
      specRefs: [
        '#public-output-contracts',
        '#provider-adapter-decision',
        '#failure-cleanup-and-bypass-contract',
        '#product-cases'
      ],
      failureOwnerStepId: 'produce-redacted-audit'
    },
    {
      id: 'cleanup-feature-invocation',
      order: 17,
      laneId: 'observability',
      title: 'Complete failure, abort, timeout, and invocation cleanup',
      ownerPackage:
        'app Feature lifecycle plus @asyra/ai-agent-runtime invocation',
      purpose:
        'Return one stable terminal result, release request-owned timers/listeners/attempt state, and leave Feature System as the sole lifecycle owner.',
      inputs: [
        'artifact:context-failure',
        'artifact:registry-failure',
        'artifact:provider-abort',
        'artifact:planning-failure',
        'artifact:validation-failure',
        'artifact:permission-denial',
        'artifact:confirmation-cancelled',
        'artifact:audit-result',
        'artifact:provider-disabled-bypass'
      ],
      outputs: ['artifact:lifecycle-result'],
      conditions: [
        'Exactly one terminal executed, cancelled, unavailable, or failed result returns to the app Feature.',
        'Request-owned AbortSignal listeners, provider timeout timers, retry state, and detached intermediate values are released.',
        'Dispose prevents new work and aborts or awaits already-started work according to the runtime ownership contract.',
        'The app Feature owns execute/session completion and any Feature resource cleanup.',
        'Cleanup owner: cleanup-feature-invocation for request resources; compose-ai-runtime for instance disposal; external app/provider resources remain with their declared owners.'
      ],
      bypasses: [
        'AI-disabled composition terminates before this invocation step because no Feature/runtime exists.',
        'A provider-disabled Feature produces one unavailable lifecycle result without context/provider work.'
      ],
      allowedContributors: [
        'Feature-owned AbortSignal',
        'runtime invocation cleanup',
        'stable redacted terminal artifacts'
      ],
      forbiddenContributors: [
        'new transaction or executor call',
        'late post-abort mutation',
        'second Feature/session queue',
        'cleanup that disposes borrowed app/provider resources'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src/runtime.ts',
        'apps/asyra-design/src/features/ai-agent/index.ts',
        'apps/asyra-design/src/ai/composition.ts'
      ],
      specRefs: [
        '#public-output-contracts',
        '#failure-cleanup-and-bypass-contract',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'cleanup-feature-invocation'
    }
  ]

  const routes = [
    {
      id: 'compose-enabled-runtime',
      from: 'compose-ai-runtime',
      to: 'route-natural-language-intent',
      kind: 'composition',
      predicate:
        'The app explicitly enables AI and supplies a provider-enabled composition.',
      producedArtifacts: ['artifact:runtime-composition']
    },
    {
      id: 'bypass-ai-disabled',
      from: 'compose-ai-runtime',
      kind: 'terminal',
      predicate:
        'The app omits AI activation and creates no AI resource or startup side effect.',
      producedArtifacts: ['artifact:ai-disabled-bypass']
    },
    {
      id: 'invoke-context',
      from: 'route-natural-language-intent',
      to: 'collect-app-context',
      kind: 'intent',
      predicate:
        'The app Feature accepts non-empty intent with a live lifecycle signal.',
      producedArtifacts: ['artifact:feature-invocation']
    },
    {
      id: 'bypass-provider-disabled',
      from: 'route-natural-language-intent',
      to: 'cleanup-feature-invocation',
      kind: 'bypass',
      predicate:
        'AI is enabled but the app provider composition is disabled or unavailable.',
      producedArtifacts: ['artifact:provider-disabled-bypass']
    },
    {
      id: 'handoff-app-context',
      from: 'collect-app-context',
      to: 'describe-action-registry',
      kind: 'planning',
      predicate: 'Context collection completes before abort.',
      producedArtifacts: ['artifact:app-context']
    },
    {
      id: 'fail-context',
      from: 'collect-app-context',
      to: 'cleanup-feature-invocation',
      kind: 'failure',
      predicate: 'Context collection throws, rejects, or observes abort.',
      producedArtifacts: ['artifact:context-failure']
    },
    {
      id: 'handoff-action-catalog',
      from: 'describe-action-registry',
      to: 'request-provider-plan',
      kind: 'planning',
      predicate:
        'The instance registry contains at least one valid action definition.',
      producedArtifacts: ['artifact:action-catalog']
    },
    {
      id: 'fail-action-catalog',
      from: 'describe-action-registry',
      to: 'cleanup-feature-invocation',
      kind: 'failure',
      predicate: 'The registry is invalid or empty for this invocation.',
      producedArtifacts: ['artifact:registry-failure']
    },
    {
      id: 'handoff-feature-to-provider',
      from: 'route-natural-language-intent',
      to: 'request-provider-plan',
      kind: 'lifecycle',
      predicate:
        'The provider attempt consumes the same Feature intent and AbortSignal.',
      producedArtifacts: ['artifact:feature-invocation']
    },
    {
      id: 'handoff-context-to-provider',
      from: 'collect-app-context',
      to: 'request-provider-plan',
      kind: 'planning',
      predicate:
        'Provider input receives the detached app context after registry description is available.',
      producedArtifacts: ['artifact:app-context']
    },
    {
      id: 'receive-provider-output',
      from: 'request-provider-plan',
      to: 'normalize-provider-result',
      kind: 'provider-result',
      predicate: 'The provider resolves with untrusted output.',
      producedArtifacts: ['artifact:provider-output']
    },
    {
      id: 'receive-provider-failure',
      from: 'request-provider-plan',
      to: 'normalize-provider-result',
      kind: 'provider-failure',
      predicate:
        'Transport, timeout, status, parse, or provider work fails without abort.',
      producedArtifacts: ['artifact:provider-failure']
    },
    {
      id: 'abort-provider-attempt',
      from: 'request-provider-plan',
      to: 'cleanup-feature-invocation',
      kind: 'abort',
      predicate: 'The Feature signal aborts or the runtime is disposed.',
      producedArtifacts: ['artifact:provider-abort']
    },
    {
      id: 'retry-provider-attempt',
      from: 'normalize-provider-result',
      to: 'request-provider-plan',
      kind: 'retry',
      predicate:
        'The bounded provider-only retry policy accepts the next finite attempt.',
      producedArtifacts: ['artifact:retry-request']
    },
    {
      id: 'handoff-candidate-plan',
      from: 'normalize-provider-result',
      to: 'validate-complete-plan',
      kind: 'planning',
      predicate: 'Provider output has the minimum candidate plan structure.',
      producedArtifacts: ['artifact:candidate-plan']
    },
    {
      id: 'fail-planning',
      from: 'normalize-provider-result',
      to: 'cleanup-feature-invocation',
      kind: 'failure',
      predicate:
        'The result is malformed, non-retryable, or retries are exhausted.',
      producedArtifacts: ['artifact:planning-failure']
    },
    {
      id: 'handoff-prepared-plan',
      from: 'validate-complete-plan',
      to: 'evaluate-app-permissions',
      kind: 'preflight',
      predicate: 'Every action resolves and every argument schema succeeds.',
      producedArtifacts: ['artifact:prepared-plan']
    },
    {
      id: 'handoff-context-to-permission',
      from: 'collect-app-context',
      to: 'evaluate-app-permissions',
      kind: 'preflight',
      predicate:
        'The app permission policy receives the same detached request context used for planning.',
      producedArtifacts: ['artifact:app-context']
    },
    {
      id: 'fail-complete-validation',
      from: 'validate-complete-plan',
      to: 'cleanup-feature-invocation',
      kind: 'failure',
      predicate:
        'Any plan/action/schema check fails, rejecting the complete plan.',
      producedArtifacts: ['artifact:validation-failure']
    },
    {
      id: 'handoff-permission-ready-plan',
      from: 'evaluate-app-permissions',
      to: 'preview-confirm-plan',
      kind: 'preflight',
      predicate:
        'Every action is allowed and the complete confirmation requirement is known.',
      producedArtifacts: ['artifact:permission-ready-plan']
    },
    {
      id: 'deny-complete-plan',
      from: 'evaluate-app-permissions',
      to: 'cleanup-feature-invocation',
      kind: 'permission-denial',
      predicate: 'At least one action is denied, rejecting the complete plan.',
      producedArtifacts: ['artifact:permission-denial']
    },
    {
      id: 'handoff-confirmed-plan',
      from: 'preview-confirm-plan',
      to: 'run-plan-transaction',
      kind: 'confirmation',
      predicate:
        'Required confirmation is accepted or app policy explicitly allows the no-visible-confirmation bypass.',
      producedArtifacts: ['artifact:confirmed-plan']
    },
    {
      id: 'cancel-confirmation',
      from: 'preview-confirm-plan',
      to: 'cleanup-feature-invocation',
      kind: 'confirmation-cancel',
      predicate:
        'The user cancels confirmation or the Feature signal aborts before acceptance.',
      producedArtifacts: ['artifact:confirmation-cancelled']
    },
    {
      id: 'open-transaction-execution',
      from: 'run-plan-transaction',
      to: 'execute-app-actions',
      kind: 'transaction',
      predicate:
        'The accepted complete plan enters one app transaction runner callback.',
      producedArtifacts: ['artifact:transaction-execution-scope']
    },
    {
      id: 'request-canonical-mutation',
      from: 'execute-app-actions',
      to: 'mutate-canonical-state',
      kind: 'mutation',
      predicate:
        'A registered executor invokes an app common/public mutation API.',
      producedArtifacts: ['artifact:state-mutation-request']
    },
    {
      id: 'return-canonical-evidence',
      from: 'mutate-canonical-state',
      to: 'execute-app-actions',
      kind: 'mutation-result',
      predicate:
        'The canonical owner applies a valid request or reports a semantic no-op.',
      producedArtifacts: ['artifact:canonical-mutation-evidence']
    },
    {
      id: 'return-canonical-failure',
      from: 'mutate-canonical-state',
      to: 'settle-plan-transaction',
      kind: 'failure',
      predicate:
        'Canonical validation or mutation throws after transaction start.',
      producedArtifacts: ['artifact:canonical-mutation-failure']
    },
    {
      id: 'complete-action-batch',
      from: 'execute-app-actions',
      to: 'settle-plan-transaction',
      kind: 'execution-result',
      predicate: 'All registered action executors complete in order.',
      producedArtifacts: ['artifact:action-result-batch']
    },
    {
      id: 'fail-action-batch',
      from: 'execute-app-actions',
      to: 'settle-plan-transaction',
      kind: 'failure',
      predicate: 'An executor throws, rejects, times out, or observes abort.',
      producedArtifacts: ['artifact:executor-failure']
    },
    {
      id: 'audit-committed-transaction',
      from: 'settle-plan-transaction',
      to: 'produce-redacted-audit',
      kind: 'transaction-result',
      predicate: 'The complete accepted plan transaction commits.',
      producedArtifacts: ['artifact:transaction-outcome']
    },
    {
      id: 'audit-failed-transaction',
      from: 'settle-plan-transaction',
      to: 'produce-redacted-audit',
      kind: 'transaction-failure',
      predicate: 'The transaction rolls back or reports rollback failure.',
      producedArtifacts: ['artifact:transaction-failure']
    },
    {
      id: 'project-canonical-change',
      from: 'settle-plan-transaction',
      to: 'project-derived-output',
      kind: 'projection',
      predicate:
        'A committed canonical change reaches ordinary Render/UI observers.',
      producedArtifacts: ['artifact:canonical-change']
    },
    {
      id: 'publish-shared-change',
      from: 'settle-plan-transaction',
      to: 'transport-optional-publication',
      kind: 'optional-collaboration',
      predicate:
        'The app already enabled Collaboration and the action used its ordinary shared mutation path.',
      producedArtifacts: ['artifact:shared-publication']
    },
    {
      id: 'bypass-non-collaborative',
      from: 'settle-plan-transaction',
      kind: 'terminal',
      predicate: 'The app is non-collaborative or the action is not shared.',
      producedArtifacts: ['artifact:no-collaboration-bypass']
    },
    {
      id: 'finish-derived-output',
      from: 'project-derived-output',
      kind: 'terminal',
      predicate: 'Ordinary Render/UI derivation completes or remains headless.',
      producedArtifacts: ['artifact:derived-output']
    },
    {
      id: 'finish-collaboration-handoff',
      from: 'transport-optional-publication',
      kind: 'terminal',
      predicate:
        'The unchanged Gate 2 transport reports its independent outcome.',
      producedArtifacts: ['artifact:collaboration-outcome']
    },
    {
      id: 'handoff-audit-result',
      from: 'produce-redacted-audit',
      to: 'cleanup-feature-invocation',
      kind: 'observability',
      predicate:
        'Detached redacted execution or transaction failure evidence is ready.',
      producedArtifacts: ['artifact:audit-result']
    },
    {
      id: 'finish-feature-invocation',
      from: 'cleanup-feature-invocation',
      kind: 'terminal',
      predicate:
        'One stable terminal result returns after request-owned cleanup.',
      producedArtifacts: ['artifact:lifecycle-result']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:runtime-composition',
      title: 'Isolated runtime composition',
      ownerStepId: 'compose-ai-runtime',
      channel: 'app composition',
      consumerStepIds: ['route-natural-language-intent'],
      terminal: false
    },
    {
      id: 'artifact:ai-disabled-bypass',
      title: 'AI-disabled zero-side-effect bypass',
      ownerStepId: 'compose-ai-runtime',
      channel: 'terminal bypass',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:feature-invocation',
      title: 'Feature-owned intent and lifecycle signal',
      ownerStepId: 'route-natural-language-intent',
      channel: 'Feature invocation',
      consumerStepIds: ['collect-app-context', 'request-provider-plan'],
      terminal: false
    },
    {
      id: 'artifact:provider-disabled-bypass',
      title: 'Provider-disabled unavailable result',
      ownerStepId: 'route-natural-language-intent',
      channel: 'terminal bypass',
      consumerStepIds: ['cleanup-feature-invocation'],
      terminal: false
    },
    {
      id: 'artifact:app-context',
      title: 'Detached app-owned planning context',
      ownerStepId: 'collect-app-context',
      channel: 'app context handoff',
      consumerStepIds: [
        'describe-action-registry',
        'request-provider-plan',
        'evaluate-app-permissions'
      ],
      terminal: false
    },
    {
      id: 'artifact:context-failure',
      title: 'Context collection failure',
      ownerStepId: 'collect-app-context',
      channel: 'failure',
      consumerStepIds: ['cleanup-feature-invocation'],
      terminal: false
    },
    {
      id: 'artifact:action-catalog',
      title: 'Deterministic provider-safe action catalog',
      ownerStepId: 'describe-action-registry',
      channel: 'runtime registry handoff',
      consumerStepIds: ['request-provider-plan'],
      terminal: false
    },
    {
      id: 'artifact:registry-failure',
      title: 'Registry readiness failure',
      ownerStepId: 'describe-action-registry',
      channel: 'failure',
      consumerStepIds: ['cleanup-feature-invocation'],
      terminal: false
    },
    {
      id: 'artifact:provider-output',
      title: 'Untrusted provider output',
      ownerStepId: 'request-provider-plan',
      channel: 'replaceable provider result',
      consumerStepIds: ['normalize-provider-result'],
      terminal: false
    },
    {
      id: 'artifact:provider-failure',
      title: 'Untrusted provider failure',
      ownerStepId: 'request-provider-plan',
      channel: 'replaceable provider failure',
      consumerStepIds: ['normalize-provider-result'],
      terminal: false
    },
    {
      id: 'artifact:provider-abort',
      title: 'Provider abort or disposal result',
      ownerStepId: 'request-provider-plan',
      channel: 'abort',
      consumerStepIds: ['cleanup-feature-invocation'],
      terminal: false
    },
    {
      id: 'artifact:candidate-plan',
      title: 'Detached candidate plan',
      ownerStepId: 'normalize-provider-result',
      channel: 'runtime planning',
      consumerStepIds: ['validate-complete-plan'],
      terminal: false
    },
    {
      id: 'artifact:retry-request',
      title: 'Bounded provider-only retry request',
      ownerStepId: 'normalize-provider-result',
      channel: 'retry',
      consumerStepIds: ['request-provider-plan'],
      terminal: false
    },
    {
      id: 'artifact:planning-failure',
      title: 'Stable redacted planning failure',
      ownerStepId: 'normalize-provider-result',
      channel: 'failure',
      consumerStepIds: ['cleanup-feature-invocation'],
      terminal: false
    },
    {
      id: 'artifact:prepared-plan',
      title: 'Complete schema-valid prepared plan',
      ownerStepId: 'validate-complete-plan',
      channel: 'runtime preflight',
      consumerStepIds: ['evaluate-app-permissions'],
      terminal: false
    },
    {
      id: 'artifact:validation-failure',
      title: 'Complete-plan validation failure',
      ownerStepId: 'validate-complete-plan',
      channel: 'failure',
      consumerStepIds: ['cleanup-feature-invocation'],
      terminal: false
    },
    {
      id: 'artifact:permission-ready-plan',
      title: 'Complete permission-evaluated plan',
      ownerStepId: 'evaluate-app-permissions',
      channel: 'app permission handoff',
      consumerStepIds: ['preview-confirm-plan'],
      terminal: false
    },
    {
      id: 'artifact:permission-denial',
      title: 'Complete-plan permission denial',
      ownerStepId: 'evaluate-app-permissions',
      channel: 'permission denial',
      consumerStepIds: ['cleanup-feature-invocation'],
      terminal: false
    },
    {
      id: 'artifact:confirmed-plan',
      title: 'Accepted complete plan',
      ownerStepId: 'preview-confirm-plan',
      channel: 'app confirmation handoff',
      consumerStepIds: ['run-plan-transaction'],
      terminal: false
    },
    {
      id: 'artifact:confirmation-cancelled',
      title: 'No-mutation confirmation cancellation',
      ownerStepId: 'preview-confirm-plan',
      channel: 'confirmation cancel',
      consumerStepIds: ['cleanup-feature-invocation'],
      terminal: false
    },
    {
      id: 'artifact:transaction-execution-scope',
      title: 'One accepted-plan transaction scope',
      ownerStepId: 'run-plan-transaction',
      channel: 'app transaction callback',
      consumerStepIds: ['execute-app-actions'],
      terminal: false
    },
    {
      id: 'artifact:state-mutation-request',
      title: 'App common/public API mutation request',
      ownerStepId: 'execute-app-actions',
      channel: 'app action executor',
      consumerStepIds: ['mutate-canonical-state'],
      terminal: false
    },
    {
      id: 'artifact:canonical-mutation-evidence',
      title: 'Canonical owner mutation/no-op evidence',
      ownerStepId: 'mutate-canonical-state',
      channel: 'canonical owner result',
      consumerStepIds: ['execute-app-actions'],
      terminal: false
    },
    {
      id: 'artifact:canonical-mutation-failure',
      title: 'Canonical validation or mutation failure',
      ownerStepId: 'mutate-canonical-state',
      channel: 'transaction failure',
      consumerStepIds: ['settle-plan-transaction'],
      terminal: false
    },
    {
      id: 'artifact:action-result-batch',
      title: 'Ordered detached app action results',
      ownerStepId: 'execute-app-actions',
      channel: 'executor result',
      consumerStepIds: ['settle-plan-transaction'],
      terminal: false
    },
    {
      id: 'artifact:executor-failure',
      title: 'App executor failure',
      ownerStepId: 'execute-app-actions',
      channel: 'transaction failure',
      consumerStepIds: ['settle-plan-transaction'],
      terminal: false
    },
    {
      id: 'artifact:transaction-outcome',
      title: 'Committed accepted-plan transaction outcome',
      ownerStepId: 'settle-plan-transaction',
      channel: 'Factory transaction status',
      consumerStepIds: ['produce-redacted-audit'],
      terminal: false
    },
    {
      id: 'artifact:transaction-failure',
      title: 'Rolled-back or rollback-failed transaction outcome',
      ownerStepId: 'settle-plan-transaction',
      channel: 'Factory transaction failure',
      consumerStepIds: ['produce-redacted-audit'],
      terminal: false
    },
    {
      id: 'artifact:canonical-change',
      title: 'Committed canonical state change',
      ownerStepId: 'settle-plan-transaction',
      channel: 'ordinary state projection',
      consumerStepIds: ['project-derived-output'],
      terminal: false
    },
    {
      id: 'artifact:shared-publication',
      title: 'Ordinary Factory shared publication',
      ownerStepId: 'settle-plan-transaction',
      channel: 'Factory publication boundary',
      consumerStepIds: ['transport-optional-publication'],
      terminal: false
    },
    {
      id: 'artifact:no-collaboration-bypass',
      title: 'Non-collaborative terminal bypass',
      ownerStepId: 'settle-plan-transaction',
      channel: 'terminal bypass',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:derived-output',
      title: 'Ordinary derived Render/UI output',
      ownerStepId: 'project-derived-output',
      channel: 'terminal projection',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:collaboration-outcome',
      title: 'Independent Gate 2 transport outcome',
      ownerStepId: 'transport-optional-publication',
      channel: 'terminal transport',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:audit-result',
      title: 'Detached redacted audit/explanation result',
      ownerStepId: 'produce-redacted-audit',
      channel: 'runtime result',
      consumerStepIds: ['cleanup-feature-invocation'],
      terminal: false
    },
    {
      id: 'artifact:lifecycle-result',
      title: 'Stable executed/cancelled/unavailable/failed result',
      ownerStepId: 'cleanup-feature-invocation',
      channel: 'terminal Feature result',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const invariants = [
    {
      id: 'single-feature-lifecycle-owner',
      title: 'Feature System remains the sole execute/session/cancel owner',
      statement:
        'The runtime consumes the app Feature signal and never registers a parallel command/session queue.',
      stepIds: ['route-natural-language-intent', 'cleanup-feature-invocation'],
      artifactIds: ['artifact:feature-invocation', 'artifact:lifecycle-result'],
      specRefs: ['#ownership-and-forbidden-boundaries']
    },
    {
      id: 'complete-preflight-before-mutation',
      title: 'The complete plan preflights before mutation',
      statement:
        'Normalization, registry/schema validation, permission, and required confirmation finish for every action before the transaction opens.',
      stepIds: [
        'normalize-provider-result',
        'validate-complete-plan',
        'evaluate-app-permissions',
        'preview-confirm-plan',
        'run-plan-transaction'
      ],
      artifactIds: [
        'artifact:candidate-plan',
        'artifact:prepared-plan',
        'artifact:permission-ready-plan',
        'artifact:confirmed-plan'
      ],
      specRefs: ['#supported-behavior', '#failure-cleanup-and-bypass-contract']
    },
    {
      id: 'registered-actions-only',
      title: 'Only registered schema-valid app actions execute',
      statement:
        'Model output selects no code path; every executor comes from the isolated app registry after schema validation.',
      stepIds: [
        'describe-action-registry',
        'validate-complete-plan',
        'execute-app-actions'
      ],
      artifactIds: [
        'artifact:action-catalog',
        'artifact:prepared-plan',
        'artifact:transaction-execution-scope'
      ],
      specRefs: ['#ownership-and-forbidden-boundaries']
    },
    {
      id: 'one-plan-one-undo',
      title: 'One accepted plan maps to one intended undo commit',
      statement:
        'One transaction runner callback contains the ordered executors and Factory commits or rolls back that complete journal.',
      stepIds: [
        'run-plan-transaction',
        'execute-app-actions',
        'settle-plan-transaction'
      ],
      artifactIds: [
        'artifact:transaction-execution-scope',
        'artifact:transaction-outcome',
        'artifact:transaction-failure'
      ],
      specRefs: ['#supported-behavior', '#product-cases']
    },
    {
      id: 'model-output-never-canonical',
      title: 'Model output is never canonical state',
      statement:
        'Only app common/public APIs and canonical state owners may mutate product state; plans and audits remain detached inputs/observations.',
      stepIds: [
        'validate-complete-plan',
        'execute-app-actions',
        'mutate-canonical-state',
        'project-derived-output',
        'produce-redacted-audit'
      ],
      artifactIds: [
        'artifact:prepared-plan',
        'artifact:state-mutation-request',
        'artifact:canonical-change',
        'artifact:audit-result'
      ],
      specRefs: ['#ownership-and-forbidden-boundaries']
    },
    {
      id: 'provider-replaceable-and-secret-safe',
      title: 'Provider transport is replaceable and secret-safe',
      statement:
        'Generic HTTP and deterministic fake providers share one untrusted-output boundary; browser runtime reads no server model key.',
      stepIds: [
        'compose-ai-runtime',
        'request-provider-plan',
        'normalize-provider-result',
        'produce-redacted-audit'
      ],
      artifactIds: [
        'artifact:runtime-composition',
        'artifact:provider-output',
        'artifact:planning-failure',
        'artifact:audit-result'
      ],
      specRefs: ['#provider-adapter-decision']
    },
    {
      id: 'disabled-zero-side-effect',
      title: 'Disabled routes have zero AI side effects',
      statement:
        'AI-disabled composition creates no runtime resource, while provider-disabled invocation returns before context/provider work.',
      stepIds: [
        'compose-ai-runtime',
        'route-natural-language-intent',
        'cleanup-feature-invocation'
      ],
      artifactIds: [
        'artifact:ai-disabled-bypass',
        'artifact:provider-disabled-bypass',
        'artifact:lifecycle-result'
      ],
      specRefs: ['#failure-cleanup-and-bypass-contract']
    },
    {
      id: 'collaboration-route-unchanged',
      title: 'AI uses the ordinary optional collaboration route',
      statement:
        'Factory publications follow Gate 2 transport unchanged, and the runtime owns no collaboration policy or resource.',
      stepIds: ['settle-plan-transaction', 'transport-optional-publication'],
      artifactIds: [
        'artifact:shared-publication',
        'artifact:no-collaboration-bypass',
        'artifact:collaboration-outcome'
      ],
      specRefs: ['#ownership-and-forbidden-boundaries', '#product-cases']
    },
    {
      id: 'instance-isolation',
      title: 'Runtime instances remain isolated',
      statement:
        'Registry, provider, policy, attempts, abort, timeout, audit, and disposal state never cross runtime instances.',
      stepIds: [
        'compose-ai-runtime',
        'describe-action-registry',
        'request-provider-plan',
        'cleanup-feature-invocation'
      ],
      artifactIds: [
        'artifact:runtime-composition',
        'artifact:action-catalog',
        'artifact:lifecycle-result'
      ],
      specRefs: ['#supported-behavior', '#product-cases']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'disabled-bypasses',
      title: 'AI-disabled and provider-disabled bypasses',
      assertions: [
        'AI-disabled app startup creates no provider, runtime, Feature, listener, timer, network request, or secret read.',
        'Provider-disabled invocation returns unavailable before context collection or provider transport.'
      ],
      stepIds: [
        'compose-ai-runtime',
        'route-natural-language-intent',
        'cleanup-feature-invocation'
      ],
      specRefs: ['#product-cases', '#definition-of-done']
    },
    {
      id: 'registry-and-schema',
      title: 'Deterministic registry and complete schema validation',
      assertions: [
        'Registration order is deterministic, duplicate names reject without replacement, and unknown actions never execute.',
        'Every argument schema succeeds for the complete plan before any executor call; one invalid later action rejects every earlier valid prefix.'
      ],
      stepIds: ['describe-action-registry', 'validate-complete-plan'],
      specRefs: ['#product-cases', '#definition-of-done']
    },
    {
      id: 'permission-and-confirmation',
      title: 'Permission and confirmation preflight',
      assertions: [
        'Any denial rejects the complete plan before transaction execution.',
        'A confirmation-required plan presents one immutable complete preview and accepted/cancelled outcomes are deterministic.'
      ],
      stepIds: ['evaluate-app-permissions', 'preview-confirm-plan'],
      specRefs: ['#product-cases', '#definition-of-done']
    },
    {
      id: 'transaction-and-no-prefix',
      title: 'One accepted plan, one transaction, no rejected prefix',
      assertions: [
        'A valid multi-action plan invokes one transaction runner and executors in plan order.',
        'Executor/canonical failure rolls back all rollbackable writes and creates no accepted canonical prefix or normal undo commit.'
      ],
      stepIds: [
        'run-plan-transaction',
        'execute-app-actions',
        'mutate-canonical-state',
        'settle-plan-transaction'
      ],
      specRefs: ['#product-cases', '#definition-of-done']
    },
    {
      id: 'provider-failure-retry-cleanup',
      title: 'Provider failure, retry, abort, timeout, and cleanup',
      assertions: [
        'Malformed output and provider failure are redacted; retry is bounded and never repeats a transaction.',
        'Abort, timeout, and disposal release request timers/listeners/attempt state and prevent later mutation.'
      ],
      stepIds: [
        'request-provider-plan',
        'normalize-provider-result',
        'cleanup-feature-invocation'
      ],
      specRefs: ['#product-cases', '#definition-of-done']
    },
    {
      id: 'redaction-and-audit',
      title: 'Secret redaction and detached audit output',
      assertions: [
        'Authorization, token, api-key, configured secret keys, and nested provider failures are redacted from every returned error/audit value.',
        'Audit/explanation output is detached and cannot change canonical state or future runtime results.'
      ],
      stepIds: ['produce-redacted-audit', 'cleanup-feature-invocation'],
      specRefs: ['#product-cases', '#definition-of-done']
    },
    {
      id: 'instance-isolation-case',
      title: 'Multiple runtime instance isolation',
      assertions: [
        'Two runtime instances do not share action definitions, provider calls, policy results, abort/timeout state, retries, audit results, or disposal.'
      ],
      stepIds: [
        'compose-ai-runtime',
        'describe-action-registry',
        'request-provider-plan',
        'cleanup-feature-invocation'
      ],
      specRefs: ['#product-cases', '#definition-of-done']
    },
    {
      id: 'ordinary-state-projection-publication',
      title: 'Ordinary canonical, Render, and optional Collaboration routes',
      assertions: [
        'App executors use common/public APIs and existing state owners; model output and audit data never become canonical.',
        'Render derives from committed state and optional AI-originated shared mutations follow the ordinary Factory and Gate 2 publication route.'
      ],
      stepIds: [
        'execute-app-actions',
        'mutate-canonical-state',
        'settle-plan-transaction',
        'project-derived-output',
        'transport-optional-publication'
      ],
      specRefs: ['#product-cases', '#definition-of-done']
    },
    {
      id: 'provider-replacement-case',
      title: 'Generic HTTP and deterministic provider replacement',
      assertions: [
        'Generic HTTP and fake providers share one public provider contract, and neither changes registry, preflight, transaction, action, or result contracts.',
        'Formal tests and CI require no live endpoint or API key.'
      ],
      stepIds: [
        'collect-app-context',
        'request-provider-plan',
        'normalize-provider-result',
        'validate-complete-plan'
      ],
      specRefs: ['#provider-adapter-decision', '#definition-of-done']
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'ai-agent-runtime',
      kind: 'system',
      title: 'AI Agent Runtime Flow Inspector',
      subtitle:
        'App-owned natural-language Feature intent through isolated context/action/provider planning, complete permission and confirmation preflight, one transaction-bounded canonical execution, ordinary optional publication, redacted audit, and deterministic cleanup.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'AI Agent Runtime Plan product contract',
      inspectorOwner: 'AI Agent Runtime Flow Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product Contract',
        href: './ai-agent-runtime-plan.md',
        kind: 'authority'
      },
      {
        id: 'feature-system-contract',
        label: 'Feature System Contract',
        href: '../packages/feature-system.md',
        kind: 'framework'
      },
      {
        id: 'transaction-contract',
        label: 'Transaction Contract',
        href: '../rules/data-flow-and-transactions.md',
        kind: 'framework'
      },
      {
        id: 'gate-2-contract',
        label: 'Gate 2 Transport Contract',
        href: './completed/network-collaboration-transport-plan.md',
        kind: 'authority'
      },
      {
        id: 'flow-inspector-contract',
        label: 'Flow Inspector Contract',
        href: '../FLOW_INSPECTOR.md',
        kind: 'framework'
      }
    ],
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  }

  const freeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
      return value
    }
    Object.freeze(value)
    Object.values(value).forEach(freeze)
    return value
  }

  freeze(data)
  if (typeof globalThis !== 'undefined') globalThis.FLOW_INSPECTOR_DATA = data
  if (typeof module !== 'undefined' && module.exports) module.exports = data
})()
