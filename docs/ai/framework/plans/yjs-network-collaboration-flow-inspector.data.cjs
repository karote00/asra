;(function () {
  'use strict'

  const specPath = 'docs/ai/framework/plans/yjs-network-collaboration-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/yjs-network-collaboration-flow-inspector.data.cjs'

  const lanes = [
    { id: 'composition', title: 'Explicit App Composition', order: 1 },
    { id: 'local', title: 'Local Commit and Shared Operation', order: 2 },
    { id: 'transport', title: 'Yjs and Provider Transport', order: 3 },
    { id: 'inbound', title: 'Inbound Validation and Policy', order: 4 },
    { id: 'canonical', title: 'Remote Canonical Apply', order: 5 },
    { id: 'durability', title: 'Persistence and Reconnect', order: 6 },
    { id: 'awareness', title: 'Ephemeral Awareness', order: 7 }
  ]

  const steps = [
    {
      id: 'compose-collaboration-opt-in',
      order: 1,
      laneId: 'composition',
      title: 'Compose collaboration explicitly',
      ownerPackage: 'app or user composition',
      purpose:
        'Choose whether collaboration exists and supply document, actor, room, registry, provider, persistence, policy, and ownership inputs without changing ordinary Core startup.',
      inputs: [
        'app collaboration decision',
        'document id, room id, and actor id',
        'intended Factory/shared registry',
        'registered operation definitions and app/server policies',
        'optional provider, persistence, Y.Doc, and awareness runtime'
      ],
      outputs: [
        'artifact:collaboration-composition',
        'artifact:collaboration-disabled'
      ],
      conditions: [
        'Only an explicit import and collaboration-instance creation activates the collaboration bundle.',
        'Asyra Design imports its public reference collaboration composition only when an app URL supplies one non-empty fileId and after ordinary app state owners and projections are ready; production bundles retain the dynamic composition for deployed public use.',
        'The public reference composition maps the one public fileId to both internal document and room identity and generates the actor per page; document, room, and actor are not independent URL inputs.',
        'Before collaborative user actions begin, Asyra Design supplies the full page actor identity as the canonical ID-counter namespace so concurrent element and property creation is cross-actor unique; collaboration does not resolve app entity-ID collisions by rereading payloads.',
        'Asyra Design owns one app URL used by Vite, ordinary Playwright, visual review, collaboration E2E, and the reference WebSocket Origin check; one override supports a non-default local port or deployed http(s) origin.',
        'Ordinary Asyra Design Playwright discovery excludes the collaboration spec, while the dedicated collaboration config discovers only that spec and owns the WebSocket server composition.',
        'Asyra Design RenderApp owns unmount and aborted-startup teardown requests; the collaboration lifecycle module owns HMR teardown, setup-failure cleanup, and explicit disposal of the app-owned provider, Awareness observers, and owned resources; Core does not own this collaboration lifecycle.',
        'Asyra Design composition setup failure disposes the partially created collaboration instance before the failure is reported.',
        'The public .mjs composition has a manifest-declared workspace runner that executes its two-client convergence and Awareness smoke test through supported package resolution.',
        'Authentication, authorization, room access, and durable backend policy are supplied by app/server composition.',
        'Connection authentication metadata belongs to the explicitly supplied provider identity and is not duplicated as an unused collaboration-composition input.',
        'Injected resources declare owned or borrowed disposal semantics.'
      ],
      bypasses: [
        'When collaboration is disabled, Core, Factory, Preset, and Persistence create no Y.Doc, provider, room, awareness, network connection, or collaboration persistence side effect.',
        'Every Asyra Design URL without fileId excludes the collaboration composition at runtime and retains the normal persistence path.'
      ],
      allowedContributors: [
        'public @asyra/collaboration composition API',
        'app/server authentication and permission policy',
        'app-owned canonical operation registrations'
      ],
      forbiddenContributors: [
        'implicit Core or Preset activation',
        'provider-specific state authority',
        'Render/UI composition decisions'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/package.json',
        'packages/collaboration/tsconfig.json',
        'scripts/gen-turbo.js',
        'turbo.json',
        'packages/collaboration/src/index.ts',
        'packages/collaboration/src/composition.ts',
        'packages/collaboration/src/__tests__/composition.test.ts',
        'packages/collaboration/src/__tests__/documentation-example.test.js',
        'docs/examples/yjs-network-collaboration.mjs',
        'docs/ai/framework/packages/collaboration.md',
        'docs/ai/framework/packages/README.md',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/ARCHITECTURE.md',
        'docs/ai/framework/RUNTIME_MATRICES.md',
        'docs/ai/framework/CONSTRAINTS.md',
        'docs/ai/framework/packages/factory.md',
        'docs/ai/framework/decisions/releases/unreleased.md',
        'apps/asyra-design/src/**/collaboration-mode.ts',
        'apps/asyra-design/src/render-app/__tests__/collaboration-mode.test.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-lifecycle.test.ts',
        'packages/utils/src/sid/idCounter.ts',
        'packages/utils/src/sid/__tests__/idCounter.test.ts',
        'apps/asyra-design/src/collaboration/factory-adapter.ts',
        'apps/asyra-design/src/render-app/index.tsx',
        'apps/asyra-design/src/types.d.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-production-bundle.test.mjs',
        'apps/asyra-design/*environment*.mjs',
        'apps/asyra-design/vite.config.ts',
        'apps/asyra-design/playwright.config.ts',
        'apps/asyra-design/playwright.collaboration.config.ts',
        'apps/asyra-design/playwright-config.test.mjs',
        'apps/asyra-design/README.md',
        'apps/asyra-design/.env',
        'apps/asyra-design/package.json',
        'scripts/run-e2e.sh',
        'yarn.lock'
      ],
      specRefs: [
        '#supported-behavior',
        '#public-input-and-output-contracts',
        '#ownership-and-forbidden-boundaries'
      ],
      failureOwnerStepId: 'compose-collaboration-opt-in'
    },
    {
      id: 'own-collaboration-instance',
      order: 2,
      laneId: 'composition',
      title: 'Own the collaboration instance',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Bind one isolated document runtime and its lifecycle to the exact resources selected by composition.',
      inputs: ['artifact:collaboration-composition'],
      outputs: [
        'artifact:collaboration-instance',
        'artifact:provider-composition',
        'artifact:no-provider-composition',
        'artifact:instance-disposed'
      ],
      conditions: [
        'The instance owns or receives exactly one Y.Doc, provider, Factory-backed shared registry, document/room identity, awareness runtime, and disposal lifecycle.',
        'Construction validates and retains resources without subscribing, recovering, connecting, or sending; explicit start activates observers and durability acknowledgement tracking.',
        'Separate instances remain isolated unless the app intentionally injects a shared resource.',
        'Disposal removes document, provider, shared-delivery, update, acknowledgement, and awareness observers according to explicit resource ownership.',
        'Disposal bypasses queued work that has not started, destroys an owned provider before awaiting pending start or already-started work queue settlement so provider destruction can abort outstanding I/O, and only detaches a borrowed provider.',
        'Recovery, provider connection, state-vector synchronization, and reconnect recheck disposal after every asynchronous boundary and cannot mark a disposed collaboration as started.',
        'Already-started inbound work rechecks instance disposal after asynchronous permission or conflict policy settlement and cannot enter canonical apply after disposal begins.'
      ],
      bypasses: [
        'An explicitly created provider-less instance remains an offline Yjs document composition and opens no network connection.',
        'Borrowed resources are detached but not destroyed.'
      ],
      allowedContributors: [
        'artifact:collaboration-composition',
        'consumer-owned Factory and Y.Doc',
        'replaceable provider and awareness adapters'
      ],
      forbiddenContributors: [
        'module-level default Y.Doc',
        'fallback to another Core or Factory instance',
        'cross-instance cleanup state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/package.json',
        'packages/collaboration/tsconfig.json',
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/awareness.ts',
        'packages/collaboration/src/__tests__/process.test.ts',
        'packages/collaboration/src/index.ts',
        'packages/collaboration/src/composition.ts',
        'yarn.lock'
      ],
      specRefs: ['#supported-behavior', '#instance-ownership'],
      failureOwnerStepId: 'own-collaboration-instance'
    },
    {
      id: 'publish-local-committed-change',
      order: 1,
      laneId: 'local',
      title: 'Publish local shared delivery action',
      ownerPackage: '@asyra/factory',
      purpose:
        'Batch one immediate delivery action or one committed transaction-end delivery into one ordered collaboration publication while preserving the outer local undo boundary.',
      inputs: [
        'artifact:collaboration-instance',
        'local transaction journal',
        'state-owner change with shared channel and sharedDelivery metadata'
      ],
      outputs: [
        'artifact:local-shared-delivery',
        'artifact:local-action-publication',
        'artifact:local-action-discard'
      ],
      conditions: [
        'The ordinary local flow remains Intent -> Feature -> API -> local transaction -> state owner before any external publication; provider transport never precedes canonical mutation.',
        'sharedDelivery selects the complete shared-pipeline timing: immediate reaches local projection and collaboration without waiting for the outer undo transaction, while transaction-end waits for outer commit.',
        'One synchronous immediate delivery action emits at most one ordered publication containing all of its changes, including changes for multiple elements or state owners. One committed transaction-end batch also emits at most one publication.',
        'An outer pointer session may emit several immediate publications while remaining one intended local undo commit.',
        'Already-published immediate entries are excluded from the outer transaction-end publication and are never sent twice.',
        'Factory and collaboration preserve repeated semantic deliveries in journal order; they do not deduplicate by event name, payload value, or a repeated A -> B -> C -> B app timeline.',
        'Factory snapshots each transaction status and publication before external completion observers run, so a reentrant nested action cannot replace the outer transaction identity, counts, or publication order.',
        'Local shared projection observers receive detached payloads through Factory-owned local channels that do not require a Y.Doc.',
        'A canonical Props owner that creates a nested child property journals the child add before publishing a parent reference update, so every referenced property id has an ordinary state-owner operation.',
        'For element creation, every property add referenced by the saved element payload settles before the Scene Tree element add, so a peer never has to fabricate fallback properties while applying the canonical element.',
        'Action, automation, undo, redo, remote, load/migration, and compensation origins remain distinguishable.',
        'Factory batches by the delivery boundary selected by app/API mutation options and does not infer create, move, drag, throttle, or render-preview product semantics.',
        'App pointer geometry and its area-selection projection consume one completed shared Rect calculation instead of redefining the rectangle contract downstream.',
        'Immediate entries discarded before their publication flush produce no network operation; rollback after publication emits linked compensation in deterministic reverse order.',
        'The one outer action transaction remains one intended local undo commit regardless of its immediate publication count.'
      ],
      bypasses: [
        'A mutation without an explicitly registered shared channel remains local.',
        'Rollback or discard before an immediate flush discards that pending publication; transaction-end rollback before commit produces no network operation.',
        'Remote-origin apply may update local projections but is excluded from new local network publication.'
      ],
      allowedContributors: [
        '@asyra/reactive-events transaction boundary',
        'Factory journal and shared-settlement owner',
        'canonical state-owner mutation metadata',
        'feature/API-owned shared delivery timing'
      ],
      forbiddenContributors: [
        'Y.Doc as transaction owner',
        'provider send before canonical mutation',
        'Render/UI mutation source'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/package.json',
        'packages/factory/src/data-transact.ts',
        'packages/factory/src/factory.ts',
        'packages/factory/src/shared-data-channel.ts',
        'packages/factory/src/shared-delivery.ts',
        'packages/factory/src/__tests__/factory.test.ts',
        'packages/factory/src/__tests__/factory-instance-replay.test.ts',
        'packages/factory/src/__tests__/shared-delivery.test.ts',
        'packages/utils/src/types/change.ts',
        'packages/utils/src/render/viewport.ts',
        'apps/asyra-design/src/features/create-element/feature.ts',
        'apps/asyra-design/src/features/move-elements/feature.ts',
        'apps/asyra-design/src/features/selection/feature.ts',
        'apps/asyra-design/src/render-layers/area-selection-render-layer.ts',
        'packages/props-manager/src/manager/props-manager.ts',
        'packages/props-manager/src/__tests__/property-type-redefinition.test.ts',
        'packages/scene-tree/src/sceneTree.ts',
        'packages/scene-tree/src/__tests__/property-type-projection.test.ts',
        'packages/core/src/core.ts',
        'packages/core/src/index.ts',
        'packages/core/src/__tests__/registration-facade.test.ts',
        'packages/preset/src/types.ts',
        'packages/preset/src/subscriptions/shared-channels.ts',
        'packages/preset/src/__tests__/shared-channels-lifecycle.test.ts',
        'packages/preset/src/__tests__/preset-default-cleanup.test.ts',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/ARCHITECTURE.md',
        'docs/ai/framework/packages/core.md',
        'docs/ai/framework/packages/factory.md',
        'docs/ai/framework/plans/yjs-network-collaboration-plan.md',
        'yarn.lock'
      ],
      specRefs: [
        '#canonical-collaboration-flows',
        '#undoredo-and-rollback',
        '#ownership-and-forbidden-boundaries'
      ],
      failureOwnerStepId: 'publish-local-committed-change'
    },
    {
      id: 'create-shared-operation-envelope',
      order: 2,
      laneId: 'local',
      title: 'Create and validate operation envelope',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Turn one eligible action publication into one or more typed, versioned, identity-stable, ordered semantic operation envelopes.',
      inputs: [
        'artifact:local-action-publication',
        'artifact:collaboration-instance',
        'registered channel/event payload definitions'
      ],
      outputs: [
        'artifact:shared-operation-envelope-batch',
        'artifact:local-operation-rejection'
      ],
      conditions: [
        'The envelope contains operation, transaction, document, actor, protocol, schema, origin, channel, event, and validated payload fields.',
        'A compensation envelope names the exact operation it compensates.',
        'One action publication becomes one or more ordered operation envelopes while retaining one publication identity and the actor-scoped outer transaction identity.',
        'Every envelope is validated before any entry from the action batch mutates Y.Doc or reaches provider transport.',
        'Registration retains the app or state-owner canonical apply handler without executing it during local envelope creation.',
        'Canonical apply registration uses defineCanonicalOperationApply so TypeScript Promise returns fail compilation and native async functions fail registration before invocation.'
      ],
      bypasses: [
        'Unregistered channel/event or invalid local payload is rejected before Y.Doc mutation or provider send.'
      ],
      allowedContributors: [
        'artifact:local-action-publication',
        'instance identity and operation id source',
        'registered payload validator',
        'registered app or state-owner canonical apply handler'
      ],
      forbiddenContributors: [
        'Yjs transaction origin as the only semantic metadata',
        'untyped arbitrary payload routing',
        'awareness state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/operations/envelope.ts',
        'packages/collaboration/src/operations/registry.ts',
        'packages/collaboration/src/index.ts',
        'packages/collaboration/src/__tests__/composition.test.ts',
        'packages/collaboration/src/__tests__/envelope.test.ts'
      ],
      specRefs: [
        '#shared-operation-envelope',
        '#public-input-and-output-contracts'
      ],
      failureOwnerStepId: 'create-shared-operation-envelope'
    },
    {
      id: 'append-yjs-update',
      order: 1,
      laneId: 'transport',
      title: 'Append one action batch to the owned Y.Doc',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Encode one validated action publication as one Y.Doc transaction and one binary update without transferring canonical document ownership to Yjs.',
      inputs: [
        'artifact:shared-operation-envelope-batch',
        'artifact:collaboration-instance'
      ],
      outputs: ['artifact:yjs-binary-update', 'artifact:yjs-append-failure'],
      conditions: [
        'The Y.Doc transaction carries local transport origin for echo classification while all remote-required metadata remains in the envelope.',
        'One action publication appends all ordered envelopes in one Y.Doc transaction and emits exactly one binary update.',
        'The generated binary action update is eligible for provider transport and collaboration update persistence independently from runtime commit.'
      ],
      bypasses: [
        'A rejected local operation produces no Y.Doc update.',
        'An explicit provider-less composition retains the update locally without transport.'
      ],
      allowedContributors: [
        'artifact:shared-operation-envelope-batch',
        'instance-owned or injected Y.Doc'
      ],
      forbiddenContributors: [
        'direct canonical state reads or writes',
        'provider-owned document mutation',
        'awareness fields'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/yjs-document.ts',
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/__tests__/yjs-document.test.ts'
      ],
      specRefs: ['#shared-operation-envelope', '#origin-and-echo-prevention'],
      failureOwnerStepId: 'append-yjs-update'
    },
    {
      id: 'transport-provider-update',
      order: 2,
      laneId: 'transport',
      title: 'Transport provider update',
      ownerPackage: 'replaceable Provider adapter',
      purpose:
        'Connect to the composed room/auth boundary, send and receive binary updates, expose connection and acknowledgement state, and remain replaceable.',
      inputs: [
        'artifact:provider-composition',
        'artifact:no-provider-composition',
        'artifact:yjs-binary-update',
        'artifact:outbound-awareness'
      ],
      outputs: [
        'artifact:provider-status',
        'artifact:inbound-binary-update',
        'artifact:durable-acknowledgement',
        'artifact:provider-failure',
        'artifact:inbound-awareness',
        'artifact:awareness-disconnect'
      ],
      conditions: [
        'Connect, disconnect, reconnect, status observation, binary update transport, state-vector exchange, awareness transport, acknowledgement observation, and disposal use the provider contract.',
        'The provider forwards app-defined opaque connection metadata and reports connection success or failure without assigning product meaning to file, user, branch, tenant, authentication, or permission fields.',
        'The provider never grants authority from awareness.',
        'The Asyra Design public reference implementation supplies only fileId as app-defined connection metadata; its memory server intentionally performs no user/session authentication or permission check and makes no protected-document authorization claim.',
        'The Asyra Design reference composition forwards only registered sceneTree and props document operations through this provider boundary; selection stays local and every URL without fileId bypasses the composition.',
        'The Asyra Design browser provider and reference server consume one app-owned typed wire-protocol contract for message discriminants and payload shapes.',
        'The in-memory reference hub stages live and sync updates against the room history and rejects non-operation, non-append, malformed, or undecodable Yjs changes before they can pollute or broadcast from the room Y.Doc.',
        'The in-memory reference hub binds every newly received operation actor to the accepted connection identity before integrating room history, broadcast, or acknowledgement.',
        'One binary action update from one local action publication invokes exactly one provider send.',
        'Remote-origin Y.Doc updates are never sent back as local updates.'
      ],
      bypasses: [
        'No-provider composition produces an offline status and no network side effect.',
        'Asyra Design without a non-empty fileId creates no WebSocket provider or reference-server dependency.',
        'Disconnect halts transport and emits awareness cleanup without destroying canonical state.'
      ],
      allowedContributors: [
        'provider-neutral binary and status contract',
        'app/server connection-parameter interpretation and optional authentication boundary',
        'Asyra Design public reference composition and memory WebSocket server',
        'Asyra Design app-owned typed WebSocket wire protocol',
        'artifact:yjs-binary-update',
        'artifact:outbound-awareness'
      ],
      forbiddenContributors: [
        'provider as canonical state owner',
        'hard-coded WebSocket, P2P, or hosted provider authority',
        'selection as persisted document transport',
        'public memory server as an authenticated or durable backend',
        'awareness-derived write permission'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/provider.ts',
        'packages/collaboration/src/providers/memory/hub.ts',
        'packages/collaboration/src/providers/memory/provider.ts',
        'packages/collaboration/src/__tests__/provider.test.ts',
        'packages/collaboration/src/__tests__/provider-lifecycle.test.ts',
        'apps/asyra-design/src/collaboration/websocket-provider.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-websocket-provider.test.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/**/collaboration-mode.ts',
        'apps/asyra-design/src/collaboration/protocol.ts',
        'apps/asyra-design/src/collaboration/wire-values.ts',
        'apps/asyra-design/*environment*.mjs',
        'apps/asyra-design/.env',
        'apps/asyra-design/*collaboration*.ts',
        'apps/asyra-design/*collaboration*.mjs',
        'apps/asyra-design/e2e/*collaboration*.spec.ts'
      ],
      specRefs: [
        '#provider-boundary',
        '#authentication-and-authorization',
        '#persistence-and-offline-behavior'
      ],
      failureOwnerStepId: 'transport-provider-update'
    },
    {
      id: 'decode-inbound-update',
      order: 1,
      laneId: 'inbound',
      title: 'Decode inbound Yjs update',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Apply provider/persistence binary input to the owned Y.Doc under a non-local origin and extract semantic operation envelopes.',
      inputs: [
        'artifact:inbound-binary-update',
        'artifact:persisted-collaboration-update',
        'artifact:collaboration-instance'
      ],
      outputs: [
        'artifact:decoded-operation-envelope',
        'artifact:inbound-decode-failure'
      ],
      conditions: [
        'Provider and offline-persistence updates use explicit non-local Y.Doc origins.',
        'Only semantic operation entries are forwarded to validation; Yjs update integration itself does not mutate canonical package state.',
        'Malformed, non-operation, non-append, or undecodable updates are staged and rejected without changing the owned Y.Doc; delete, prepend, and insertion before an existing right neighbour are non-append updates, while concurrent causal-tail appends remain valid regardless of merged visible order.'
      ],
      bypasses: [
        'An empty state-vector diff produces no operation.',
        'Malformed binary or non-operation content terminates at this owner.'
      ],
      allowedContributors: [
        'artifact:inbound-binary-update',
        'artifact:persisted-collaboration-update',
        'Yjs binary decode/apply API'
      ],
      forbiddenContributors: [
        'canonical state-owner mutation',
        'Render/UI observer repair',
        'provider-specific payload interpretation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/yjs-document.ts',
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/__tests__/decode.test.ts'
      ],
      specRefs: ['#remote-canonical-apply', '#canonical-collaboration-flows'],
      failureOwnerStepId: 'decode-inbound-update'
    },
    {
      id: 'validate-origin-dedupe-protocol',
      order: 2,
      laneId: 'inbound',
      title: 'Validate origin, identity, protocol, and payload',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Reject echoes, identity collisions, unsupported versions/routes, malformed payloads, and deterministic duplicates before policy or state apply.',
      inputs: [
        'artifact:decoded-operation-envelope',
        'optional authenticated live-update author from provider ingestion',
        'registered operation definitions',
        'instance document identity',
        'instance operation outcome registry'
      ],
      outputs: [
        'artifact:validated-remote-operation',
        'artifact:duplicate-operation-outcome',
        'artifact:remote-validation-rejection'
      ],
      conditions: [
        'Document id, actor id, operation id, transaction id, origin, protocol version, schema version, channel, event name, and payload are validated.',
        'When provider ingestion supplies an authenticated live-update author, it must equal the envelope actor before dedupe, permission, conflict, or apply.',
        'Inbound record fields are inert data: accessors are rejected without execution and prototype-named JSON keys remain own data properties.',
        'A payload validator exception rejects only that operation and cannot abort later operations decoded from the same update.',
        'A repeated identical operation id returns the recorded deterministic outcome without mutation.',
        'A repeated operation id with different content is rejected as an identity collision.',
        'A locally published operation is recorded in the instance outcome registry before transport so its own replay is a duplicate.',
        'A compensation proceeds only when its exact same-actor, non-compensation forward has a final accepted or repaired outcome with applied=true; missing, rejected, apply-failed, or semantic no-op forwards reject before permission or canonical apply.',
        'Factory/Yjs append dependencies reveal a valid forward before its compensation; an unavailable final forward outcome is invalid linkage and does not create a second pending replay queue.',
        'Remote apply and compensation are classified as inbound and cannot echo as local publication.'
      ],
      bypasses: [
        'A deterministic duplicate terminates without permission, conflict, transaction, or canonical apply.',
        'Invalid or unsupported input terminates with an immutable rejection outcome.'
      ],
      allowedContributors: [
        'artifact:decoded-operation-envelope',
        'registered protocol/schema and channel/event validators',
        'instance-local operation outcome registry'
      ],
      forbiddenContributors: [
        'provider connection state as payload validity',
        'an unauthenticated transport peer presented as an operation author',
        'global cross-instance dedupe registry',
        'canonical apply before validation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/operations/outcomes.ts',
        'packages/collaboration/src/operations/validation.ts',
        'packages/collaboration/src/operations/envelope.ts',
        'packages/collaboration/src/operations/registry.ts',
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/__tests__/validation.test.ts'
      ],
      specRefs: [
        '#remote-canonical-apply',
        '#origin-and-echo-prevention',
        '#shared-operation-envelope'
      ],
      failureOwnerStepId: 'validate-origin-dedupe-protocol'
    },
    {
      id: 'decide-permission-conflict',
      order: 3,
      laneId: 'inbound',
      title: 'Decide permission and conflict policy',
      ownerPackage: '@asyra/collaboration policy pipeline',
      purpose:
        'Evaluate app/server permission and ordered explicitly registered app-domain policies before the remote transaction begins.',
      inputs: [
        'artifact:validated-remote-operation',
        'app/server permission policy',
        'app-owned conflict policy extensions'
      ],
      outputs: [
        'artifact:accepted-or-repaired-operation',
        'artifact:permission-or-conflict-rejection'
      ],
      conditions: [
        'Permission runs before conflict resolution and never derives authority from awareness.',
        'Framework transport and operation validation cannot be replaced or overridden by a policy.',
        'Only explicitly registered app-domain policies run, in deterministic registration order, after validation and permission pass.',
        'When every registered app-domain policy reports not-applicable, the validated operation continues unchanged to canonical apply.',
        'A repair is revalidated against the registered operation payload before apply, and a validator exception becomes an invalid-repair rejection.',
        'Accept, repair, reject, and not-applicable outcomes are deterministic for the same operation and policy set.',
        'The policy pipeline does not infer entity, hierarchy, property, geometry, or topology semantics from canonical app state; those semantics remain in registered app policies and canonical state owners.'
      ],
      bypasses: [
        'Unauthorized or app-policy-rejected operations produce no remote transaction.',
        'No registered or applicable app-domain policy accepts the validated operation unchanged.'
      ],
      allowedContributors: [
        'artifact:validated-remote-operation',
        'app/server permission callback',
        'app-owned domain policy registry'
      ],
      forbiddenContributors: [
        'Render/UI conflict repair',
        'provider or awareness authorization',
        'post-commit policy decision'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/operations/conflict.ts',
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/__tests__/conflict.test.ts'
      ],
      specRefs: [
        '#conflict-policy',
        '#authentication-and-authorization',
        './collaborative-conflict-policies-plan.md#release-scope'
      ],
      failureOwnerStepId: 'decide-permission-conflict'
    },
    {
      id: 'run-remote-apply-transaction',
      order: 1,
      laneId: 'canonical',
      title: 'Run remote apply transaction',
      ownerPackage: '@asyra/collaboration with @asyra/factory boundary',
      purpose:
        'Open one rollbackable remote-origin transaction and invoke exactly the registered canonical apply boundary without ordinary local undo capture or network echo.',
      inputs: [
        'artifact:accepted-or-repaired-operation',
        'registered canonical apply handler',
        'intended Factory transaction owner'
      ],
      outputs: [
        'artifact:canonical-apply-request',
        'artifact:remote-apply-failure'
      ],
      conditions: [
        'One remote semantic operation is applied inside one intended remote transaction boundary.',
        'Canonical apply is a trusted synchronous state-owner boundary registered with defineCanonicalOperationApply: void or true means applied, false means a semantic no-op, TypeScript rejects Promise returns, and native async is rejected before invocation.',
        'A contract-violating runtime thenable records apply-failed and rolls back synchronous journal mutations, but JavaScript cannot cancel handler-scheduled effects after return; scheduling them violates the trusted registration contract.',
        'Reactive transaction calls inside the handler route to the intended Factory, and remote-origin mutation options cannot disable rollbackability.',
        'Remote changes remain rollbackable on apply failure but are excluded from ordinary local-user undo history.',
        'Remote-origin local projection delivery is allowed while collaboration publication suppresses echo.',
        'A synchronous handler failure rolls back the remote journal and records one apply-failed outcome.'
      ],
      bypasses: [
        'Duplicate, invalid, unauthorized, unsupported, or conflict-rejected operations never open a transaction.'
      ],
      allowedContributors: [
        'artifact:accepted-or-repaired-operation',
        'Factory remote-origin transaction boundary',
        'registered canonical apply handler'
      ],
      forbiddenContributors: [
        'Feature System as a second remote decision runtime',
        'direct Render/UI mutation',
        'ordinary local undo capture',
        'network republish of remote-origin mutation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/operations/apply.ts',
        'packages/collaboration/src/operations/registry.ts',
        'packages/collaboration/src/index.ts',
        'packages/factory/src/factory.ts',
        'packages/factory/src/data-transact.ts',
        'packages/factory/src/__tests__/factory.test.ts',
        'packages/utils/src/types/transaction.ts',
        'packages/collaboration/src/__tests__/composition.test.ts',
        'packages/collaboration/src/__tests__/apply.test.ts'
      ],
      specRefs: [
        '#remote-canonical-apply',
        '#undoredo-and-rollback',
        '#canonical-collaboration-flows'
      ],
      failureOwnerStepId: 'run-remote-apply-transaction'
    },
    {
      id: 'apply-canonical-state-owner',
      order: 2,
      laneId: 'canonical',
      title: 'Apply through canonical state owner',
      ownerPackage: 'registered state-owner package',
      purpose:
        'Validate package-local invariants and mutate the one canonical Scene Tree, Props, Selection, or System owner.',
      inputs: ['artifact:canonical-apply-request'],
      outputs: [
        'artifact:canonical-state-change',
        'artifact:state-owner-rejection'
      ],
      conditions: [
        'The registered operation handler uses the same public/apply API and package validator/invariant boundary as other canonical state application.',
        'The registered operation handler forwards the validated payload unchanged through the ordinary canonical apply path unless an explicitly registered app-domain policy produced a separately validated repair.',
        'The collaboration adapter does not reread canonical state to reconstruct, filter, reorder, or rewrite app behavior.',
        'Entity, hierarchy, property, selection, and system invariants remain owned by their packages.',
        'A semantic no-op is acknowledged without fabricating a mutation.'
      ],
      bypasses: [
        'Package validation or invariant failure produces no committed canonical prefix.'
      ],
      allowedContributors: [
        'artifact:canonical-apply-request',
        'state-owner apply API',
        'package-local validators and invariants'
      ],
      forbiddenContributors: [
        'Y.Doc, provider, awareness, Render, or UI state authority',
        'app-specific fallback inside a framework owner'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/scene-tree/src/**',
        'packages/props-manager/src/**',
        'packages/selection/src/**',
        'packages/system-context/src/**',
        'apps/asyra-design/src/collaboration/operations.ts',
        'apps/asyra-design/src/collaboration/wire-values.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts',
        'apps/asyra-design/e2e/*collaboration*.spec.ts',
        'packages/collaboration/src/__tests__/apply.test.ts'
      ],
      specRefs: [
        '#remote-canonical-apply',
        '#ownership-and-forbidden-boundaries'
      ],
      failureOwnerStepId: 'apply-canonical-state-owner'
    },
    {
      id: 'project-canonical-state',
      order: 3,
      laneId: 'canonical',
      title: 'Project canonical state',
      ownerPackage: '@asyra/render and @asyra/ui-context',
      purpose:
        'Recompute ordinary derived projections from the committed canonical owner state.',
      inputs: ['artifact:canonical-state-change'],
      outputs: ['artifact:canonical-projection'],
      conditions: [
        'Render/UI consume the same canonical state-owner output for local and remote apply.',
        'Projection may observe origin for presentation or diagnostics but cannot change the canonical decision.'
      ],
      bypasses: [
        'A rejected, duplicate, or failed operation produces no canonical projection mutation.'
      ],
      allowedContributors: [
        'artifact:canonical-state-change',
        'ordinary state-to-render and state-to-UI subscriptions'
      ],
      forbiddenContributors: [
        'conflict repair',
        'permission decisions',
        'direct Y.Doc operation-log rendering as canonical state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src/**',
        'packages/ui-context/src/**',
        'packages/preset/src/subscriptions/**'
      ],
      specRefs: ['#canonical-collaboration-flows', '#remote-canonical-apply'],
      failureOwnerStepId: 'project-canonical-state'
    },
    {
      id: 'persist-sync-and-acknowledge',
      order: 1,
      laneId: 'durability',
      title: 'Persist, reconnect, and acknowledge',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Keep collaboration update persistence, provider convergence, and durable acknowledgement observable and independent from runtime commit.',
      inputs: [
        'artifact:yjs-binary-update',
        'artifact:provider-status',
        'artifact:durable-acknowledgement',
        'optional collaboration update persistence adapter'
      ],
      outputs: [
        'artifact:persisted-collaboration-update',
        'artifact:collaboration-persistence-failure',
        'artifact:network-convergence',
        'artifact:durability-outcome'
      ],
      conditions: [
        'Collaboration update persistence stores binary document updates only and never awareness.',
        'Reconnect exchanges state vectors and transports only the missing update diff in both directions.',
        'Runtime committed, locally persisted, network sent/converged, durably acknowledged, and failed remain distinct statuses.',
        'Persistence or acknowledgement failure never reverses an already committed canonical transaction.'
      ],
      bypasses: [
        'No persistence adapter skips local update storage without changing runtime/network behavior.',
        'No provider skips network convergence and durable server acknowledgement.',
        'Equal state vectors produce an empty synchronization diff.'
      ],
      allowedContributors: [
        'artifact:yjs-binary-update',
        'artifact:provider-status',
        'artifact:durable-acknowledgement',
        'provider state-vector API',
        'replaceable collaboration update persistence adapter'
      ],
      forbiddenContributors: [
        'awareness persistence',
        'Core document save as network convergence proof',
        'rollback of committed runtime state after durability failure'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/durability.ts',
        'packages/collaboration/src/persistence.ts',
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/provider.ts',
        'packages/collaboration/src/providers/memory/hub.ts',
        'packages/collaboration/src/providers/memory/provider.ts',
        'packages/collaboration/src/__tests__/durability.test.ts'
      ],
      specRefs: [
        '#persistence-and-offline-behavior',
        '#supported-behavior',
        '#representative-product-cases'
      ],
      failureOwnerStepId: 'persist-sync-and-acknowledge'
    },
    {
      id: 'own-awareness-state',
      order: 1,
      laneId: 'awareness',
      title: 'Own ephemeral awareness state',
      ownerPackage: '@asyra/collaboration awareness runtime',
      purpose:
        'Own local and remote presence snapshots, heartbeat expiry, and cleanup as non-authoritative observational state.',
      inputs: [
        'artifact:collaboration-instance',
        'artifact:inbound-awareness',
        'artifact:awareness-disconnect',
        'local awareness update'
      ],
      outputs: [
        'artifact:outbound-awareness',
        'artifact:remote-awareness-snapshot',
        'artifact:awareness-cleared'
      ],
      conditions: [
        'Presence accepts app-selected JSON-safe fields; identity, cursor, selection, viewport, tool, and editing are common examples, while the framework reserves only heartbeatAt for liveness.',
        'The inbound Awareness message and its nested state records reject accessors without execution and preserve prototype-named JSON keys as inert own data properties.',
        'Remote state is removed on peer disconnect, explicit leave, timeout, explicit local disconnect, or provider failure; local transport loss clears every remote snapshot and clock so reconnect can repopulate presence.',
        'Awareness cannot authorize a canonical mutation and does not enter document undo/redo.',
        'Canonical element create, geometry, style, hierarchy, and deletion changes never enter Awareness.'
      ],
      bypasses: [
        'An app with no awareness update emits no presence transport.',
        'Cleared or expired presence produces an observational removal only.'
      ],
      allowedContributors: [
        'local app presence input',
        'artifact:inbound-awareness',
        'artifact:awareness-disconnect',
        'instance clock/timeout policy'
      ],
      forbiddenContributors: [
        'canonical document state',
        'Core save/load payload',
        'collaboration Y.Doc operation array',
        'ordinary undo/redo history',
        'permission authority'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/awareness.ts',
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/__tests__/awareness.test.ts',
        'apps/asyra-design/src/collaboration'
      ],
      specRefs: ['#awareness-and-presence', '#supported-behavior'],
      failureOwnerStepId: 'own-awareness-state'
    },
    {
      id: 'project-awareness-state',
      order: 2,
      laneId: 'awareness',
      title: 'Project awareness observations',
      ownerPackage: 'app, @asyra/render, or @asyra/ui-context observer',
      purpose:
        'Display remote presence without feeding it into document state, authorization, save/load, or undo.',
      inputs: [
        'artifact:remote-awareness-snapshot',
        'artifact:awareness-cleared'
      ],
      outputs: ['artifact:awareness-projection'],
      conditions: [
        'Presence projection is removable and observational.',
        'The same canonical document remains valid when all awareness state is absent.'
      ],
      bypasses: [
        'Headless or presence-free apps may omit the projection entirely.'
      ],
      allowedContributors: [
        'artifact:remote-awareness-snapshot',
        'artifact:awareness-cleared',
        'app-owned presence presentation policy'
      ],
      forbiddenContributors: [
        'canonical mutation',
        'permission or conflict decision',
        'document persistence',
        'canonical element appearance or geometry transport'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/__tests__/awareness.test.ts',
        'apps/asyra-design/src/collaboration',
        'docs/examples/yjs-network-collaboration.mjs'
      ],
      specRefs: [
        '#awareness-and-presence',
        '#ownership-and-forbidden-boundaries'
      ],
      failureOwnerStepId: 'project-awareness-state'
    }
  ]

  const routes = [
    {
      id: 'collaboration-disabled',
      from: 'compose-collaboration-opt-in',
      kind: 'terminal',
      predicate: 'The app does not explicitly create a collaboration instance.',
      producedArtifacts: ['artifact:collaboration-disabled']
    },
    {
      id: 'compose-instance',
      from: 'compose-collaboration-opt-in',
      to: 'own-collaboration-instance',
      kind: 'handoff',
      predicate: 'The app supplies the required explicit collaboration inputs.',
      producedArtifacts: ['artifact:collaboration-composition']
    },
    {
      id: 'activate-local-delivery',
      from: 'own-collaboration-instance',
      to: 'publish-local-committed-change',
      kind: 'handoff',
      predicate:
        'The instance subscribes to its intended Factory shared-delivery boundary.',
      producedArtifacts: ['artifact:collaboration-instance']
    },
    {
      id: 'activate-awareness',
      from: 'own-collaboration-instance',
      to: 'own-awareness-state',
      kind: 'observational',
      predicate: 'The instance binds its ephemeral awareness runtime.',
      producedArtifacts: ['artifact:collaboration-instance']
    },
    {
      id: 'provider-composed',
      from: 'own-collaboration-instance',
      to: 'transport-provider-update',
      kind: 'handoff',
      predicate: 'A replaceable provider is explicitly supplied.',
      producedArtifacts: ['artifact:provider-composition']
    },
    {
      id: 'provider-omitted',
      from: 'own-collaboration-instance',
      to: 'transport-provider-update',
      kind: 'bypass',
      predicate:
        'The explicit collaboration instance is provider-less and offline.',
      producedArtifacts: ['artifact:no-provider-composition']
    },
    {
      id: 'dispose-instance',
      from: 'own-collaboration-instance',
      kind: 'terminal',
      predicate:
        'The instance is disposed and releases only its owned lifecycle.',
      producedArtifacts: ['artifact:instance-disposed']
    },
    {
      id: 'local-shared-forward',
      from: 'publish-local-committed-change',
      to: 'create-shared-operation-envelope',
      kind: 'handoff',
      predicate:
        'An immediate delivery action flushes or the outer transaction commits one or more transaction-end shared changes.',
      producedArtifacts: ['artifact:local-action-publication']
    },
    {
      id: 'discard-before-flush',
      from: 'publish-local-committed-change',
      kind: 'terminal',
      predicate:
        'Rollback or discard occurs before an immediate flush or before transaction-end commit.',
      producedArtifacts: ['artifact:local-action-discard']
    },
    {
      id: 'validated-local-envelope',
      from: 'create-shared-operation-envelope',
      to: 'append-yjs-update',
      kind: 'handoff',
      predicate:
        'Every ordered envelope in the action publication passes identity, version, route, and payload validation.',
      producedArtifacts: ['artifact:shared-operation-envelope-batch']
    },
    {
      id: 'reject-local-envelope',
      from: 'create-shared-operation-envelope',
      kind: 'terminal',
      predicate: 'The local route is unregistered or its payload is invalid.',
      producedArtifacts: ['artifact:local-operation-rejection']
    },
    {
      id: 'send-yjs-update',
      from: 'append-yjs-update',
      to: 'transport-provider-update',
      kind: 'transport',
      predicate:
        'A provider is present and the update has local transport origin.',
      producedArtifacts: ['artifact:yjs-binary-update']
    },
    {
      id: 'persist-yjs-update',
      from: 'append-yjs-update',
      to: 'persist-sync-and-acknowledge',
      kind: 'persistence',
      predicate: 'A collaboration update exists, whether local or remote.',
      producedArtifacts: ['artifact:yjs-binary-update']
    },
    {
      id: 'yjs-append-failed',
      from: 'append-yjs-update',
      kind: 'terminal',
      predicate: 'The owned Y.Doc rejects the semantic operation append.',
      producedArtifacts: ['artifact:yjs-append-failure']
    },
    {
      id: 'receive-provider-update',
      from: 'transport-provider-update',
      to: 'decode-inbound-update',
      kind: 'transport',
      predicate: 'The connected provider emits a binary document update.',
      producedArtifacts: ['artifact:inbound-binary-update']
    },
    {
      id: 'observe-provider-status',
      from: 'transport-provider-update',
      to: 'persist-sync-and-acknowledge',
      kind: 'observational',
      predicate:
        'Connection, reconnection, offline, failure, or disposal status changes.',
      producedArtifacts: ['artifact:provider-status']
    },
    {
      id: 'observe-durable-ack',
      from: 'transport-provider-update',
      to: 'persist-sync-and-acknowledge',
      kind: 'observational',
      predicate:
        'The provider reports durable acknowledgement or acknowledgement failure.',
      producedArtifacts: ['artifact:durable-acknowledgement']
    },
    {
      id: 'provider-failed',
      from: 'transport-provider-update',
      kind: 'terminal',
      predicate: 'Connect, send, sync, or provider lifecycle fails.',
      producedArtifacts: ['artifact:provider-failure']
    },
    {
      id: 'receive-awareness',
      from: 'transport-provider-update',
      to: 'own-awareness-state',
      kind: 'observational',
      predicate: 'The provider emits remote ephemeral presence.',
      producedArtifacts: ['artifact:inbound-awareness']
    },
    {
      id: 'clear-awareness-on-disconnect',
      from: 'transport-provider-update',
      to: 'own-awareness-state',
      kind: 'observational',
      predicate: 'A peer leaves, times out, or the provider disconnects.',
      producedArtifacts: ['artifact:awareness-disconnect']
    },
    {
      id: 'decode-operation',
      from: 'decode-inbound-update',
      to: 'validate-origin-dedupe-protocol',
      kind: 'handoff',
      predicate:
        'The binary update integrates and yields a semantic operation envelope.',
      producedArtifacts: ['artifact:decoded-operation-envelope']
    },
    {
      id: 'decode-failed',
      from: 'decode-inbound-update',
      kind: 'terminal',
      predicate: 'Binary input or operation content cannot be decoded.',
      producedArtifacts: ['artifact:inbound-decode-failure']
    },
    {
      id: 'validate-remote-operation',
      from: 'validate-origin-dedupe-protocol',
      to: 'decide-permission-conflict',
      kind: 'handoff',
      predicate:
        'Origin, identity, document, protocol, schema, route, and payload are valid and unseen.',
      producedArtifacts: ['artifact:validated-remote-operation']
    },
    {
      id: 'dedupe-remote-operation',
      from: 'validate-origin-dedupe-protocol',
      kind: 'terminal',
      predicate:
        'An identical operation id and envelope already has a recorded outcome.',
      producedArtifacts: ['artifact:duplicate-operation-outcome']
    },
    {
      id: 'reject-invalid-remote-operation',
      from: 'validate-origin-dedupe-protocol',
      kind: 'terminal',
      predicate:
        'Echo, identity collision, document mismatch, unsupported version/route, or invalid payload is detected.',
      producedArtifacts: ['artifact:remote-validation-rejection']
    },
    {
      id: 'policy-accepted-or-repaired',
      from: 'decide-permission-conflict',
      to: 'run-remote-apply-transaction',
      kind: 'handoff',
      predicate:
        'Permission passes and deterministic policy accepts or returns a schema-valid repair.',
      producedArtifacts: ['artifact:accepted-or-repaired-operation']
    },
    {
      id: 'policy-rejected',
      from: 'decide-permission-conflict',
      kind: 'terminal',
      predicate:
        'Permission or an explicitly registered app-domain policy rejects before apply.',
      producedArtifacts: ['artifact:permission-or-conflict-rejection']
    },
    {
      id: 'request-canonical-apply',
      from: 'run-remote-apply-transaction',
      to: 'apply-canonical-state-owner',
      kind: 'handoff',
      predicate: 'The remote-origin rollbackable transaction is active.',
      producedArtifacts: ['artifact:canonical-apply-request']
    },
    {
      id: 'remote-apply-failed',
      from: 'run-remote-apply-transaction',
      kind: 'terminal',
      predicate:
        'The canonical apply handler throws and Factory completes rollback or rollback-failed handling.',
      producedArtifacts: ['artifact:remote-apply-failure']
    },
    {
      id: 'canonical-state-applied',
      from: 'apply-canonical-state-owner',
      to: 'project-canonical-state',
      kind: 'handoff',
      predicate: 'Package validation and canonical mutation succeed.',
      producedArtifacts: ['artifact:canonical-state-change']
    },
    {
      id: 'state-owner-rejected',
      from: 'apply-canonical-state-owner',
      kind: 'terminal',
      predicate:
        'The owning package rejects its invariant or validation contract.',
      producedArtifacts: ['artifact:state-owner-rejection']
    },
    {
      id: 'canonical-projection-complete',
      from: 'project-canonical-state',
      kind: 'terminal',
      predicate: 'Derived Render/UI projection reflects canonical state.',
      producedArtifacts: ['artifact:canonical-projection']
    },
    {
      id: 'restore-persisted-update',
      from: 'persist-sync-and-acknowledge',
      to: 'decode-inbound-update',
      kind: 'persistence',
      predicate: 'Offline recovery loads a persisted collaboration update.',
      producedArtifacts: ['artifact:persisted-collaboration-update']
    },
    {
      id: 'collaboration-persistence-failed',
      from: 'persist-sync-and-acknowledge',
      kind: 'terminal',
      predicate:
        'The optional update persistence adapter rejects load or storage acknowledgement.',
      producedArtifacts: ['artifact:collaboration-persistence-failure']
    },
    {
      id: 'network-converged',
      from: 'persist-sync-and-acknowledge',
      kind: 'terminal',
      predicate:
        'State-vector exchange delivers all missing updates and peers converge.',
      producedArtifacts: ['artifact:network-convergence']
    },
    {
      id: 'durability-observed',
      from: 'persist-sync-and-acknowledge',
      kind: 'terminal',
      predicate:
        'Durable acknowledgement or failure is recorded separately from runtime commit.',
      producedArtifacts: ['artifact:durability-outcome']
    },
    {
      id: 'send-awareness',
      from: 'own-awareness-state',
      to: 'transport-provider-update',
      kind: 'observational',
      predicate: 'Local presence changes while a provider is available.',
      producedArtifacts: ['artifact:outbound-awareness']
    },
    {
      id: 'project-remote-awareness',
      from: 'own-awareness-state',
      to: 'project-awareness-state',
      kind: 'observational',
      predicate: 'A remote presence snapshot is added or updated.',
      producedArtifacts: ['artifact:remote-awareness-snapshot']
    },
    {
      id: 'project-awareness-removal',
      from: 'own-awareness-state',
      to: 'project-awareness-state',
      kind: 'observational',
      predicate: 'Disconnect, leave, or timeout removes remote presence.',
      producedArtifacts: ['artifact:awareness-cleared']
    },
    {
      id: 'awareness-projected',
      from: 'project-awareness-state',
      kind: 'terminal',
      predicate: 'The app optionally displays ephemeral presence.',
      producedArtifacts: ['artifact:awareness-projection']
    }
  ]

  const artifacts = [
    [
      'collaboration-composition',
      'compose-collaboration-opt-in',
      ['own-collaboration-instance'],
      false,
      'composition'
    ],
    [
      'collaboration-disabled',
      'compose-collaboration-opt-in',
      [],
      true,
      'terminal'
    ],
    [
      'collaboration-instance',
      'own-collaboration-instance',
      ['publish-local-committed-change', 'own-awareness-state'],
      false,
      'instance'
    ],
    [
      'provider-composition',
      'own-collaboration-instance',
      ['transport-provider-update'],
      false,
      'composition'
    ],
    [
      'no-provider-composition',
      'own-collaboration-instance',
      ['transport-provider-update'],
      false,
      'bypass'
    ],
    ['instance-disposed', 'own-collaboration-instance', [], true, 'terminal'],
    [
      'local-shared-delivery',
      'publish-local-committed-change',
      [],
      true,
      'local'
    ],
    [
      'local-action-publication',
      'publish-local-committed-change',
      ['create-shared-operation-envelope'],
      false,
      'local'
    ],
    [
      'local-action-discard',
      'publish-local-committed-change',
      [],
      true,
      'terminal'
    ],
    [
      'shared-operation-envelope-batch',
      'create-shared-operation-envelope',
      ['append-yjs-update'],
      false,
      'semantic'
    ],
    [
      'local-operation-rejection',
      'create-shared-operation-envelope',
      [],
      true,
      'terminal'
    ],
    [
      'yjs-binary-update',
      'append-yjs-update',
      ['transport-provider-update', 'persist-sync-and-acknowledge'],
      false,
      'binary'
    ],
    ['yjs-append-failure', 'append-yjs-update', [], true, 'terminal'],
    [
      'provider-status',
      'transport-provider-update',
      ['persist-sync-and-acknowledge'],
      false,
      'status'
    ],
    [
      'inbound-binary-update',
      'transport-provider-update',
      ['decode-inbound-update'],
      false,
      'binary'
    ],
    [
      'durable-acknowledgement',
      'transport-provider-update',
      ['persist-sync-and-acknowledge'],
      false,
      'status'
    ],
    ['provider-failure', 'transport-provider-update', [], true, 'terminal'],
    [
      'inbound-awareness',
      'transport-provider-update',
      ['own-awareness-state'],
      false,
      'ephemeral'
    ],
    [
      'awareness-disconnect',
      'transport-provider-update',
      ['own-awareness-state'],
      false,
      'ephemeral'
    ],
    [
      'decoded-operation-envelope',
      'decode-inbound-update',
      ['validate-origin-dedupe-protocol'],
      false,
      'semantic'
    ],
    ['inbound-decode-failure', 'decode-inbound-update', [], true, 'terminal'],
    [
      'validated-remote-operation',
      'validate-origin-dedupe-protocol',
      ['decide-permission-conflict'],
      false,
      'semantic'
    ],
    [
      'duplicate-operation-outcome',
      'validate-origin-dedupe-protocol',
      [],
      true,
      'terminal'
    ],
    [
      'remote-validation-rejection',
      'validate-origin-dedupe-protocol',
      [],
      true,
      'terminal'
    ],
    [
      'accepted-or-repaired-operation',
      'decide-permission-conflict',
      ['run-remote-apply-transaction'],
      false,
      'semantic'
    ],
    [
      'permission-or-conflict-rejection',
      'decide-permission-conflict',
      [],
      true,
      'terminal'
    ],
    [
      'canonical-apply-request',
      'run-remote-apply-transaction',
      ['apply-canonical-state-owner'],
      false,
      'apply'
    ],
    [
      'remote-apply-failure',
      'run-remote-apply-transaction',
      [],
      true,
      'terminal'
    ],
    [
      'canonical-state-change',
      'apply-canonical-state-owner',
      ['project-canonical-state'],
      false,
      'canonical'
    ],
    [
      'state-owner-rejection',
      'apply-canonical-state-owner',
      [],
      true,
      'terminal'
    ],
    ['canonical-projection', 'project-canonical-state', [], true, 'terminal'],
    [
      'persisted-collaboration-update',
      'persist-sync-and-acknowledge',
      ['decode-inbound-update'],
      false,
      'persistence'
    ],
    [
      'collaboration-persistence-failure',
      'persist-sync-and-acknowledge',
      [],
      true,
      'terminal'
    ],
    [
      'network-convergence',
      'persist-sync-and-acknowledge',
      [],
      true,
      'terminal'
    ],
    [
      'durability-outcome',
      'persist-sync-and-acknowledge',
      [],
      true,
      'terminal'
    ],
    [
      'outbound-awareness',
      'own-awareness-state',
      ['transport-provider-update'],
      false,
      'ephemeral'
    ],
    [
      'remote-awareness-snapshot',
      'own-awareness-state',
      ['project-awareness-state'],
      false,
      'ephemeral'
    ],
    [
      'awareness-cleared',
      'own-awareness-state',
      ['project-awareness-state'],
      false,
      'ephemeral'
    ],
    ['awareness-projection', 'project-awareness-state', [], true, 'terminal']
  ].map(([id, ownerStepId, consumerStepIds, terminal, channel]) => ({
    id: `artifact:${id}`,
    title: String(id)
      .split('-')
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' '),
    ownerStepId,
    consumerStepIds,
    terminal,
    channel
  }))

  const invariants = [
    {
      id: 'explicit-opt-in',
      statement:
        'Collaboration-disabled startup creates no Y.Doc, provider, room, awareness, network, or collaboration persistence side effect.',
      stepIds: ['compose-collaboration-opt-in', 'own-collaboration-instance'],
      artifactIds: ['artifact:collaboration-disabled'],
      specRefs: ['#supported-behavior']
    },
    {
      id: 'single-canonical-owner',
      statement:
        'Yjs, provider state, operation outcomes, persistence, awareness, Render, and UI never become a second canonical document owner.',
      stepIds: [
        'append-yjs-update',
        'transport-provider-update',
        'apply-canonical-state-owner',
        'project-canonical-state',
        'own-awareness-state'
      ],
      artifactIds: [
        'artifact:shared-operation-envelope-batch',
        'artifact:canonical-state-change',
        'artifact:remote-awareness-snapshot'
      ],
      specRefs: ['#ownership-and-forbidden-boundaries']
    },
    {
      id: 'remote-ordering',
      statement:
        'Every inbound semantic operation passes origin/dedupe/schema validation and permission/conflict policy before one remote transaction and canonical apply.',
      stepIds: [
        'decode-inbound-update',
        'validate-origin-dedupe-protocol',
        'decide-permission-conflict',
        'run-remote-apply-transaction',
        'apply-canonical-state-owner'
      ],
      artifactIds: [
        'artifact:decoded-operation-envelope',
        'artifact:validated-remote-operation',
        'artifact:accepted-or-repaired-operation',
        'artifact:canonical-apply-request'
      ],
      specRefs: ['#remote-canonical-apply']
    },
    {
      id: 'undo-rollback-echo',
      statement:
        'Remote apply is excluded from local-user undo and network echo; rollback discards an unflushed immediate or transaction-end publication and emits linked compensation for an immediate publication that already flushed.',
      stepIds: [
        'publish-local-committed-change',
        'create-shared-operation-envelope',
        'run-remote-apply-transaction'
      ],
      artifactIds: [
        'artifact:local-action-discard',
        'artifact:shared-operation-envelope-batch'
      ],
      specRefs: ['#undoredo-and-rollback', '#origin-and-echo-prevention']
    },
    {
      id: 'awareness-separation',
      statement:
        'Awareness follows only the ephemeral route and is absent from Y.Doc operations, document/update persistence, authorization, and undo/redo.',
      stepIds: [
        'transport-provider-update',
        'own-awareness-state',
        'project-awareness-state'
      ],
      artifactIds: [
        'artifact:inbound-awareness',
        'artifact:remote-awareness-snapshot',
        'artifact:awareness-cleared'
      ],
      specRefs: ['#awareness-and-presence']
    },
    {
      id: 'distinct-acknowledgements',
      statement:
        'Runtime commit, local update persistence, network convergence, and durable server acknowledgement remain distinct outcomes.',
      stepIds: [
        'publish-local-committed-change',
        'transport-provider-update',
        'persist-sync-and-acknowledge'
      ],
      artifactIds: [
        'artifact:local-action-publication',
        'artifact:network-convergence',
        'artifact:durability-outcome'
      ],
      specRefs: ['#persistence-and-offline-behavior']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'composition-provider-lifecycle',
      title: 'Opt-in, ownership, provider lifecycle, and isolation',
      stepIds: [
        'compose-collaboration-opt-in',
        'own-collaboration-instance',
        'transport-provider-update'
      ],
      specRefs: [
        '#representative-product-cases',
        '#bounded-definition-of-done'
      ],
      assertions: [
        'Disabled, no-provider, connect, disconnect, reconnect, connection failure, acknowledgement failure, disposal, independent instances, intentional shared wiring, and one-instance disposal are formal cases.'
      ]
    },
    {
      id: 'transport-convergence',
      title: 'Envelope, dedupe, transport, reconnect, and convergence',
      stepIds: [
        'create-shared-operation-envelope',
        'append-yjs-update',
        'transport-provider-update',
        'decode-inbound-update',
        'validate-origin-dedupe-protocol',
        'persist-sync-and-acknowledge'
      ],
      specRefs: ['#representative-product-cases'],
      assertions: [
        'Two-client convergence, duplicate, delayed, reordered, replayed, invalid protocol/schema/route/payload, offline recovery, and state-vector missing-update synchronization are formal cases.',
        'One immediate delivery action or committed transaction-end batch produces one Yjs update and one provider send even when multiple affected elements contribute ordered semantic changes.',
        'One outer pointer session may produce mouse-down, selected drag-update, and mouse-up publications while remaining one local undo commit.'
      ]
    },
    {
      id: 'canonical-apply-history',
      title:
        'Permission, canonical apply, echo, undo, rollback, and publication discard',
      stepIds: [
        'publish-local-committed-change',
        'decide-permission-conflict',
        'run-remote-apply-transaction',
        'apply-canonical-state-owner',
        'project-canonical-state'
      ],
      specRefs: ['#representative-product-cases'],
      assertions: [
        'Unauthorized, unsupported, remote apply failure, echo prevention, local-user-only undo, pre-flush discard, post-flush compensation, transaction-end rollback discard, immediate canonical transport, and projection ordering are formal cases.'
      ]
    },
    {
      id: 'conflict-policy',
      title: 'Deterministic permission and app conflict policy',
      stepIds: ['decide-permission-conflict', 'apply-canonical-state-owner'],
      specRefs: [
        '#conflict-policy',
        './collaborative-conflict-policies-plan.md#definition-of-done'
      ],
      assertions: [
        'Permission plus explicitly registered app-domain accept, repair, reject, and not-applicable outcomes are deterministic and execute before canonical commit; package invariants remain in canonical owners.'
      ]
    },
    {
      id: 'awareness-ephemeral',
      title: 'Ephemeral awareness and cleanup',
      stepIds: [
        'transport-provider-update',
        'own-awareness-state',
        'project-awareness-state'
      ],
      specRefs: ['#awareness-and-presence', '#representative-product-cases'],
      assertions: [
        'Awareness update, disconnect/timeout cleanup, save/load/update-persistence exclusion, undo exclusion, and non-authority are formal cases.',
        'Canonical element create, geometry, style, hierarchy, and deletion changes are absent from Awareness and use document operation transport.'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'yjs-network-collaboration',
      kind: 'system',
      title: 'Yjs Network Collaboration Inspector',
      subtitle:
        'Explicit app composition through local committed operation transport, inbound canonical apply, persistence/reconnect, and separate ephemeral awareness.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Yjs Network Collaboration Plan product contract',
      inspectorOwner: 'Yjs Network Collaboration Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product Contract',
        href: './yjs-network-collaboration-plan.md',
        kind: 'authority'
      },
      {
        id: 'conflict-policy-contract',
        label: 'Conflict Policy Contract',
        href: './collaborative-conflict-policies-plan.md',
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
