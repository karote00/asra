;(function () {
  'use strict'

  const specPath =
    'docs/ai/apps/asyra-design/plans/group-interaction-mvp-plan.md'
  const inspectorPath =
    'docs/ai/apps/asyra-design/plans/group-interaction-mvp-flow-inspector.data.cjs'

  const lanes = [
    { id: 'commands', title: 'App Command Intent', order: 1 },
    { id: 'features', title: 'Feature Transaction', order: 2 },
    { id: 'layers', title: 'Layers Interaction and Projection', order: 3 },
    { id: 'integration', title: 'History and Collaboration', order: 4 },
    {
      id: 'verification',
      title: 'Persistence and Render Verification',
      order: 5
    }
  ]

  const steps = [
    {
      id: 'derive-group-command-intent',
      order: 1,
      laneId: 'commands',
      title: 'Derive Group command eligibility and intent',
      ownerPackage: 'asyra-design command controller',
      purpose:
        'Derive Group and Ungroup availability from app selection plus the canonical UI projection, then emit one ID-only feature request while leaving Scene Tree as the final validator.',
      inputs: [
        'artifact:group-command-trigger',
        'app-local selected element ids',
        'canonical flattenedElementIds and elementDataMap projection'
      ],
      outputs: [
        'artifact:group-command-availability',
        'artifact:eligible-group-command-request',
        'artifact:group-command-rejection'
      ],
      conditions: [
        'Group availability requires a non-empty unique projected selection of existing non-workspace siblings with one common parent.',
        'Ungroup availability requires exactly one projected official Preset Group with an existing container parent.',
        'A valid trigger emits exactly one group or ungroup request containing canonical ids; caller selection order never defines child order.',
        'Availability is presentation guidance only and Scene Tree remains the final complete hierarchy validator.'
      ],
      bypasses: [
        'Empty, duplicate, missing, stale, workspace, mixed-parent, or non-Group ungroup selection emits an unavailable state and no feature request.',
        'A disabled or stale invocation terminates without hierarchy, selection, history, publication, or Render mutation.'
      ],
      allowedContributors: [
        'app-local selection query',
        'canonical UI projection from Preset data channels',
        'official Preset GROUP component identity',
        'artifact:group-command-trigger'
      ],
      forbiddenContributors: [
        'Render objects or hit-test hierarchy',
        'a second mutable parent or children map',
        'direct parentId or children writes',
        'app-side replacement for Scene Tree validation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/constants',
        'apps/asyra-design/src/controllers',
        'apps/asyra-design/src/providers',
        'apps/asyra-design/src/common-apis'
      ],
      specRefs: [
        '#group-command',
        '#ungroup-command',
        '#product-ownership',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'derive-group-command-intent'
    },
    {
      id: 'execute-group-command-transaction',
      order: 1,
      laneId: 'features',
      title: 'Execute one Group or Ungroup transaction',
      ownerPackage: 'asyra-design Group feature',
      purpose:
        'Execute one exclusive one-shot feature request through the app common API and include canonical hierarchy plus post-operation app selection in one Factory transaction and undo commit.',
      inputs: ['artifact:eligible-group-command-request'],
      outputs: [
        'artifact:committed-group-command',
        'artifact:group-command-transaction-failure'
      ],
      conditions: [
        'The feature declares its registered trigger, priority 100, and exclusive one-shot execution; each serialized distinct trigger re-evaluates current eligibility without coalescing or dedupe.',
        'Group calls hierarchyApis.groupElements and on success selects only the newly created Group.',
        'Ungroup calls hierarchyApis.ungroupElement and on success selects former direct children in canonical order, or clears selection for an empty Group.',
        'The hierarchy request and resulting selection update execute inside one intended Factory transaction and one undo commit.',
        'Canonical validation remains in Scene Tree and Group coordinate/bounds normalization remains in Preset.'
      ],
      bypasses: [
        'An app-ineligible request never enters the feature.',
        'A canonical rejection or semantic no-op leaves hierarchy and selection unchanged and creates no history entry or publication.',
        'A thrown failure after transaction open is owned by Factory rollback and restores hierarchy, properties, Group geometry, and selection completely.'
      ],
      allowedContributors: [
        'artifact:eligible-group-command-request',
        'app hierarchy common API',
        'app selection common API',
        'public Core runTransaction boundary'
      ],
      forbiddenContributors: [
        'direct Scene Tree instance access',
        'delete plus recreate hierarchy simulation',
        'a second Group component',
        'Render-only or app-specific fallback hierarchy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/features',
        'apps/asyra-design/src/common-apis',
        'apps/asyra-design/src/constants',
        'apps/asyra-design/src/init'
      ],
      specRefs: [
        '#intended-transaction-and-selection',
        '#group-command',
        '#ungroup-command',
        '#formal-test-plan'
      ],
      failureOwnerStepId: 'execute-group-command-transaction'
    },
    {
      id: 'route-group-command-input',
      order: 1,
      laneId: 'layers',
      title: 'Route shortcuts and visible Layers controls',
      ownerPackage: 'asyra-design input and Layers UI',
      purpose:
        'Normalize visible Group/Ungroup controls and platform shortcuts into the same app trigger without performing model mutation in UI code.',
      inputs: [
        'Layers Group or Ungroup button activation',
        'Meta/Ctrl+G keyboard input with optional Shift',
        'artifact:group-command-availability'
      ],
      outputs: ['artifact:group-command-trigger'],
      conditions: [
        'The Layers header exposes stable accessible Group and Ungroup controls with stable data-testid values.',
        'Meta+G or Ctrl+G routes Group and the Shift variant routes Ungroup through registered input constants.',
        'A control is enabled only by its projected command availability and every enabled surface hands off to the same feature intent route.'
      ],
      bypasses: [
        'Editable text, number, and color inputs keep native keyboard behavior and do not emit a Group trigger.',
        'Disabled control activation and unavailable shortcuts emit no trigger and perform no canonical mutation.'
      ],
      allowedContributors: [
        'artifact:group-command-availability',
        'central InputSystem event constants',
        'central key-combination registry',
        'Layers accessible controls'
      ],
      forbiddenContributors: [
        'direct hierarchy or selection mutation in React handlers',
        'ad-hoc document keydown listener outside InputSystem',
        'fixture-only command path',
        'window.__AsyraE2E__ product execution'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/constants',
        'apps/asyra-design/src/config/key-combinations.ts',
        'apps/asyra-design/src/contents',
        'apps/asyra-design/src/controllers'
      ],
      specRefs: [
        '#command-surfaces',
        '#explicit-non-goals',
        '#formal-test-plan'
      ],
      failureOwnerStepId: 'route-group-command-input'
    },
    {
      id: 'project-layers-hierarchy',
      order: 2,
      laneId: 'layers',
      title: 'Project canonical hierarchy into Layers rows',
      ownerPackage: 'asyra-design Layers projection',
      purpose:
        'Derive parent-before-descendant visible rows, visual depth, and expand/collapse presentation from the canonical app projection without retaining a second hierarchy.',
      inputs: [
        'canonical flattenedElementIds and elementDataMap projection',
        'app-local collapsed Group id set',
        'app-local selected element ids'
      ],
      outputs: [
        'artifact:visible-layer-rows',
        'artifact:layers-presentation-state',
        'artifact:layers-projection-failure'
      ],
      conditions: [
        'Rows retain canonical flattened order and derive depth by following projected parentId chains to the workspace root.',
        'Official Group rows expose an expand/collapse control and default to expanded.',
        'Collapsed descendants are omitted only from visible rows; canonical elements and existing hidden-descendant selections remain unchanged.',
        'Shift-range selection uses the currently visible row order.',
        'Group, Ungroup, undo, redo, load, and accepted remote changes refresh through the same canonical data-channel projection.'
      ],
      bypasses: [
        'Workspace is not rendered as a Layers row.',
        'Collapse and expand mutate UI-local presentation state only and never save, publish, select, deselect, or mutate hierarchy.',
        'A missing, cyclic, or misordered supported projection stops at this owner and never fabricates hierarchy from Render state or a mutation-time cache.'
      ],
      allowedContributors: [
        'Preset flattenedElementIds data channel',
        'Preset elementDataMap data channel',
        'app-local collapsed Group ids',
        'app-local selection controller'
      ],
      forbiddenContributors: [
        'independent mutable parent or children tree',
        'Render display-object ancestry',
        'hierarchy repair or fallback rows',
        'canonical writes from expand/collapse'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/contents',
        'apps/asyra-design/src/providers',
        'apps/asyra-design/src/controllers'
      ],
      specRefs: [
        '#layers-hierarchy-projection',
        '#product-cases',
        '#explicit-non-goals'
      ],
      failureOwnerStepId: 'project-layers-hierarchy'
    },
    {
      id: 'resolve-canvas-hierarchy-target',
      order: 2,
      laneId: 'features',
      title: 'Resolve the canonical canvas hierarchy and create-parent target',
      ownerPackage:
        'asyra-design canvas hierarchy, create-parent, and geometry-mutation handoff policy',
      purpose:
        'Resolve the identity-safe raw Render hit into one canonical canvas target for hover, selection, pointer-down move, and create-element parent choice, then hand accepted child geometry mutations to the Preset-owned Group normalization path.',
      inputs: [
        'identity-safe raw Render hit element id',
        'canonical flattenedElementIds and elementDataMap projection',
        'canonical current workspace id from the public Core Scene Tree facade',
        'app-local selected element ids',
        'current Meta or Ctrl modifier snapshot',
        'create-element mouse-down and drag workspace geometry',
        'current identity-safe Render handle for the chosen official Group parent coordinate conversion',
        'accepted app-owned child position or dimension mutation ids and canonical values'
      ],
      outputs: [
        'artifact:resolved-canvas-hierarchy-target',
        'artifact:resolved-create-element-parent',
        'artifact:canvas-hierarchy-target-rejection'
      ],
      conditions: [
        'With no selected elements and no Meta or Ctrl modifier, the workspace is the reference scope and the resolver returns its workspace direct child, which is the outermost element on the raw-hit parent chain.',
        'With selected elements and no modifier, their exact selected parentId scopes are the references and the resolver returns the nearest matching ancestor to the raw hit.',
        'Same numerical depth under a different parent is invalid; exact parent membership, not depth, defines the unmodified scope.',
        'When selection spans multiple parents, each exact parentId is a valid scope and the nearest matching ancestor to the raw hit wins.',
        'With Meta or Ctrl, parent scope is bypassed and the identity-safe raw hit resolves only when it is an existing first non-Group element.',
        'Canvas hover, selection, and pointer-down move consume the same resolved target while their existing lock, visibility, selection mutation, and move-session behavior remains unchanged.',
        'Create-element mouse down consumes the same resolved hierarchy target: a resolved Group is the create parent, while a resolved non-Group uses its exact canonical parent only when that parent is an official Group.',
        'When a valid projection has a missing raw hit, creation uses the workspace root and passes its id as an explicit parentId instead of leaving parent unspecified.',
        'For a Group create parent, Preset moveElementsWithGroupGeometry performs the identity-preserving reparent and initial coordinate and bounds normalization inside the same transaction as explicit workspace-root creation.',
        'The mouse-down and drag workspace geometry is converted into the chosen parent current local coordinates through that exact identity-safe Render handle for every drag update.',
        'Preset normalizeGroupsForElements runs after create drag geometry writes in the same transaction so direct-child and ancestor Group bounds remain canonical without app-owned Group origin arithmetic.',
        'Every accepted discrete child geometry mutation or completed continuous pointer gesture invokes Preset normalizeGroupsForElements after its final geometry write and before the same outer transaction commits; Preset processes the deepest affected Group first.',
        'Pointer movement refreshes the current modifier snapshot before hover resolution.'
      ],
      bypasses: [
        'Dragging, non-element overlays, and the existing path-editing guard retain their current feature bypass behavior.',
        'Intermediate pointer-move samples defer Group normalization until gesture finalization so Group-origin rebasing cannot accumulate against drag-start-local coordinates.',
        'A missing raw hit emits no canvas target but resolves an explicit workspace-root create parent when the canonical projection is valid.',
        'A Group raw hit in modifier mode or unmatched exact parent scope emits no resolved target and no create parent.',
        'A missing, duplicated, cyclic, stale, or invalid-root canonical projection fails closed before any hover, selection, move, or create handoff.'
      ],
      allowedContributors: [
        'identity-safe raw Render hit only',
        'canonical Preset flattenedElementIds and elementDataMap data channels',
        'public Core Scene Tree facade current workspace id query',
        'app-local selection query',
        'System Context Meta and Ctrl key snapshot',
        'identity-safe chosen-parent Render transform for coordinate conversion only',
        'public Preset moveElementsWithGroupGeometry and normalizeGroupsForElements adapters for official Group geometry only',
        'asyra-design hover, selection, move, and create-element features'
      ],
      forbiddenContributors: [
        'Render display-object ancestry',
        'a second mutable parent or children map',
        'same-depth hierarchy inference',
        'raw hit fallback after canonical target rejection',
        'Group canvas hit geometry or Preset-owned target selection policy',
        'app-owned Group origin arithmetic or Group bounds normalization',
        'App does not derive or cache Group bounds',
        'unspecified create parent or Scene Tree legacy firstFrame fallback'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/config/key-combinations.ts',
        'apps/asyra-design/src/controllers',
        'apps/asyra-design/src/common-apis',
        'apps/asyra-design/src/features/hover-element',
        'apps/asyra-design/src/features/selection',
        'apps/asyra-design/src/features/move-elements',
        'apps/asyra-design/src/features/create-element',
        'apps/asyra-design/e2e',
        'create-app/asyra-design/template'
      ],
      specRefs: [
        '#canvas-hierarchy-hover-selection-and-create-parent-target',
        '#product-cases',
        '#explicit-non-goals',
        '#formal-test-plan',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'resolve-canvas-hierarchy-target'
    },
    {
      id: 'project-group-hover-selection-overlay',
      order: 2,
      laneId: 'verification',
      title: 'Project canonical Group hover and selection bounds',
      ownerPackage: '@asyra/preset official selection overlay default',
      purpose:
        'Project official Group bounds through the existing registered selection overlay layer without changing canonical geometry, Render hierarchy, or canvas hit policy.',
      inputs: [
        'canonical element selection and canonical hovered element id',
        'artifact:resolved-canvas-hierarchy-target',
        'official Group computed x, y, width, and height',
        'current identity-safe Render world transform'
      ],
      outputs: ['artifact:group-hover-selection-overlay'],
      conditions: [
        'A selected Group draws the ordinary selection box from canonical computed bounds.',
        'A hovered unselected Group draws the ordinary hover box from the same canonical computed bounds.',
        'A nested Group projects its bounds through the current Render world transform.',
        'Selection takes precedence over hover so one Group is never outlined twice.',
        'The existing Preset selection overlay registration, z-index, update loop, and cleanup lifecycle remain unchanged.'
      ],
      bypasses: [
        'A missing Group, missing Render handle, invalid bounds, or non-finite computed dimension draws no inferred or fallback geometry.',
        'A zero-area Group gains no fabricated visible area or canvas hit area.',
        'The existing path-editing guard and selected-id hover suppression remain unchanged.'
      ],
      allowedContributors: [
        'canonical Preset element selection projection',
        'canonical System Context hovered element id',
        'official Preset Group computed data',
        'engine-neutral Render world transform',
        'existing registered selection overlay layer'
      ],
      forbiddenContributors: [
        'a second overlay layer or Group-specific mutable state',
        'Group Render-strategy geometry added only to create a canvas hit area',
        'app-specific or Render fallback bounds',
        'direct Pixi or concrete render-engine imports'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/render-layers/selection-overlay-render-layer.ts',
        'packages/preset/src/__tests__',
        'apps/asyra-design/e2e'
      ],
      specRefs: [
        '#group-canvas-hover-and-selection-overlay',
        '#product-cases',
        '#explicit-non-goals',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'project-group-hover-selection-overlay'
    },
    {
      id: 'derive-group-world-bounds-for-viewport-fit',
      order: 3,
      laneId: 'verification',
      title: 'Derive canonical world-space scene bounds for viewport fit',
      ownerPackage: '@asyra/core Scene Tree facade bounds query',
      purpose:
        'Derive complete world-space scene bounds from canonical Scene Tree geometry and parent membership, then hand the completed bounds to the existing app zoom-fit consumer without changing shortcut or viewport math.',
      inputs: [
        'canonical Scene Tree element identities, types, and parent ids',
        'canonical computed x, y, width, and height',
        'canonical workspace root identity'
      ],
      outputs: ['artifact:canonical-world-scene-bounds'],
      conditions: [
        'Each non-workspace element accumulates nested container offsets along its canonical parent chain until the workspace root.',
        'Each world-space rectangle preserves existing negative-width and negative-height min/max semantics before the complete scene union.',
        'A normal or nested Group before and after unchanged visible geometry produces exactly equivalent world-space scene bounds.',
        'The existing app common API passes the completed bounds to calculateZoomFit for Cmd+1 without reinterpreting Group-local coordinates.'
      ],
      bypasses: [
        'Empty canonical content returns no bounds and leaves the existing zoom-fit no-op behavior unchanged.',
        'A missing parent, cycle, invalid workspace chain, or non-finite required geometry fails closed without partial bounds or guessed offsets.'
      ],
      allowedContributors: [
        'canonical Scene Tree parent membership',
        'canonical element computed geometry',
        'existing Core Scene Tree facade query',
        'existing app viewport common API and calculateZoomFit consumer'
      ],
      forbiddenContributors: [
        'app-specific hierarchy or coordinate reinterpretation',
        'Render display-object ancestry or Render fallback bounds',
        'a second mutable parent map or retained bounds cache',
        'Group-only fixture exceptions'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/apis',
        'packages/core/src/__tests__',
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/common-apis/viewport.ts',
        'apps/asyra-design/src/common-apis/__tests__'
      ],
      specRefs: [
        '#world-space-scene-bounds-and-viewport-fit',
        '#product-cases',
        '#formal-test-plan',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'derive-group-world-bounds-for-viewport-fit'
    },
    {
      id: 'settle-history-publication-and-remote-apply',
      order: 1,
      laneId: 'integration',
      title: 'Settle history, publication, and app-owned remote apply',
      ownerPackage: '@asyra/factory and asyra-design collaboration adapter',
      purpose:
        'Verify one local Group command settles as one undo/publication boundary and apply an app-accepted remote hierarchy publication through one remote Factory transaction without remote selection takeover.',
      inputs: [
        'artifact:committed-group-command',
        'received hierarchy publication from transport-only Collaboration',
        'app/backend remote permission, ordering, duplicate, and conflict decision'
      ],
      outputs: [
        'artifact:settled-group-publication',
        'artifact:accepted-remote-group-update',
        'artifact:rejected-remote-group-publication'
      ],
      conditions: [
        'One local Group or Ungroup command produces one Factory undo entry and one grouped publication with exact hierarchy/property evidence.',
        'Undo and redo restore exact identity, parent, sibling index, child order, Group data, geometry, and app selection recorded by the local command.',
        'The app validates an accepted remote publication before one remote non-undoable Factory transaction and ordinary Scene Tree mutation.',
        'Accepted remote updates refresh canonical projection while receiving-app selection and collapsed state remain local.'
      ],
      bypasses: [
        'Rejected, unauthorized, stale, duplicate, or conflicting remote publication performs no canonical mutation.',
        'Collaboration transports repeated publications in FIFO order and does not dedupe, order by timestamp/LWW, resolve hierarchy conflicts, create semantic history, or own convergence policy.',
        'UI-local selection and collapse changes do not enter shared publication.'
      ],
      allowedContributors: [
        'artifact:committed-group-command',
        'Factory transaction history and publication evidence',
        'app collaboration publication processor',
        'Scene Tree canonical remote mutation route'
      ],
      forbiddenContributors: [
        '@asyra/collaboration dedupe or semantic policy',
        'Provider timestamp authority or last-write-wins policy',
        'remote selection takeover',
        'partial remote apply before full publication validation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/collaboration',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/e2e'
      ],
      specRefs: [
        '#saveload-and-collaboration',
        '#intended-transaction-and-selection',
        '#framework-owners-retained-from-gate-3'
      ],
      failureOwnerStepId: 'settle-history-publication-and-remote-apply'
    },
    {
      id: 'verify-group-persistence-and-render',
      order: 1,
      laneId: 'verification',
      title: 'Verify exact load and identity-safe Render handoff',
      ownerPackage: 'asyra-design integration verification',
      purpose:
        'Prove save/load, Layers refresh, and Render consume the exact canonical Group hierarchy while preserving identity and rejecting invalid documents without fallback projection.',
      inputs: [
        'artifact:committed-group-command',
        'artifact:accepted-remote-group-update',
        'serialized canonical document',
        'artifact:visible-layer-rows',
        'artifact:group-hover-selection-overlay',
        'artifact:canonical-world-scene-bounds'
      ],
      outputs: [
        'artifact:verified-group-document',
        'artifact:identity-safe-render-projection',
        'artifact:invalid-group-document-rejection'
      ],
      conditions: [
        'Save/load preserves exact Group data, parent, index, child order, nested hierarchy, coordinates/bounds, props references, and entity identity.',
        'A valid replace-style load refreshes Layers from canonical data channels and hands the same element identity and engine handle to Render.',
        'Render projects committed hierarchy only, with no duplicate visual, stale parent, or visible coordinate jump.',
        'Selected and hovered official Group bounds remain aligned with the same canonical geometry after Group, Ungroup, undo, redo, load, and accepted remote apply.'
      ],
      bypasses: [
        'Collapse state is UI-local and is not serialized or required to survive reload.',
        'Invalid duplicate membership, missing reference, cycle, or invalid workspace root rejects before document apply.',
        'Load or Render failure does not create patch hierarchy, fallback rows, delete-and-recreate handoff, or app-specific visual repair.'
      ],
      allowedContributors: [
        'canonical Core save/load boundary',
        'canonical Preset UI data channels',
        'identity-safe Render hierarchy projection',
        'synchronized app E2E and visual evidence'
      ],
      forbiddenContributors: [
        'Render-owned hierarchy mutation',
        'Layers-owned document hierarchy',
        'patch or fallback projection',
        'window.__AsyraE2E__ as the Group product command path'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/e2e',
        'apps/asyra-design/src/contents',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#saveload-and-collaboration',
        '#product-cases',
        '#definition-of-done',
        '#manual-review-checklist'
      ],
      failureOwnerStepId: 'verify-group-persistence-and-render'
    }
  ]

  const routes = [
    {
      id: 'availability-to-layers-controls',
      from: 'derive-group-command-intent',
      to: 'route-group-command-input',
      kind: 'projection',
      predicate: 'canonical projected selection changes',
      producedArtifacts: ['artifact:group-command-availability']
    },
    {
      id: 'layers-trigger-to-command-intent',
      from: 'route-group-command-input',
      to: 'derive-group-command-intent',
      kind: 'command',
      predicate: 'enabled visible control or non-editable registered shortcut',
      producedArtifacts: ['artifact:group-command-trigger']
    },
    {
      id: 'eligible-intent-to-feature',
      from: 'derive-group-command-intent',
      to: 'execute-group-command-transaction',
      kind: 'command',
      predicate: 'current projected selection satisfies app eligibility',
      producedArtifacts: ['artifact:eligible-group-command-request']
    },
    {
      id: 'ineligible-command-terminates',
      from: 'derive-group-command-intent',
      kind: 'terminal',
      predicate: 'selection is unavailable or stale',
      producedArtifacts: ['artifact:group-command-rejection']
    },
    {
      id: 'successful-command-to-history',
      from: 'execute-group-command-transaction',
      to: 'settle-history-publication-and-remote-apply',
      kind: 'transaction',
      predicate: 'canonical Group operation and post-selection commit',
      producedArtifacts: ['artifact:committed-group-command']
    },
    {
      id: 'successful-command-to-verification',
      from: 'execute-group-command-transaction',
      to: 'verify-group-persistence-and-render',
      kind: 'verification',
      predicate: 'committed hierarchy enters downstream app projections',
      producedArtifacts: ['artifact:committed-group-command']
    },
    {
      id: 'transaction-failure-terminates',
      from: 'execute-group-command-transaction',
      kind: 'terminal',
      predicate: 'canonical rejection, semantic no-op, or rolled-back failure',
      producedArtifacts: ['artifact:group-command-transaction-failure']
    },
    {
      id: 'layers-visible-rows-to-verification',
      from: 'project-layers-hierarchy',
      to: 'verify-group-persistence-and-render',
      kind: 'projection',
      predicate: 'canonical hierarchy data channel refreshes',
      producedArtifacts: ['artifact:visible-layer-rows']
    },
    {
      id: 'layers-presentation-terminates-locally',
      from: 'project-layers-hierarchy',
      kind: 'terminal',
      predicate: 'collapse, expand, depth, and visible selection projection',
      producedArtifacts: ['artifact:layers-presentation-state']
    },
    {
      id: 'malformed-layers-projection-terminates',
      from: 'project-layers-hierarchy',
      kind: 'terminal',
      predicate: 'canonical projection is missing, cyclic, or misordered',
      producedArtifacts: ['artifact:layers-projection-failure']
    },
    {
      id: 'resolved-canvas-target-to-group-overlay',
      from: 'resolve-canvas-hierarchy-target',
      to: 'project-group-hover-selection-overlay',
      kind: 'projection',
      predicate:
        'the app publishes the resolved canvas target as canonical hoveredElementId',
      producedArtifacts: ['artifact:resolved-canvas-hierarchy-target']
    },
    {
      id: 'resolved-create-parent-to-create-element',
      from: 'resolve-canvas-hierarchy-target',
      kind: 'terminal',
      predicate:
        'create-element mouse down receives one explicit workspace or official Group parent with parent-local coordinates',
      producedArtifacts: ['artifact:resolved-create-element-parent']
    },
    {
      id: 'rejected-canvas-target-terminates',
      from: 'resolve-canvas-hierarchy-target',
      kind: 'terminal',
      predicate:
        'the raw hit or canonical projection cannot produce an allowed hierarchy target',
      producedArtifacts: ['artifact:canvas-hierarchy-target-rejection']
    },
    {
      id: 'group-overlay-to-verification',
      from: 'project-group-hover-selection-overlay',
      to: 'verify-group-persistence-and-render',
      kind: 'projection',
      predicate:
        'canonical Group selection or hover state projects through the existing overlay layer',
      producedArtifacts: ['artifact:group-hover-selection-overlay']
    },
    {
      id: 'world-scene-bounds-to-viewport-verification',
      from: 'derive-group-world-bounds-for-viewport-fit',
      to: 'verify-group-persistence-and-render',
      kind: 'projection',
      predicate:
        'Cmd+1 requests complete canonical world-space bounds for normal or nested Group content',
      producedArtifacts: ['artifact:canonical-world-scene-bounds']
    },
    {
      id: 'settled-publication-terminates',
      from: 'settle-history-publication-and-remote-apply',
      kind: 'terminal',
      predicate: 'local command publication is grouped once',
      producedArtifacts: ['artifact:settled-group-publication']
    },
    {
      id: 'accepted-remote-to-verification',
      from: 'settle-history-publication-and-remote-apply',
      to: 'verify-group-persistence-and-render',
      kind: 'remote',
      predicate: 'app policy accepts and canonical remote transaction commits',
      producedArtifacts: ['artifact:accepted-remote-group-update']
    },
    {
      id: 'rejected-remote-terminates',
      from: 'settle-history-publication-and-remote-apply',
      kind: 'terminal',
      predicate: 'app/backend policy rejects publication before mutation',
      producedArtifacts: ['artifact:rejected-remote-group-publication']
    },
    {
      id: 'verified-document-terminates',
      from: 'verify-group-persistence-and-render',
      kind: 'terminal',
      predicate: 'exact save/load and Layers refresh are verified',
      producedArtifacts: ['artifact:verified-group-document']
    },
    {
      id: 'verified-render-terminates',
      from: 'verify-group-persistence-and-render',
      kind: 'terminal',
      predicate: 'identity-safe Render projection is verified',
      producedArtifacts: ['artifact:identity-safe-render-projection']
    },
    {
      id: 'invalid-document-terminates',
      from: 'verify-group-persistence-and-render',
      kind: 'terminal',
      predicate: 'canonical load validation rejects before apply',
      producedArtifacts: ['artifact:invalid-group-document-rejection']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:group-command-trigger',
      ownerStepId: 'route-group-command-input',
      channel: 'InputSystem or Layers control',
      consumerStepIds: ['derive-group-command-intent'],
      terminal: false
    },
    {
      id: 'artifact:group-command-availability',
      ownerStepId: 'derive-group-command-intent',
      channel: 'app projection',
      consumerStepIds: ['route-group-command-input'],
      terminal: false
    },
    {
      id: 'artifact:eligible-group-command-request',
      ownerStepId: 'derive-group-command-intent',
      channel: 'feature request',
      consumerStepIds: ['execute-group-command-transaction'],
      terminal: false
    },
    {
      id: 'artifact:group-command-rejection',
      ownerStepId: 'derive-group-command-intent',
      channel: 'terminal app result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:committed-group-command',
      ownerStepId: 'execute-group-command-transaction',
      channel: 'Factory transaction result',
      consumerStepIds: [
        'settle-history-publication-and-remote-apply',
        'verify-group-persistence-and-render'
      ],
      terminal: false
    },
    {
      id: 'artifact:group-command-transaction-failure',
      ownerStepId: 'execute-group-command-transaction',
      channel: 'terminal rolled-back result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:visible-layer-rows',
      ownerStepId: 'project-layers-hierarchy',
      channel: 'React view projection',
      consumerStepIds: ['verify-group-persistence-and-render'],
      terminal: false
    },
    {
      id: 'artifact:layers-presentation-state',
      ownerStepId: 'project-layers-hierarchy',
      channel: 'terminal UI-local state',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:layers-projection-failure',
      ownerStepId: 'project-layers-hierarchy',
      channel: 'terminal projection failure',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:resolved-canvas-hierarchy-target',
      ownerStepId: 'resolve-canvas-hierarchy-target',
      channel: 'canonical System Context hoveredElementId',
      consumerStepIds: ['project-group-hover-selection-overlay'],
      terminal: false
    },
    {
      id: 'artifact:resolved-create-element-parent',
      ownerStepId: 'resolve-canvas-hierarchy-target',
      channel: 'app-local create-element parent and coordinate handoff',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:canvas-hierarchy-target-rejection',
      ownerStepId: 'resolve-canvas-hierarchy-target',
      channel: 'terminal app target result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:group-hover-selection-overlay',
      ownerStepId: 'project-group-hover-selection-overlay',
      channel: 'existing Preset selection overlay layer',
      consumerStepIds: ['verify-group-persistence-and-render'],
      terminal: false
    },
    {
      id: 'artifact:canonical-world-scene-bounds',
      ownerStepId: 'derive-group-world-bounds-for-viewport-fit',
      channel: 'Core Scene Tree facade query',
      consumerStepIds: ['verify-group-persistence-and-render'],
      terminal: false
    },
    {
      id: 'artifact:settled-group-publication',
      ownerStepId: 'settle-history-publication-and-remote-apply',
      channel: 'Factory shared publication',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:accepted-remote-group-update',
      ownerStepId: 'settle-history-publication-and-remote-apply',
      channel: 'app-owned remote Factory transaction',
      consumerStepIds: ['verify-group-persistence-and-render'],
      terminal: false
    },
    {
      id: 'artifact:rejected-remote-group-publication',
      ownerStepId: 'settle-history-publication-and-remote-apply',
      channel: 'terminal app policy result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:verified-group-document',
      ownerStepId: 'verify-group-persistence-and-render',
      channel: 'terminal persistence evidence',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:identity-safe-render-projection',
      ownerStepId: 'verify-group-persistence-and-render',
      channel: 'terminal Render evidence',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:invalid-group-document-rejection',
      ownerStepId: 'verify-group-persistence-and-render',
      channel: 'terminal load rejection',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const invariants = [
    {
      id: 'canonical-hierarchy-remains-framework-owned',
      title: 'The app never becomes a second hierarchy owner',
      statement:
        'Scene Tree alone validates and mutates canonical parent membership and order; Preset alone adapts official Group geometry; UI and Render only consume projections.',
      stepIds: [
        'derive-group-command-intent',
        'execute-group-command-transaction',
        'project-layers-hierarchy',
        'resolve-canvas-hierarchy-target',
        'project-group-hover-selection-overlay',
        'derive-group-world-bounds-for-viewport-fit',
        'verify-group-persistence-and-render'
      ],
      artifactIds: [
        'artifact:eligible-group-command-request',
        'artifact:visible-layer-rows',
        'artifact:resolved-canvas-hierarchy-target',
        'artifact:group-hover-selection-overlay',
        'artifact:canonical-world-scene-bounds',
        'artifact:identity-safe-render-projection'
      ],
      specRefs: ['#product-ownership', '#framework-owners-retained-from-gate-3']
    },
    {
      id: 'one-command-one-transaction',
      title: 'One Group command is one intended transaction',
      statement:
        'Hierarchy, Group geometry, and post-operation selection settle or roll back together as one undo commit and one grouped publication.',
      stepIds: [
        'execute-group-command-transaction',
        'settle-history-publication-and-remote-apply'
      ],
      artifactIds: [
        'artifact:committed-group-command',
        'artifact:settled-group-publication'
      ],
      specRefs: ['#intended-transaction-and-selection']
    },
    {
      id: 'collaboration-remains-transport-only',
      title: 'Remote product policy remains app/backend-owned',
      statement:
        'Collaboration adds no dedupe, timestamp/LWW ordering, hierarchy conflict resolution, semantic history, or convergence registry.',
      stepIds: ['settle-history-publication-and-remote-apply'],
      artifactIds: [
        'artifact:accepted-remote-group-update',
        'artifact:rejected-remote-group-publication'
      ],
      specRefs: [
        '#framework-owners-retained-from-gate-3',
        '#saveload-and-collaboration'
      ]
    }
  ]

  const acceptanceContracts = [
    {
      id: 'group-command-product-cases',
      title: 'Group command cases',
      assertions: [
        'Group one, contiguous, non-contiguous, and nested sibling selections in canonical sibling order.',
        'Reject empty, duplicate, missing, stale, workspace, and mixed-parent inputs without partial state.',
        'A successful Group selects only the new official Group and preserves child lock, visibility, identity, and world-space appearance.'
      ],
      stepIds: [
        'derive-group-command-intent',
        'execute-group-command-transaction'
      ],
      specRefs: ['#group-command', '#product-cases']
    },
    {
      id: 'ungroup-command-product-cases',
      title: 'Ungroup command cases',
      assertions: [
        'Ungroup a normal official Group and select former direct children in canonical order.',
        'Ungroup an empty official Group and clear selection.',
        'Nested Groups retain identity, data, descendants, order, and visible world-space output.'
      ],
      stepIds: [
        'derive-group-command-intent',
        'execute-group-command-transaction'
      ],
      specRefs: ['#ungroup-command', '#product-cases']
    },
    {
      id: 'command-surface-product-cases',
      title: 'Visible controls and shortcut parity',
      assertions: [
        'Visible Layers controls and Meta/Ctrl+G with the Shift variant route the same registered feature contract.',
        'Controls expose stable accessible names and data-testid values.',
        'Editable inputs and disabled or unavailable commands bypass without mutation.'
      ],
      stepIds: ['route-group-command-input', 'derive-group-command-intent'],
      specRefs: ['#command-surfaces', '#formal-test-plan']
    },
    {
      id: 'layers-projection-product-cases',
      title: 'Nested Layers projection and local collapse state',
      assertions: [
        'Rows follow parent-before-descendant canonical child order with parent-chain visual depth.',
        'Official Groups default expanded and collapse hides descendants without canonical or selection mutation.',
        'Shift-range uses visible row order and hidden-descendant selection survives collapse and expand.'
      ],
      stepIds: ['project-layers-hierarchy'],
      specRefs: ['#layers-hierarchy-projection', '#product-cases']
    },
    {
      id: 'canvas-hierarchy-target-product-cases',
      title: 'Canonical canvas hierarchy target',
      assertions: [
        'Without selection and without Meta/Ctrl, a nested raw hit resolves to the workspace direct-child target.',
        'With selection and without Meta/Ctrl, exact selected parentId scope controls resolution and an equal-depth element under a different parent is invalid.',
        'With Meta/Ctrl, the first non-Group raw hit is the same target used by hover, selection, and pointer-down move.',
        'Multiple selected parent scopes choose the nearest matching ancestor to the raw hit.',
        'Create-element mouse down uses the same resolved hierarchy target to choose an explicit official Group parent, or the explicit workspace root when there is no raw hit.',
        'Nested Group creation converts the mouse-down workspace position into exact chosen-parent local coordinates without Render ancestry or the legacy firstFrame fallback.',
        'A nested child pointer move finalizes through Preset before the gesture transaction commits, writes every affected Group bounds cache deepest first, and preserves the child world-space result without a visible jump.',
        'Missing, duplicated, cyclic, stale, invalid-root, unmatched-scope, and Group modifier hits fail closed without raw-hit fallback or a second hierarchy.'
      ],
      stepIds: ['resolve-canvas-hierarchy-target'],
      specRefs: [
        '#canvas-hierarchy-hover-selection-and-create-parent-target',
        '#product-cases',
        '#explicit-non-goals'
      ]
    },
    {
      id: 'group-hover-selection-overlay-product-cases',
      title: 'Canonical Group hover and selection overlay',
      assertions: [
        'Selected and hovered official Groups use canonical computed bounds and the current Render transform for the ordinary canvas box.',
        'Nested Groups preserve world-transform alignment, and selection suppresses a duplicate hover outline.',
        'Missing or invalid Group bounds fail closed without a second layer, Group-specific state, fallback geometry, concrete-engine import, or canvas hit area.'
      ],
      stepIds: ['project-group-hover-selection-overlay'],
      specRefs: [
        '#group-canvas-hover-and-selection-overlay',
        '#product-cases',
        '#explicit-non-goals'
      ]
    },
    {
      id: 'group-world-bounds-viewport-fit-product-cases',
      title: 'Canonical Group world bounds and Cmd+1 viewport fit',
      assertions: [
        'Cmd+1 preserves Group before and after unchanged visible geometry with exactly equivalent world-space scene bounds.',
        'Normal and nested Groups accumulate every canonical parent offset to the workspace root without changing existing zoom-fit math.',
        'Empty content remains a no-op, while missing parent, cycle, invalid workspace chain, or non-finite geometry fails closed without partial bounds.',
        'No app-specific hierarchy, Render ancestry, fallback bounds, retained cache, or Group-only fixture exception is introduced.'
      ],
      stepIds: ['derive-group-world-bounds-for-viewport-fit'],
      specRefs: [
        '#world-space-scene-bounds-and-viewport-fit',
        '#product-cases',
        '#explicit-non-goals'
      ]
    },
    {
      id: 'history-and-remote-product-cases',
      title: 'Exact history, publication, and remote apply',
      assertions: [
        'One command is one undo entry and one grouped publication; rejection and no-op create neither.',
        'Undo and redo restore exact hierarchy, Group data, geometry, identity, and command selection.',
        'Accepted remote Group changes use ordinary canonical apply without selection takeover; rejected remote changes do not mutate.',
        'Collaboration gains no dedupe, timestamp/LWW, conflict, convergence, or semantic-history policy.'
      ],
      stepIds: [
        'execute-group-command-transaction',
        'settle-history-publication-and-remote-apply'
      ],
      specRefs: [
        '#intended-transaction-and-selection',
        '#saveload-and-collaboration'
      ]
    },
    {
      id: 'persistence-render-and-dod',
      title: 'Exact persistence, identity-safe Render, and completion gates',
      assertions: [
        'Save/load preserves exact nested Group document state and invalid hierarchy rejects before apply.',
        'Layers and Render refresh from canonical hierarchy with stable identity, no duplicate visual, no stale parent, and no coordinate jump.',
        'Separate app/Core instances remain isolated.',
        'Inspector, app/package, integration, TypeScript/build, dependency, lint, root build, E2E, collaboration, and synchronized visual gates pass before manual review.',
        'No second hierarchy state, Group component, Render fallback, or Collaboration conflict policy is introduced; user review precedes closeout.'
      ],
      stepIds: [
        'project-layers-hierarchy',
        'resolve-canvas-hierarchy-target',
        'project-group-hover-selection-overlay',
        'derive-group-world-bounds-for-viewport-fit',
        'settle-history-publication-and-remote-apply',
        'verify-group-persistence-and-render'
      ],
      specRefs: [
        '#saveload-and-collaboration',
        '#definition-of-done',
        '#manual-review-checklist'
      ]
    }
  ]

  const flowInspectorData = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'asyra-design-group-interaction-mvp',
      kind: 'feature',
      title: 'Asyra Design Group Interaction MVP Inspector',
      subtitle:
        'Exact app command, transaction, hierarchy-scoped canvas targeting, Layers projection, world-space bounds, collaboration, persistence, and Render handoffs for official Group operations.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Asyra Design Group Interaction MVP Plan',
      inspectorOwner: 'Asyra Design Group Interaction owner flow'
    },
    links: [
      {
        id: 'group-interaction-plan',
        kind: 'authority',
        label: 'Product contract',
        href: './group-interaction-mvp-plan.md'
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

  deepFreeze(flowInspectorData)
  globalThis.FLOW_INSPECTOR_DATA = flowInspectorData

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = flowInspectorData
  }
})()
