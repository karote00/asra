;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/network-collaboration-transport-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/network-collaboration-transport-flow-inspector.data.cjs'

  const lanes = [
    { id: 'composition', title: 'Explicit App Composition', order: 1 },
    { id: 'local', title: 'Factory Publication', order: 2 },
    { id: 'transport', title: 'Live Provider Transport', order: 3 },
    { id: 'app', title: 'App-Owned Remote Apply', order: 4 },
    { id: 'awareness', title: 'Ephemeral Awareness', order: 5 }
  ]

  const steps = [
    {
      id: 'compose-collaboration-opt-in',
      order: 1,
      laneId: 'composition',
      title: 'Compose collaboration explicitly',
      ownerPackage: 'app composition root',
      purpose:
        'Opt one app document into collaboration without changing non-collaborative startup or HTTP/load/save behavior.',
      inputs: [
        'app collaboration choice',
        'document, room, and actor identity',
        'Factory publication source',
        'app inbound publication callback',
        'optional Provider and Awareness resources'
      ],
      outputs: [
        'artifact:collaboration-disabled',
        'artifact:collaboration-composition'
      ],
      conditions: [
        'Construction is inert and explicit start owns activation.',
        'Identity values are non-empty.',
        'Apps choose which Factory publications enter the source adapter.',
        'Apps own all payload, route, permission, ordering, and conflict meaning.'
      ],
      bypasses: [
        'When the app does not compose Collaboration, no Provider, room, Awareness runtime, or collaboration connection exists.'
      ],
      allowedContributors: [
        'public @asyra/collaboration composition API',
        'app-owned Factory publication source',
        'app-owned inbound publication callback',
        'replaceable Provider'
      ],
      forbiddenContributors: [
        'implicit Core or Preset activation',
        'framework-owned app operation registry',
        'framework permission or conflict policy',
        'Render/UI state authority'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/composition.ts',
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/index.ts',
        'packages/collaboration/src/__tests__/composition.test.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/collaboration/factory-adapter.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-lifecycle.test.ts'
      ],
      specRefs: [
        '#supported-behavior',
        '#composition-input',
        '#collaboration-disabled'
      ],
      failureOwnerStepId: 'compose-collaboration-opt-in'
    },
    {
      id: 'own-collaboration-instance',
      order: 2,
      laneId: 'composition',
      title: 'Own the collaboration lifecycle',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Bind publication and Awareness observers to the explicitly selected Provider and release owned resources deterministically.',
      inputs: ['artifact:collaboration-composition'],
      outputs: ['artifact:active-collaboration-instance'],
      conditions: [
        'start is idempotent and binds observers once.',
        'disconnect clears remote Awareness and does not request publication history.',
        'reconnect restores only the live Provider connection.',
        'dispose detaches all observers and destroys only owned resources.'
      ],
      bypasses: [
        'A provider-less explicitly created instance remains offline.',
        'Disposed queued work cannot call Provider or app callbacks.'
      ],
      allowedContributors: [
        'artifact:collaboration-composition',
        'Provider lifecycle/status',
        'owned/borrowed resource declarations'
      ],
      forbiddenContributors: [
        'Y.Doc lifecycle',
        'state-vector synchronization',
        'semantic publication persistence',
        'app payload interpretation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/provider.ts',
        'packages/collaboration/src/__tests__/composition.test.ts',
        'packages/collaboration/src/__tests__/provider-lifecycle.test.ts'
      ],
      specRefs: [
        '#supported-behavior',
        '#disconnect-and-reconnect',
        '#ownership-and-forbidden-boundaries'
      ],
      failureOwnerStepId: 'own-collaboration-instance'
    },
    {
      id: 'publish-local-shared-publication',
      order: 1,
      laneId: 'local',
      title: 'Publish one completed Factory publication',
      ownerPackage: '@asyra/factory',
      purpose:
        'Produce one ordered SharedPublication at the already-defined immediate or transaction-end settlement boundary.',
      inputs: [
        'canonical app changes',
        'Factory transaction and sharedDelivery rules',
        'artifact:active-collaboration-instance'
      ],
      outputs: ['artifact:local-shared-publication'],
      conditions: [
        'One Factory publication remains one transport unit.',
        'Delivery order and repeated application intent remain unchanged.',
        'Undo, redo, and compensation publications use the ordinary publication path.'
      ],
      bypasses: [
        'A transaction-end rollback with no publication produces no transport input.',
        'An app source adapter may omit channels according to app policy before Collaboration receives them.'
      ],
      allowedContributors: [
        'Factory shared publication settlement',
        'app-owned channel selection'
      ],
      forbiddenContributors: [
        'Collaboration feature-specific immediate rules',
        'semantic dedupe',
        'Yjs operation envelopes'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/src/shared-delivery.ts',
        'packages/factory/src/factory.ts',
        'packages/factory/src/__tests__/shared-publication.test.ts',
        'apps/asyra-design/src/collaboration/factory-adapter.ts'
      ],
      specRefs: [
        '#supported-behavior',
        '#live-two-client-publication',
        '#undo-redo-and-compensation'
      ],
      failureOwnerStepId: 'publish-local-shared-publication'
    },
    {
      id: 'handoff-local-publication',
      order: 1,
      laneId: 'transport',
      title: 'Hand off one local publication',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Pass each completed local publication to Provider once and in source order, then retain no semantic history after settlement.',
      inputs: ['artifact:local-shared-publication'],
      outputs: [
        'artifact:provider-publication-request',
        'artifact:publication-send-failure',
        'artifact:publication-send-settled'
      ],
      conditions: [
        'The publication is detached without changing metadata, delivery order, routes, payloads, or repetition.',
        'One source publication invokes Provider sendPublication at most once.',
        'The next queued source publication cannot overtake the current send.',
        'Successful or failed settlement leaves no framework semantic history.'
      ],
      bypasses: [
        'A provider-less instance records no network send.',
        'Disposed work that has not started is bypassed.'
      ],
      allowedContributors: [
        'artifact:local-shared-publication',
        'Provider send settlement',
        'transport-safe detached cloning'
      ],
      forbiddenContributors: [
        'Y.Doc',
        'operation envelope creation',
        'dedupe or identity collision registry',
        'permission or conflict decision',
        'TTL retention'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/provider.ts',
        'packages/collaboration/src/__tests__/process.test.ts',
        'packages/collaboration/src/__tests__/action-publication.test.ts'
      ],
      specRefs: [
        '#supported-behavior',
        '#provider-input-and-output',
        '#repeated-application-intent'
      ],
      failureOwnerStepId: 'handoff-local-publication'
    },
    {
      id: 'transport-live-publication',
      order: 2,
      laneId: 'transport',
      title: 'Transport to live peers',
      ownerPackage: 'replaceable Provider adapter',
      purpose:
        'Encode, send, acknowledge, and fan out a detached publication to currently connected room peers.',
      inputs: ['artifact:provider-publication-request'],
      outputs: [
        'artifact:publication-send-acknowledgement',
        'artifact:inbound-provider-publication'
      ],
      conditions: [
        'One connection preserves publication send and receive order.',
        'Only currently connected peers receive the publication.',
        'A live room actor reservation is atomic and can be released only by its owning connection.',
        'Wire validation rejects incomplete Factory transport metadata and values that JSON cannot preserve without interpreting app meaning.',
        'Promise settlement is the acknowledgement boundary.'
      ],
      bypasses: [
        'The sender is not echoed by the room Provider.',
        'Disconnected peers receive no publication and no later framework replay.'
      ],
      allowedContributors: [
        'artifact:provider-publication-request',
        'Provider identity and live room membership',
        'wire encoding and request acknowledgement'
      ],
      forbiddenContributors: [
        'room Y.Doc or publication history',
        'state vectors',
        'backend domain ordering',
        'app route or payload policy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/provider.ts',
        'packages/collaboration/src/providers/memory/hub.ts',
        'packages/collaboration/src/providers/memory/provider.ts',
        'packages/collaboration/src/__tests__/provider.test.ts',
        'apps/asyra-design/src/collaboration/protocol.ts',
        'apps/asyra-design/src/collaboration/websocket-provider.ts',
        'apps/asyra-design/collaboration-server.ts',
        'apps/asyra-design/collaboration-server.test.mjs',
        'apps/asyra-design/src/init/__tests__/collaboration-websocket-provider.test.ts'
      ],
      specRefs: [
        '#provider-input-and-output',
        '#disconnect-and-reconnect',
        '#invalid-wire-input'
      ],
      failureOwnerStepId: 'transport-live-publication'
    },
    {
      id: 'deliver-inbound-publication',
      order: 3,
      laneId: 'transport',
      title: 'Deliver one inbound publication',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Invoke the app callback once per inbound Provider publication in arrival order without semantic processing.',
      inputs: ['artifact:inbound-provider-publication'],
      outputs: [
        'artifact:app-publication-request',
        'artifact:app-publication-failure'
      ],
      conditions: [
        'The callback receives the exact detached publication plus optional transport sender context.',
        'A publication is not split into per-delivery callbacks.',
        'A synchronous or asynchronous callback settles before its outcome is reported and before the next publication advances.',
        'Equal or repeated publications are each delivered.'
      ],
      bypasses: [
        'Disposed queued work does not invoke the callback.'
      ],
      allowedContributors: [
        'artifact:inbound-provider-publication',
        'app inbound publication callback'
      ],
      forbiddenContributors: [
        'framework payload validation',
        'framework dedupe, permission, ordering, or conflict policy',
        'canonical mutation outside the app callback'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/composition.ts',
        'packages/collaboration/src/__tests__/process.test.ts'
      ],
      specRefs: [
        '#app-callback',
        '#supported-behavior',
        '#repeated-application-intent'
      ],
      failureOwnerStepId: 'deliver-inbound-publication'
    },
    {
      id: 'process-app-publication',
      order: 1,
      laneId: 'app',
      title: 'Validate and process the app publication',
      ownerPackage: 'app collaboration adapter',
      purpose:
        'Apply app-owned validation and policy, then process all publication deliveries inside one app remote transaction.',
      inputs: ['artifact:app-publication-request'],
      outputs: [
        'artifact:canonical-apply-request',
        'artifact:app-policy-rejection'
      ],
      conditions: [
        'The app owns route, schema, payload, permission, conflict, and domain-order policy.',
        'The app chooses whether unsupported or invalid input rejects the whole publication.',
        'The app remote transaction keeps remote work out of local undo and shared publication echo.'
      ],
      bypasses: [
        'An app rejection produces no canonical mutation.',
        'Apps that need backend refresh or recovery may do so outside Collaboration.'
      ],
      allowedContributors: [
        'artifact:app-publication-request',
        'app validators and domain policy',
        'Factory remote transaction boundary'
      ],
      forbiddenContributors: [
        '@asyra/collaboration semantic decisions',
        'Provider state authority',
        'Render/UI direct mutation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration/operations.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts',
        'packages/factory/src/factory.ts'
      ],
      specRefs: [
        '#app-callback',
        '#ownership-and-forbidden-boundaries',
        '#live-two-client-publication'
      ],
      failureOwnerStepId: 'process-app-publication'
    },
    {
      id: 'apply-canonical-state-owner',
      order: 2,
      laneId: 'app',
      title: 'Apply through canonical state owners',
      ownerPackage: 'app-selected canonical state owner',
      purpose:
        'Mutate canonical state through the app ordinary event/API pipeline and let ordinary projections update.',
      inputs: ['artifact:canonical-apply-request'],
      outputs: ['artifact:canonical-state-applied'],
      conditions: [
        'Remote changes use the same canonical state owners as local changes.',
        'Factory remote origin suppresses local undo/history and network echo.',
        'Render/UI observe canonical state and never replace it.'
      ],
      bypasses: [
        'A rejected app publication never reaches canonical apply.'
      ],
      allowedContributors: [
        'artifact:canonical-apply-request',
        'app event/API processor',
        'canonical state-owner invariants'
      ],
      forbiddenContributors: [
        'Provider mutation',
        'Collaboration semantic repair',
        'Awareness document transport',
        'Render-only state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration/operations.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts',
        'packages/factory/src/factory.ts'
      ],
      specRefs: [
        '#canonical-flow',
        '#live-two-client-publication',
        '#ownership-and-forbidden-boundaries'
      ],
      failureOwnerStepId: 'apply-canonical-state-owner'
    },
    {
      id: 'own-awareness-state',
      order: 1,
      laneId: 'awareness',
      title: 'Own ephemeral Awareness state',
      ownerPackage: '@asyra/collaboration Awareness',
      purpose:
        'Transport and expire observational presence independently of document publications.',
      inputs: [
        'artifact:active-collaboration-instance',
        'local presence input',
        'inbound Provider Awareness',
        'Provider disconnect'
      ],
      outputs: [
        'artifact:remote-awareness-snapshot',
        'artifact:awareness-cleared'
      ],
      conditions: [
        'Awareness is removable, actor-scoped, and clocked.',
        'Disconnect, leave, and timeout clear remote presence.',
        'Awareness never authorizes or transports canonical document mutation.'
      ],
      bypasses: [
        'Presence-free apps may never send Awareness.'
      ],
      allowedContributors: [
        'local presence input',
        'Provider Awareness messages',
        'disconnect and timeout lifecycle'
      ],
      forbiddenContributors: [
        'Factory SharedPublication',
        'canonical document state',
        'undo/redo history',
        'permission authority'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/awareness.ts',
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/__tests__/awareness.test.ts'
      ],
      specRefs: ['#supported-behavior', '#awareness'],
      failureOwnerStepId: 'own-awareness-state'
    },
    {
      id: 'project-awareness-state',
      order: 2,
      laneId: 'awareness',
      title: 'Project Awareness observations',
      ownerPackage: 'app or UI observer',
      purpose:
        'Display presence without feeding it into canonical state, save/load, permission, or undo.',
      inputs: [
        'artifact:remote-awareness-snapshot',
        'artifact:awareness-cleared'
      ],
      outputs: ['artifact:awareness-projection'],
      conditions: [
        'Presence projection is observational and removable.',
        'Canonical state remains correct when all presence is absent.'
      ],
      bypasses: ['Headless and presence-free apps may omit this projection.'],
      allowedContributors: [
        'artifact:remote-awareness-snapshot',
        'artifact:awareness-cleared',
        'app presentation policy'
      ],
      forbiddenContributors: [
        'canonical mutation',
        'permission or conflict decisions',
        'document persistence'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/__tests__/awareness.test.ts',
        'apps/asyra-design/src/collaboration'
      ],
      specRefs: ['#awareness', '#ownership-and-forbidden-boundaries'],
      failureOwnerStepId: 'project-awareness-state'
    }
  ]

  const routes = [
    {
      id: 'collaboration-disabled',
      from: 'compose-collaboration-opt-in',
      kind: 'terminal',
      predicate: 'The app does not explicitly compose Collaboration.',
      producedArtifacts: ['artifact:collaboration-disabled']
    },
    {
      id: 'compose-instance',
      from: 'compose-collaboration-opt-in',
      to: 'own-collaboration-instance',
      kind: 'handoff',
      predicate: 'The app supplies explicit collaboration inputs.',
      producedArtifacts: ['artifact:collaboration-composition']
    },
    {
      id: 'activate-publication-source',
      from: 'own-collaboration-instance',
      to: 'publish-local-shared-publication',
      kind: 'handoff',
      predicate: 'start binds the Factory publication source.',
      producedArtifacts: ['artifact:active-collaboration-instance']
    },
    {
      id: 'activate-awareness',
      from: 'own-collaboration-instance',
      to: 'own-awareness-state',
      kind: 'observational',
      predicate: 'start binds the separate Awareness route.',
      producedArtifacts: ['artifact:active-collaboration-instance']
    },
    {
      id: 'local-publication-ready',
      from: 'publish-local-shared-publication',
      to: 'handoff-local-publication',
      kind: 'handoff',
      predicate: 'Factory settles one completed publication.',
      producedArtifacts: ['artifact:local-shared-publication']
    },
    {
      id: 'request-provider-send',
      from: 'handoff-local-publication',
      to: 'transport-live-publication',
      kind: 'handoff',
      predicate: 'A Provider is connected and the instance is usable.',
      producedArtifacts: ['artifact:provider-publication-request']
    },
    {
      id: 'provider-send-failed',
      from: 'handoff-local-publication',
      kind: 'terminal',
      predicate: 'Provider send rejects.',
      producedArtifacts: ['artifact:publication-send-failure']
    },
    {
      id: 'provider-send-settled',
      from: 'handoff-local-publication',
      kind: 'terminal',
      predicate: 'Provider send settles and Collaboration discards the publication.',
      producedArtifacts: ['artifact:publication-send-settled']
    },
    {
      id: 'provider-acknowledged',
      from: 'transport-live-publication',
      kind: 'terminal',
      predicate: 'The configured transport acknowledges the send.',
      producedArtifacts: ['artifact:publication-send-acknowledgement']
    },
    {
      id: 'live-peer-received',
      from: 'transport-live-publication',
      to: 'deliver-inbound-publication',
      kind: 'handoff',
      predicate: 'A currently connected remote peer receives the publication.',
      producedArtifacts: ['artifact:inbound-provider-publication']
    },
    {
      id: 'request-app-processing',
      from: 'deliver-inbound-publication',
      to: 'process-app-publication',
      kind: 'handoff',
      predicate: 'The instance remains usable when queued inbound work runs.',
      producedArtifacts: ['artifact:app-publication-request']
    },
    {
      id: 'app-callback-failed',
      from: 'deliver-inbound-publication',
      kind: 'terminal',
      predicate: 'The app callback throws.',
      producedArtifacts: ['artifact:app-publication-failure']
    },
    {
      id: 'app-policy-rejected',
      from: 'process-app-publication',
      kind: 'terminal',
      predicate: 'App-owned validation or policy rejects the publication.',
      producedArtifacts: ['artifact:app-policy-rejection']
    },
    {
      id: 'request-canonical-apply',
      from: 'process-app-publication',
      to: 'apply-canonical-state-owner',
      kind: 'handoff',
      predicate: 'The app accepts the publication inside its remote transaction.',
      producedArtifacts: ['artifact:canonical-apply-request']
    },
    {
      id: 'canonical-state-applied',
      from: 'apply-canonical-state-owner',
      kind: 'terminal',
      predicate: 'Canonical state owners apply the app change.',
      producedArtifacts: ['artifact:canonical-state-applied']
    },
    {
      id: 'awareness-observed',
      from: 'own-awareness-state',
      to: 'project-awareness-state',
      kind: 'observational',
      predicate: 'Valid remote presence is observed.',
      producedArtifacts: ['artifact:remote-awareness-snapshot']
    },
    {
      id: 'awareness-removed',
      from: 'own-awareness-state',
      to: 'project-awareness-state',
      kind: 'observational',
      predicate: 'Presence leaves, disconnects, or expires.',
      producedArtifacts: ['artifact:awareness-cleared']
    },
    {
      id: 'awareness-projected',
      from: 'project-awareness-state',
      kind: 'terminal',
      predicate: 'The app projects or removes observational presence.',
      producedArtifacts: ['artifact:awareness-projection']
    }
  ]

  const artifacts = [
    ['artifact:collaboration-disabled', 'compose-collaboration-opt-in', [], true],
    ['artifact:collaboration-composition', 'compose-collaboration-opt-in', ['own-collaboration-instance']],
    ['artifact:active-collaboration-instance', 'own-collaboration-instance', ['publish-local-shared-publication', 'own-awareness-state']],
    ['artifact:local-shared-publication', 'publish-local-shared-publication', ['handoff-local-publication']],
    ['artifact:provider-publication-request', 'handoff-local-publication', ['transport-live-publication']],
    ['artifact:publication-send-failure', 'handoff-local-publication', [], true],
    ['artifact:publication-send-settled', 'handoff-local-publication', [], true],
    ['artifact:publication-send-acknowledgement', 'transport-live-publication', [], true],
    ['artifact:inbound-provider-publication', 'transport-live-publication', ['deliver-inbound-publication']],
    ['artifact:app-publication-request', 'deliver-inbound-publication', ['process-app-publication']],
    ['artifact:app-publication-failure', 'deliver-inbound-publication', [], true],
    ['artifact:app-policy-rejection', 'process-app-publication', [], true],
    ['artifact:canonical-apply-request', 'process-app-publication', ['apply-canonical-state-owner']],
    ['artifact:canonical-state-applied', 'apply-canonical-state-owner', [], true],
    ['artifact:remote-awareness-snapshot', 'own-awareness-state', ['project-awareness-state']],
    ['artifact:awareness-cleared', 'own-awareness-state', ['project-awareness-state']],
    ['artifact:awareness-projection', 'project-awareness-state', [], true]
  ].map(([id, ownerStepId, consumerStepIds, terminal = false]) => ({
    id,
    ownerStepId,
    consumerStepIds,
    terminal
  }))

  const invariants = [
    {
      id: 'transport-only',
      title: 'Collaboration transports but does not interpret app meaning',
      stepIds: [
        'handoff-local-publication',
        'transport-live-publication',
        'deliver-inbound-publication'
      ],
      artifactIds: [
        'artifact:local-shared-publication',
        'artifact:inbound-provider-publication'
      ],
      assertion:
        'No Y.Doc, semantic history, dedupe, permission, ordering, conflict, or app schema policy exists in framework transport.'
    },
    {
      id: 'one-publication-one-send',
      title: 'One publication stays one ordered send and one app callback',
      stepIds: [
        'publish-local-shared-publication',
        'handoff-local-publication',
        'deliver-inbound-publication'
      ],
      artifactIds: [
        'artifact:local-shared-publication',
        'artifact:provider-publication-request',
        'artifact:app-publication-request'
      ],
      assertion:
        'Multi-delivery and repeated intent stay intact; Collaboration neither splits nor deduplicates them.'
    },
    {
      id: 'no-reconnect-replay',
      title: 'Reconnect restores live transport only',
      stepIds: ['own-collaboration-instance', 'transport-live-publication'],
      artifactIds: ['artifact:active-collaboration-instance'],
      assertion:
        'Disconnected peers miss publications; app/backend recovery remains outside Collaboration.'
    },
    {
      id: 'app-canonical-owner',
      title: 'App owns semantic processing and canonical apply',
      stepIds: ['process-app-publication', 'apply-canonical-state-owner'],
      artifactIds: [
        'artifact:app-publication-request',
        'artifact:canonical-state-applied'
      ],
      assertion:
        'App validation and policy run inside the app remote transaction before canonical owners mutate.'
    },
    {
      id: 'awareness-separate',
      title: 'Awareness remains ephemeral and non-authoritative',
      stepIds: ['own-awareness-state', 'project-awareness-state'],
      artifactIds: [
        'artifact:remote-awareness-snapshot',
        'artifact:awareness-cleared'
      ],
      assertion:
        'Presence never enters SharedPublication, canonical state, permission, persistence, or undo.'
    }
  ]

  const acceptanceContracts = [
    {
      id: 'opt-in-lifecycle',
      title: 'Optional composition and deterministic lifecycle',
      stepIds: ['compose-collaboration-opt-in', 'own-collaboration-instance'],
      specRefs: ['#collaboration-disabled', '#supported-behavior'],
      assertions: [
        'Disabled apps create no collaboration connection; provider-less instances remain offline; start, disconnect, reconnect, and owned/borrowed disposal are deterministic.'
      ]
    },
    {
      id: 'live-publication-transport',
      title: 'Exact live publication transport',
      stepIds: [
        'publish-local-shared-publication',
        'handoff-local-publication',
        'transport-live-publication',
        'deliver-inbound-publication'
      ],
      specRefs: [
        '#live-two-client-publication',
        '#repeated-application-intent',
        '#undo-redo-and-compensation'
      ],
      assertions: [
        'One multi-delivery publication causes one Provider send and one app callback while preserving delivery order, repeated values, undo, redo, and compensation metadata.',
        'After acknowledgement, Collaboration retains no publication history, Y.Doc, state vector, replay buffer, dedupe registry, permission registry, conflict registry, or TTL record.'
      ]
    },
    {
      id: 'live-only-reconnect',
      title: 'Live-only room and reconnect',
      stepIds: ['own-collaboration-instance', 'transport-live-publication'],
      specRefs: ['#disconnect-and-reconnect'],
      assertions: [
        'A disconnected peer misses publications; reconnect receives only future live publications and performs no state-vector or history replay.'
      ]
    },
    {
      id: 'app-owned-semantics',
      title: 'App-owned policy and canonical apply',
      stepIds: ['process-app-publication', 'apply-canonical-state-owner'],
      specRefs: [
        '#app-callback',
        '#ownership-and-forbidden-boundaries'
      ],
      assertions: [
        'The app owns route, payload, permission, domain ordering, and conflict decisions and applies accepted deliveries inside one remote transaction without local undo or echo.'
      ]
    },
    {
      id: 'awareness-ephemeral',
      title: 'Ephemeral Awareness',
      stepIds: ['own-awareness-state', 'project-awareness-state'],
      specRefs: ['#awareness'],
      assertions: [
        'Awareness update, leave, disconnect, timeout cleanup, and absence remain observational and never transport canonical document changes.'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'network-collaboration-transport',
      kind: 'system',
      title: 'Network Collaboration Transport Inspector',
      subtitle:
        'Explicit Factory publication handoff through live Provider transport into app-owned remote canonical apply, with separate ephemeral Awareness.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Network Collaboration Transport Plan product contract',
      inspectorOwner: 'Network Collaboration Transport Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product Contract',
        href: './network-collaboration-transport-plan.md',
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
