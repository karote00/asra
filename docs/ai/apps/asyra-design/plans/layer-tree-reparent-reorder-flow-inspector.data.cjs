;(function () {
  'use strict'

  const specPath =
    'docs/ai/apps/asyra-design/plans/completed/layer-tree-reparent-reorder-plan.md'
  const inspectorPath =
    'docs/ai/apps/asyra-design/plans/layer-tree-reparent-reorder-flow-inspector.data.cjs'

  const lanes = [
    { id: 'layers-input', title: 'Layers Pointer Input', order: 1 },
    { id: 'move-intent', title: 'Source and Drop Intent', order: 2 },
    { id: 'feature', title: 'Move Feature Session', order: 3 },
    { id: 'canonical', title: 'Canonical Gate 3 Handoff', order: 4 },
    { id: 'projection', title: 'Projection and Remote Policy', order: 5 }
  ]

  const steps = [
    {
      id: 'normalize-layers-pointer-session',
      order: 1,
      laneId: 'layers-input',
      title: 'Normalize Layers pointer lifecycle',
      ownerPackage: 'asyra-design Layers pointer adapter',
      purpose:
        'Normalize Layers DOM pointer-down, pointer movement, pointer-up, capture, cancellation, and teardown into one app-owned session while keeping all preview state UI-local.',
      inputs: [
        'Layers row and empty-area DOM pointer events',
        'stable row and drop-zone identities',
        'Escape, pointer cancel, lost capture, and unmount signals'
      ],
      outputs: [
        'artifact:normalized-layer-pointer-session',
        'artifact:layer-pointer-session-bypass'
      ],
      conditions: [
        'Pointer-down records source intent and pointer identity without canonical mutation.',
        'Pointer movement crosses the documented movement threshold before drag feedback becomes active.',
        'Pointer-up, Escape, pointer cancel, lost capture, and unmount produce one deterministic end or cancel phase and clear capture.',
        'Normalized start, update, end, and cancel phases carry only ids, pointer coordinates, row zone, and cancellation reason.'
      ],
      bypasses: [
        'Editable fields, row action controls, and Group disclosure controls retain their own pointer behavior and never start a hierarchy session.',
        'Pointer-up below the movement threshold bypasses hierarchy movement and remains ordinary Layers row selection.',
        'Drop outside Layers or without a current pointer identity clears UI-only preview and emits no move request.'
      ],
      allowedContributors: [
        'React pointer events from Layers rows and empty area',
        'stable data-testid and data-layer attributes',
        'app movement threshold constant',
        'public Core feature-session facade'
      ],
      forbiddenContributors: [
        'canonical hierarchy mutation',
        'Render hit testing or display-object ancestry',
        'document-level duplicate hierarchy drag listener',
        'fixture-only event route',
        'saved or shared preview state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/constants',
        'apps/asyra-design/src/controllers',
        'apps/asyra-design/src/contents'
      ],
      specRefs: [
        '#pointer-session',
        '#drag-source-and-selected-ids',
        '#explicit-non-goals'
      ],
      failureOwnerStepId: 'normalize-layers-pointer-session'
    },
    {
      id: 'derive-layer-move-source',
      order: 1,
      laneId: 'move-intent',
      title: 'Derive selected move source intent',
      ownerPackage: 'asyra-design hierarchy move controller',
      purpose:
        'Derive one complete ID-only source plan from current app selection and canonical Layers projection without canonicalizing order or partially accepting an invalid selection.',
      inputs: [
        'artifact:normalized-layer-pointer-session',
        'app-local selected element ids',
        'canonical flattenedElementIds and elementDataMap projection'
      ],
      outputs: [
        'artifact:layer-move-source-plan',
        'artifact:layer-move-source-rejection'
      ],
      conditions: [
        'Pointer-down on an unselected eligible row replaces element selection with that row before the feature session continues.',
        'Pointer-down on a selected row retains the current selected ids as the complete candidate.',
        'Every candidate id is unique and existing; all ids are non-workspace siblings with one common parent and every source is unlocked.',
        'The source plan records the pre-session and requested source selection so commit-current cancellation is explicit.',
        'Scene Tree, not this controller, canonicalizes the final moved-id order.'
      ],
      bypasses: [
        'A locked source row, workspace source, missing id, duplicate id, mixed-parent selection, or stale projection rejects the complete source.',
        'Mixed-parent or stale input permits no subset move and never opens a hierarchy request.'
      ],
      allowedContributors: [
        'artifact:normalized-layer-pointer-session',
        'app-local selection query and selection common API',
        'canonical Preset flattened id and element data projection'
      ],
      forbiddenContributors: [
        'Render-derived source order',
        'partial selected-id filtering',
        'app canonical sibling ordering',
        'direct parentId or children mutation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/common-apis',
        'apps/asyra-design/src/controllers',
        'apps/asyra-design/src/providers'
      ],
      specRefs: [
        '#drag-source-and-selected-ids',
        '#intended-transaction-and-selection',
        '#validation-and-feedback'
      ],
      failureOwnerStepId: 'derive-layer-move-source'
    },
    {
      id: 'project-layer-drop-candidate',
      order: 2,
      laneId: 'move-intent',
      title: 'Project advisory drop target and final index',
      ownerPackage: 'asyra-design Layers drop projection',
      purpose:
        'Project one advisory before, after, inside, workspace, or invalid drop intent from canonical visible rows without mutating or repairing hierarchy.',
      inputs: [
        'artifact:normalized-layer-pointer-session',
        'artifact:layer-move-source-plan',
        'canonical visible Layers rows and elementDataMap',
        'app-local collapsed Group ids'
      ],
      outputs: [
        'artifact:valid-layer-drop-intent',
        'artifact:invalid-layer-drop-feedback'
      ],
      conditions: [
        'Before and after target the row canonical parent; inside appends to an eligible official Group; the empty Layers area appends to workspace.',
        'The requested targetIndex is measured in the final target child list after moved ids already in that parent are removed.',
        'Same-parent reorder and cross-parent reparent use the same final-list calculation.',
        'A successful inside intent on a collapsed Group requests UI-local expand behavior only after canonical commit.',
        'Exactly one stable before, after, inside, workspace, or invalid feedback state is projected.'
      ],
      bypasses: [
        'Self or selected targets, selected descendant targets, locked inside targets, unsupported containers, missing projection data, and invalid indexes produce invalid feedback and no request.',
        'A same-parent intent that resolves to existing order is passed unchanged for Scene Tree semantic no-op validation.',
        'Before or after a Group never implies inside.'
      ],
      allowedContributors: [
        'artifact:normalized-layer-pointer-session',
        'artifact:layer-move-source-plan',
        'canonical visible Layers projection',
        'official Preset Group identity',
        'workspace id from canonical parent data'
      ],
      forbiddenContributors: [
        'direct Scene Tree mutation',
        'Render hierarchy or hit testing',
        'app geometry or bounds inference',
        'Frame or arbitrary custom-container targeting',
        'fallback index correction'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/controllers',
        'apps/asyra-design/src/contents',
        'apps/asyra-design/src/providers'
      ],
      specRefs: [
        '#drop-zones-and-target-meaning',
        '#target-index',
        '#validation-and-feedback'
      ],
      failureOwnerStepId: 'project-layer-drop-candidate'
    },
    {
      id: 'execute-layer-move-session',
      order: 1,
      laneId: 'feature',
      title: 'Execute one hierarchy move feature session',
      ownerPackage: 'asyra-design Layer hierarchy move feature',
      purpose:
        'Own one priority 110 exclusive feature session with cancelPolicy commit-current, apply source selection, emit exactly one hierarchy request on valid end, and settle canonical post-selection.',
      inputs: [
        'artifact:normalized-layer-pointer-session',
        'artifact:layer-move-source-plan',
        'artifact:valid-layer-drop-intent',
        'artifact:canonical-layer-move-result',
        'artifact:canonical-layer-move-rejection',
        'artifact:canonical-layer-move-noop'
      ],
      outputs: [
        'artifact:layer-move-request',
        'artifact:committed-layer-move-session',
        'artifact:cancelled-layer-move-session',
        'artifact:layer-move-session-failure'
      ],
      conditions: [
        'The registered session declares priority 110, exclusive true, and cancelPolicy commit-current.',
        'Start applies an unselected-row source selection inside the same intended transaction and stores the complete source plan.',
        'Update changes UI-local drop intent and feedback only.',
        'A valid end invokes exactly one hierarchyApis.moveElements request with elementIds, targetParentId, and final targetIndex.',
        'A successful drop selects the moved ids in the canonical moved order returned by Scene Tree.',
        'A same-parent semantic no-op creates no hierarchy history or publication while retaining the explicit source-selection outcome.'
      ],
      bypasses: [
        'Below-threshold pointer-up ends as ordinary Layers row selection without a hierarchy request.',
        'Escape, pointer cancel, lost capture, unmount, outside drop, or invalid target clears preview and commits only an already-applied source selection.',
        'Handler error or timeout forces Factory rollback of selection, hierarchy, properties, and Group geometry.'
      ],
      allowedContributors: [
        'artifact:normalized-layer-pointer-session',
        'artifact:layer-move-source-plan',
        'artifact:valid-layer-drop-intent',
        'app selection and hierarchy common APIs',
        'public Core feature-session and transaction ownership'
      ],
      forbiddenContributors: [
        'more than one canonical move request per drop',
        'canonical mutation during update',
        'manual geometry conversion',
        'delete-and-recreate movement',
        'Render-only reorder or reparent'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/constants',
        'apps/asyra-design/src/controllers',
        'apps/asyra-design/src/features',
        'apps/asyra-design/src/common-apis'
      ],
      specRefs: [
        '#pointer-session',
        '#intended-transaction-and-selection',
        '#formal-test-plan'
      ],
      failureOwnerStepId: 'execute-layer-move-session'
    },
    {
      id: 'settle-canonical-layer-move',
      order: 1,
      laneId: 'canonical',
      title: 'Settle canonical Scene Tree, Preset, and Factory handoff',
      ownerPackage: 'Gate 3 Scene Tree, Preset, and Factory owners',
      purpose:
        'Pass one unchanged ID-based request through Scene Tree validation, Preset Group geometry normalization, and one Factory transaction, undo, and publication boundary.',
      inputs: [
        'artifact:layer-move-request',
        'artifact:accepted-remote-layer-move-request'
      ],
      outputs: [
        'artifact:canonical-layer-move-result',
        'artifact:canonical-layer-move-rejection',
        'artifact:canonical-layer-move-noop',
        'artifact:grouped-layer-move-publication'
      ],
      conditions: [
        'Scene Tree remains the sole complete validation and hierarchy mutation owner for ids, membership, source order, target container, final index, self-parenting, and cycles.',
        'Preset alone preserves world-space appearance and official Group bounds when the move crosses a Group boundary.',
        'Factory settles one completed request as one transaction, undo entry, rollback unit, and grouped publication.',
        'Entity and nested Group identity are preserved without delete and recreate.',
        'A same-parent no-op succeeds with no history entry and no publication.'
      ],
      bypasses: [
        'Canonical rejection occurs before mutation or rolls back every recorded selection, hierarchy, and property write.',
        'No app reinterpretation may retry a rejection with a selected subset, changed target parent, or changed target index.',
        'Remote origin is rollbackable, non-undoable, and suppresses outbound echo.'
      ],
      allowedContributors: [
        'artifact:layer-move-request',
        'artifact:accepted-remote-layer-move-request',
        'public hierarchyApis.moveElements adapter',
        'Gate 3 canonical hierarchy and transaction contracts'
      ],
      forbiddenContributors: [
        'app hierarchy validation replacing Scene Tree',
        'app coordinate or Group-bounds mutation',
        'delete plus recreate',
        'split history or publication',
        'Collaboration conflict policy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/common-apis',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/e2e'
      ],
      specRefs: [
        '#framework-owners-retained-from-gate-3',
        '#target-index',
        '#projection-geometry-and-identity',
        '#saveload-and-collaboration'
      ],
      failureOwnerStepId: 'settle-canonical-layer-move'
    },
    {
      id: 'project-layer-move-result',
      order: 1,
      laneId: 'projection',
      title: 'Project committed Layers and Render result',
      ownerPackage: 'asyra-design Layers projection and Gate 3 Render handoff',
      purpose:
        'Refresh canonical Layers rows, clear all drag feedback, reveal an accepted collapsed-Group inside drop, and verify identity-safe Render projection.',
      inputs: [
        'artifact:committed-layer-move-session',
        'artifact:canonical-layer-move-result',
        'artifact:invalid-layer-drop-feedback',
        'canonical hierarchy projection after undo, redo, load, or accepted remote apply'
      ],
      outputs: [
        'artifact:layer-move-presentation-state',
        'artifact:identity-safe-layer-move-render',
        'artifact:layer-move-projection-failure'
      ],
      conditions: [
        'Commit, undo, redo, load, and accepted remote results refresh rows only from canonical flattenedElementIds and elementDataMap.',
        'Every end or cancel clears insertion, invalid, pointer-capture, and preview state.',
        'A committed inside drop expands the accepted collapsed Group in UI-local state.',
        'Render retains the same entity and engine handle while applying canonical parent and sibling order.',
        'Same-parent reorder and cross-parent reparent show no visible canvas jump, duplicate row, duplicate visual, or stale parent.'
      ],
      bypasses: [
        'Pointer preview, insertion feedback, and expanded-after-drop state are not saved or shared.',
        'Malformed or stale canonical projection fails visibly at this owner and never constructs fallback rows.',
        'Cancelled and rejected sessions project no speculative hierarchy.'
      ],
      allowedContributors: [
        'artifact:committed-layer-move-session',
        'artifact:canonical-layer-move-result',
        'artifact:invalid-layer-drop-feedback',
        'canonical Preset UI projection',
        'Gate 3 identity-safe Render result'
      ],
      forbiddenContributors: [
        'second hierarchy or mutation-time tree cache',
        'Render-only hierarchy or app-specific visual repair',
        'delete-and-recreate projection',
        'preview-derived canonical output',
        'fixture-specific row exception'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/contents',
        'apps/asyra-design/src/controllers',
        'apps/asyra-design/src/providers',
        'apps/asyra-design/e2e'
      ],
      specRefs: [
        '#projection-geometry-and-identity',
        '#saveload-and-collaboration',
        '#product-cases'
      ],
      failureOwnerStepId: 'project-layer-move-result'
    },
    {
      id: 'apply-app-remote-layer-move-policy',
      order: 2,
      laneId: 'projection',
      title: 'Apply app-owned remote move policy',
      ownerPackage: 'asyra-design collaboration adapter',
      purpose:
        'Decide remote permission, domain ordering, duplicate, and concurrent move conflict policy before one accepted remote Factory transaction.',
      inputs: [
        'received remote hierarchy publication',
        'app/backend permission, domain ordering, duplicate, and conflict decision'
      ],
      outputs: [
        'artifact:accepted-remote-layer-move-request',
        'artifact:rejected-remote-layer-move-publication'
      ],
      conditions: [
        'The app validates route, payload, permission, domain ordering, duplicate, and conflict policy before canonical apply.',
        'An accepted move enters one remote non-undoable Factory transaction and the ordinary Scene Tree validation route.',
        'Receiving-app selection, pointer preview, and collapsed state remain local.'
      ],
      bypasses: [
        'Rejected, unauthorized, stale, duplicate, or conflicting publication performs no canonical mutation.',
        'Collaboration remains transport-only and adds no dedupe, LWW, timestamp ordering, conflict resolution, convergence registry, or semantic history.'
      ],
      allowedContributors: [
        'received transport publication',
        'app collaboration publication processor',
        'app/backend remote policy',
        'public Factory remote transaction boundary'
      ],
      forbiddenContributors: [
        '@asyra/collaboration semantic policy',
        'Provider timestamp authority',
        'remote selection takeover',
        'partial apply before policy validation',
        'Render or Layers conflict repair'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/e2e'
      ],
      specRefs: [
        '#saveload-and-collaboration',
        '#framework-owners-retained-from-gate-3',
        '#explicit-non-goals'
      ],
      failureOwnerStepId: 'apply-app-remote-layer-move-policy'
    }
  ]

  const routes = [
    {
      id: 'pointer-session-to-source-intent',
      from: 'normalize-layers-pointer-session',
      to: 'derive-layer-move-source',
      kind: 'session',
      predicate: 'eligible Layers row pointer-down',
      producedArtifacts: ['artifact:normalized-layer-pointer-session']
    },
    {
      id: 'pointer-session-to-drop-projection',
      from: 'normalize-layers-pointer-session',
      to: 'project-layer-drop-candidate',
      kind: 'session',
      predicate: 'pointer movement reaches a visible drop zone',
      producedArtifacts: ['artifact:normalized-layer-pointer-session']
    },
    {
      id: 'pointer-session-to-feature',
      from: 'normalize-layers-pointer-session',
      to: 'execute-layer-move-session',
      kind: 'session',
      predicate: 'normalized start, update, end, or cancel phase',
      producedArtifacts: ['artifact:normalized-layer-pointer-session']
    },
    {
      id: 'pointer-session-bypasses',
      from: 'normalize-layers-pointer-session',
      kind: 'terminal',
      predicate: 'editable/action/disclosure target or non-session pointer input',
      producedArtifacts: ['artifact:layer-pointer-session-bypass']
    },
    {
      id: 'source-plan-to-drop-projection',
      from: 'derive-layer-move-source',
      to: 'project-layer-drop-candidate',
      kind: 'intent',
      predicate: 'the complete selected source is app-eligible',
      producedArtifacts: ['artifact:layer-move-source-plan']
    },
    {
      id: 'source-plan-to-feature',
      from: 'derive-layer-move-source',
      to: 'execute-layer-move-session',
      kind: 'intent',
      predicate: 'source selection and candidate ids are complete',
      producedArtifacts: ['artifact:layer-move-source-plan']
    },
    {
      id: 'source-rejection-terminates',
      from: 'derive-layer-move-source',
      kind: 'terminal',
      predicate: 'locked, stale, workspace, duplicate, or mixed-parent source',
      producedArtifacts: ['artifact:layer-move-source-rejection']
    },
    {
      id: 'valid-drop-to-feature',
      from: 'project-layer-drop-candidate',
      to: 'execute-layer-move-session',
      kind: 'intent',
      predicate: 'one advisory target parent and final index are available',
      producedArtifacts: ['artifact:valid-layer-drop-intent']
    },
    {
      id: 'invalid-drop-to-presentation',
      from: 'project-layer-drop-candidate',
      to: 'project-layer-move-result',
      kind: 'presentation',
      predicate: 'the current target is advisory-invalid',
      producedArtifacts: ['artifact:invalid-layer-drop-feedback']
    },
    {
      id: 'feature-requests-canonical-move',
      from: 'execute-layer-move-session',
      to: 'settle-canonical-layer-move',
      kind: 'command',
      predicate: 'valid above-threshold pointer-up',
      producedArtifacts: ['artifact:layer-move-request']
    },
    {
      id: 'feature-cancel-terminates',
      from: 'execute-layer-move-session',
      kind: 'terminal',
      predicate: 'cancel, outside, invalid, or below-threshold end',
      producedArtifacts: ['artifact:cancelled-layer-move-session']
    },
    {
      id: 'feature-failure-terminates',
      from: 'execute-layer-move-session',
      kind: 'terminal',
      predicate: 'handler error, timeout, or rollback failure',
      producedArtifacts: ['artifact:layer-move-session-failure']
    },
    {
      id: 'canonical-result-to-feature',
      from: 'settle-canonical-layer-move',
      to: 'execute-layer-move-session',
      kind: 'result',
      predicate: 'Scene Tree accepts and mutates the request',
      producedArtifacts: ['artifact:canonical-layer-move-result']
    },
    {
      id: 'canonical-result-to-projection',
      from: 'settle-canonical-layer-move',
      to: 'project-layer-move-result',
      kind: 'projection',
      predicate: 'accepted local or remote canonical move settles',
      producedArtifacts: ['artifact:canonical-layer-move-result']
    },
    {
      id: 'canonical-rejection-to-feature',
      from: 'settle-canonical-layer-move',
      to: 'execute-layer-move-session',
      kind: 'failure',
      predicate: 'Scene Tree rejects the unchanged request',
      producedArtifacts: ['artifact:canonical-layer-move-rejection']
    },
    {
      id: 'canonical-noop-to-feature',
      from: 'settle-canonical-layer-move',
      to: 'execute-layer-move-session',
      kind: 'result',
      predicate: 'same-parent final order is unchanged',
      producedArtifacts: ['artifact:canonical-layer-move-noop']
    },
    {
      id: 'feature-commit-to-projection',
      from: 'execute-layer-move-session',
      to: 'project-layer-move-result',
      kind: 'projection',
      predicate: 'canonical result and moved-id selection commit together',
      producedArtifacts: ['artifact:committed-layer-move-session']
    },
    {
      id: 'publication-settles',
      from: 'settle-canonical-layer-move',
      kind: 'terminal',
      predicate: 'one local completed move publishes once',
      producedArtifacts: ['artifact:grouped-layer-move-publication']
    },
    {
      id: 'remote-policy-accepted',
      from: 'apply-app-remote-layer-move-policy',
      to: 'settle-canonical-layer-move',
      kind: 'remote',
      predicate: 'app/backend policy accepts the publication',
      producedArtifacts: ['artifact:accepted-remote-layer-move-request']
    },
    {
      id: 'remote-policy-rejected',
      from: 'apply-app-remote-layer-move-policy',
      kind: 'terminal',
      predicate: 'app/backend policy rejects before mutation',
      producedArtifacts: ['artifact:rejected-remote-layer-move-publication']
    },
    {
      id: 'layers-presentation-terminates',
      from: 'project-layer-move-result',
      kind: 'terminal',
      predicate: 'canonical rows and UI-only feedback settle',
      producedArtifacts: ['artifact:layer-move-presentation-state']
    },
    {
      id: 'render-projection-terminates',
      from: 'project-layer-move-result',
      kind: 'terminal',
      predicate: 'identity-safe Render handoff is verified',
      producedArtifacts: ['artifact:identity-safe-layer-move-render']
    },
    {
      id: 'projection-failure-terminates',
      from: 'project-layer-move-result',
      kind: 'terminal',
      predicate: 'canonical projection is malformed or stale',
      producedArtifacts: ['artifact:layer-move-projection-failure']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:normalized-layer-pointer-session',
      ownerStepId: 'normalize-layers-pointer-session',
      channel: 'app feature-session phases',
      consumerStepIds: [
        'derive-layer-move-source',
        'project-layer-drop-candidate',
        'execute-layer-move-session'
      ],
      terminal: false
    },
    {
      id: 'artifact:layer-pointer-session-bypass',
      ownerStepId: 'normalize-layers-pointer-session',
      channel: 'terminal UI bypass',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:layer-move-source-plan',
      ownerStepId: 'derive-layer-move-source',
      channel: 'app ID-only intent',
      consumerStepIds: [
        'project-layer-drop-candidate',
        'execute-layer-move-session'
      ],
      terminal: false
    },
    {
      id: 'artifact:layer-move-source-rejection',
      ownerStepId: 'derive-layer-move-source',
      channel: 'terminal app rejection',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:valid-layer-drop-intent',
      ownerStepId: 'project-layer-drop-candidate',
      channel: 'advisory UI intent',
      consumerStepIds: ['execute-layer-move-session'],
      terminal: false
    },
    {
      id: 'artifact:invalid-layer-drop-feedback',
      ownerStepId: 'project-layer-drop-candidate',
      channel: 'UI-local presentation',
      consumerStepIds: ['project-layer-move-result'],
      terminal: false
    },
    {
      id: 'artifact:layer-move-request',
      ownerStepId: 'execute-layer-move-session',
      channel: 'app common API',
      consumerStepIds: ['settle-canonical-layer-move'],
      terminal: false
    },
    {
      id: 'artifact:committed-layer-move-session',
      ownerStepId: 'execute-layer-move-session',
      channel: 'Factory transaction outcome',
      consumerStepIds: ['project-layer-move-result'],
      terminal: false
    },
    {
      id: 'artifact:cancelled-layer-move-session',
      ownerStepId: 'execute-layer-move-session',
      channel: 'terminal session result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:layer-move-session-failure',
      ownerStepId: 'execute-layer-move-session',
      channel: 'terminal rollback result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:canonical-layer-move-result',
      ownerStepId: 'settle-canonical-layer-move',
      channel: 'Scene Tree canonical result',
      consumerStepIds: [
        'execute-layer-move-session',
        'project-layer-move-result'
      ],
      terminal: false
    },
    {
      id: 'artifact:canonical-layer-move-rejection',
      ownerStepId: 'settle-canonical-layer-move',
      channel: 'canonical failure result',
      consumerStepIds: ['execute-layer-move-session'],
      terminal: false
    },
    {
      id: 'artifact:canonical-layer-move-noop',
      ownerStepId: 'settle-canonical-layer-move',
      channel: 'canonical semantic no-op',
      consumerStepIds: ['execute-layer-move-session'],
      terminal: false
    },
    {
      id: 'artifact:grouped-layer-move-publication',
      ownerStepId: 'settle-canonical-layer-move',
      channel: 'Factory shared publication',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:layer-move-presentation-state',
      ownerStepId: 'project-layer-move-result',
      channel: 'terminal Layers UI state',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:identity-safe-layer-move-render',
      ownerStepId: 'project-layer-move-result',
      channel: 'terminal Render evidence',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:layer-move-projection-failure',
      ownerStepId: 'project-layer-move-result',
      channel: 'terminal projection failure',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:accepted-remote-layer-move-request',
      ownerStepId: 'apply-app-remote-layer-move-policy',
      channel: 'app remote Factory transaction',
      consumerStepIds: ['settle-canonical-layer-move'],
      terminal: false
    },
    {
      id: 'artifact:rejected-remote-layer-move-publication',
      ownerStepId: 'apply-app-remote-layer-move-policy',
      channel: 'terminal app policy result',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const invariants = [
    {
      id: 'preview-never-becomes-hierarchy',
      title: 'Drag preview never becomes canonical hierarchy',
      statement:
        'Layers source, target, insertion, invalid, and expansion state remain advisory UI data while Scene Tree alone validates and mutates hierarchy.',
      stepIds: [
        'normalize-layers-pointer-session',
        'derive-layer-move-source',
        'project-layer-drop-candidate',
        'settle-canonical-layer-move',
        'project-layer-move-result'
      ],
      artifactIds: [
        'artifact:normalized-layer-pointer-session',
        'artifact:valid-layer-drop-intent',
        'artifact:canonical-layer-move-result'
      ],
      specRefs: [
        '#validation-and-feedback',
        '#projection-geometry-and-identity'
      ]
    },
    {
      id: 'one-drop-one-transaction',
      title: 'One completed drop has one atomic history boundary',
      statement:
        'Source selection, one canonical move, Preset geometry, and post-selection commit or roll back as one intended Factory transaction.',
      stepIds: [
        'derive-layer-move-source',
        'execute-layer-move-session',
        'settle-canonical-layer-move'
      ],
      artifactIds: [
        'artifact:layer-move-source-plan',
        'artifact:committed-layer-move-session',
        'artifact:grouped-layer-move-publication'
      ],
      specRefs: ['#intended-transaction-and-selection']
    },
    {
      id: 'identity-and-geometry-stay-gate3-owned',
      title: 'Preset and Render retain Gate 3 geometry and identity contracts',
      statement:
        'The app emits ids and target intent only; Preset preserves supported Group geometry and Render reuses canonical entity and engine identity.',
      stepIds: ['settle-canonical-layer-move', 'project-layer-move-result'],
      artifactIds: [
        'artifact:canonical-layer-move-result',
        'artifact:identity-safe-layer-move-render'
      ],
      specRefs: ['#projection-geometry-and-identity']
    },
    {
      id: 'remote-policy-remains-app-owned',
      title: 'Collaboration remains transport-only',
      statement:
        'App/backend policy owns remote permission, ordering, duplicates, and conflicts; Collaboration adds no semantic state.',
      stepIds: [
        'apply-app-remote-layer-move-policy',
        'settle-canonical-layer-move'
      ],
      artifactIds: [
        'artifact:accepted-remote-layer-move-request',
        'artifact:rejected-remote-layer-move-publication'
      ],
      specRefs: ['#saveload-and-collaboration']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'source-and-drop-product-cases',
      title: 'Source selection, zones, and target-index cases',
      assertions: [
        'Reorder one and several canonical siblings earlier and later in workspace and inside one Group.',
        'Reparent elements into expanded and collapsed official Groups and move Group children back to workspace.',
        'Move a nested Group across parents while preserving exact identity and canonical selected order.',
        'Before, after, inside, and workspace targets use the final-target-list index contract without fallback correction.'
      ],
      stepIds: [
        'normalize-layers-pointer-session',
        'derive-layer-move-source',
        'project-layer-drop-candidate'
      ],
      specRefs: [
        '#drag-source-and-selected-ids',
        '#drop-zones-and-target-meaning',
        '#target-index',
        '#product-cases'
      ]
    },
    {
      id: 'pointer-cancel-product-cases',
      title: 'Pointer threshold and deterministic cancellation',
      assertions: [
        'Click and below-threshold movement retain ordinary selection without a hierarchy request.',
        'Escape, pointer cancel, lost capture, unmount, invalid target, and outside drop clear feedback without canonical mutation.',
        'An unselected-row source selection follows explicit commit-current cancellation behavior.'
      ],
      stepIds: [
        'normalize-layers-pointer-session',
        'execute-layer-move-session',
        'project-layer-move-result'
      ],
      specRefs: ['#pointer-session', '#intended-transaction-and-selection']
    },
    {
      id: 'invalid-move-product-cases',
      title: 'Complete invalid-source and invalid-target rejection',
      assertions: [
        'Reject mixed-parent, locked, missing, workspace, self, descendant, duplicate, unsupported-container, and invalid index cases without partial state.',
        'Canonical rejection is never retried with a transformed subset, parent, or index.'
      ],
      stepIds: [
        'derive-layer-move-source',
        'project-layer-drop-candidate',
        'execute-layer-move-session',
        'settle-canonical-layer-move'
      ],
      specRefs: ['#validation-and-feedback', '#product-cases']
    },
    {
      id: 'transaction-history-product-cases',
      title: 'Atomic move, rollback, undo, redo, and publication',
      assertions: [
        'One completed move is one intended transaction, undo unit, and grouped publication with source and post-selection.',
        'No-op, rejection, hover, update, and cancellation create no hierarchy history or publication.',
        'Failure rollback and undo/redo restore exact selection, identity, parent, index, order, Group data, and geometry.'
      ],
      stepIds: [
        'execute-layer-move-session',
        'settle-canonical-layer-move'
      ],
      specRefs: [
        '#intended-transaction-and-selection',
        '#saveload-and-collaboration'
      ]
    },
    {
      id: 'projection-identity-product-cases',
      title: 'Canonical Layers and identity-safe Render projection',
      assertions: [
        'Canonical rows refresh after commit, undo, redo, load, and remote apply while all preview state clears.',
        'Accepted collapsed-Group inside drops reveal the result through UI-local expansion.',
        'The same entity and engine handle move with no canvas jump, duplicate row, duplicate visual, or stale parent.'
      ],
      stepIds: [
        'settle-canonical-layer-move',
        'project-layer-move-result'
      ],
      specRefs: ['#projection-geometry-and-identity', '#product-cases']
    },
    {
      id: 'remote-persistence-and-dod',
      title: 'Persistence, remote policy, isolation, and completion gates',
      assertions: [
        'Save/load and accepted remote apply preserve exact hierarchy, nested Group data, geometry, identity, and separate instances.',
        'Receiving selection and presentation state remain local while app/backend policy accepts or rejects remote moves.',
        'All Inspector, app/package, integration, TypeScript/build, dependency, lint, root build, E2E, collaboration, and synchronized visual gates pass.',
        'No second hierarchy, delete/recreate, app geometry fallback, Render workaround, or Collaboration conflict policy is introduced.',
        'The user manual review occurs before closeout, and this App PR is not merged automatically.'
      ],
      stepIds: [
        'normalize-layers-pointer-session',
        'derive-layer-move-source',
        'project-layer-drop-candidate',
        'execute-layer-move-session',
        'settle-canonical-layer-move',
        'project-layer-move-result',
        'apply-app-remote-layer-move-policy'
      ],
      specRefs: [
        '#saveload-and-collaboration',
        '#definition-of-done',
        '#manual-review-checklist'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'asyra-design-layer-tree-reparent-reorder',
      kind: 'feature',
      title: 'Asyra Design Layer Tree Reparent and Reorder Inspector',
      subtitle:
        'Layers pointer intent through one app feature session, canonical Gate 3 move settlement, identity-safe projection, and app-owned remote policy.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Asyra Design Layer Tree Reparent and Reorder Plan',
      inspectorOwner: 'Layer Tree Reparent and Reorder owner flow'
    },
    links: [
      {
        id: 'layer-tree-move-plan',
        kind: 'authority',
        label: 'Product contract',
        href: './completed/layer-tree-reparent-reorder-plan.md'
      },
      {
        id: 'group-interaction-prerequisite',
        kind: 'authority',
        label: 'Group Interaction prerequisite',
        href: './completed/group-interaction-mvp-plan.md'
      }
    ],
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  }

  const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
      return value
    }
    Object.values(value).forEach(deepFreeze)
    return Object.freeze(value)
  }

  deepFreeze(data)
  globalThis.FLOW_INSPECTOR_DATA = data

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = data
  }
})()
