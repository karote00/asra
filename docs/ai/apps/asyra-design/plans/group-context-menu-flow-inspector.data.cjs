;(function () {
  'use strict'

  const specPath = 'docs/ai/apps/asyra-design/plans/group-context-menu-plan.md'
  const inspectorPath =
    'docs/ai/apps/asyra-design/plans/group-context-menu-flow-inspector.data.cjs'

  const lanes = [
    { id: 'host-input', title: 'Canvas Host Input', order: 1 },
    { id: 'app-policy', title: 'App Menu and Command Policy', order: 2 },
    { id: 'presentation', title: 'Reusable Presentation', order: 3 },
    { id: 'execution', title: 'Existing Feature Handoff', order: 4 },
    { id: 'lifecycle', title: 'Teardown and Isolation', order: 5 }
  ]

  const steps = [
    {
      id: 'intake-canvas-context-event',
      order: 1,
      laneId: 'host-input',
      title: 'Accept one canvas-scoped native context event',
      ownerPackage: 'Asyra Design canvas adapter',
      purpose:
        'Replace Input System global browser-menu suppression with one canvas-host contextmenu intake that accepts pointer client coordinates and prevents browser default only for the handled app invocation.',
      inputs: [
        'native contextmenu event target and client coordinates',
        'Asyra Design canvas interaction host identity'
      ],
      outputs: [
        'artifact:accepted-canvas-context-invocation',
        'artifact:native-context-menu-bypass'
      ],
      conditions: [
        'A native contextmenu event whose target belongs to the mounted Asyra Design canvas interaction host is accepted once with exact client coordinates and invoking host identity.',
        'The canvas adapter calls preventDefault only after it accepts the canvas invocation.',
        'Input System removes its unconditional window contextmenu suppression and retains only typed keyboard and pointer normalization.',
        'Opening intake does not hit test, retarget selection, transact, publish, save, or write canonical document state.'
      ],
      bypasses: [
        'Editable fields, Layers, Properties, Toolbar, other app chrome, and targets outside the canvas host do not produce an app invocation and retain native or existing behavior.',
        'A missing or unmounted canvas host performs no app action and does not suppress browser default.'
      ],
      allowedContributors: [
        'native browser contextmenu event',
        'mounted Asyra Design canvas host',
        '@asyra/input-system removal of unconditional suppression'
      ],
      forbiddenContributors: [
        'Input System command eligibility or menu state',
        'Render hit testing or hierarchy ancestry',
        'right-click selection retargeting',
        'window-global app context-menu product policy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/input-system/src/input-system.ts',
        'packages/input-system/src/__tests__',
        'apps/asyra-design/src/render-app',
        'apps/asyra-design/src/app',
        'apps/asyra-design/e2e',
        'apps/asyra-design/package.json',
        'docs/ai/framework/packages/input-system.md',
        'docs/ai/apps/asyra-design/modules/input-mapping.md',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#open-trigger-and-scope',
        '#ownership-contract',
        '#explicit-non-goals'
      ],
      failureOwnerStepId: 'intake-canvas-context-event'
    },
    {
      id: 'manage-app-menu-session',
      order: 1,
      laneId: 'app-policy',
      title: 'Own the app-local menu session',
      ownerPackage: 'Asyra Design menu session',
      purpose:
        'Own one app-root-local open, replacement, positioning-input, dismissal, and focus-return session without copying hierarchy, selection, or document state.',
      inputs: [
        'artifact:accepted-canvas-context-invocation',
        'artifact:context-menu-dismiss-intent',
        'mounted app-root and canvas-host lifecycle'
      ],
      outputs: [
        'artifact:app-context-menu-session',
        'artifact:context-menu-session-dismissed'
      ],
      conditions: [
        'An accepted invocation opens exactly one session with pointer client coordinates and invoking canvas host; a later accepted invocation replaces and repositions it.',
        'The accepted-invocation route consumes only the accepted canvas artifact; the dismissal route consumes only the dismiss intent and current app-local session.',
        'Escape, outside primary-pointer press, Tab, successful enabled activation, replacement, and canvas lifecycle teardown close the current session.',
        'Focus return targets only the invoking canvas host where browser focus behavior permits.',
        'Session state is React app-local UI state and contains no mutable selection, hierarchy, transaction, persistence, collaboration, or Render state.'
      ],
      bypasses: [
        'A dismissal without an open session is a semantic no-op.',
        'Opening, replacing, focusing, navigating, dismissing, or cancelling never changes canonical document or selection state.'
      ],
      allowedContributors: [
        'artifact:accepted-canvas-context-invocation',
        'artifact:context-menu-dismiss-intent',
        'React instance-local state',
        'browser viewport dimensions as positioning policy input',
        'invoking canvas host focus handle'
      ],
      forbiddenContributors: [
        'module-global menu session singleton',
        'Scene Tree, Selection, Factory, persistence, or collaboration writes',
        'second hierarchy or selection state',
        'Render object or overlay-layer menu state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/render-app',
        'apps/asyra-design/src/app',
        'apps/asyra-design/src/controllers',
        'apps/asyra-design/e2e',
        'apps/asyra-design/package.json',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#open-trigger-and-scope',
        '#dismissal-and-accessibility',
        '#product-cases'
      ],
      failureOwnerStepId: 'manage-app-menu-session'
    },
    {
      id: 'project-group-command-descriptors',
      order: 2,
      laneId: 'app-policy',
      title: 'Project shared Group and Ungroup command descriptors',
      ownerPackage: 'Asyra Design command layer',
      purpose:
        'Project one fixed-order Group/Ungroup descriptor source into visible labels, actual key bindings, platform shortcut labels, current eligibility, and the existing feature execution callback.',
      inputs: [
        'current app selection and canonical hierarchy projection',
        'deterministic injected macOS or Windows/Linux platform input',
        'registered Meta/Ctrl+G keyboard input with current Shift modifier'
      ],
      outputs: [
        'artifact:projected-group-command-rows',
        'artifact:registered-group-shortcut-intent'
      ],
      conditions: [
        'The descriptor order is exactly Group then Ungroup and both descriptors remain visible.',
        'Group reuses existing canGroup eligibility and Ungroup reuses existing canUngroup eligibility; Scene Tree remains final validator.',
        'One descriptor source supplies command id, visible label, actual key metadata, platform display label, enabled state, and runGroupCommand callback to the Context Menu consumer.',
        'The Layers/Contents header exposes no Group or Ungroup buttons; Context Menu and registered shortcuts are the only command surfaces.',
        'macOS maps Group to Meta+G with visible label ⌘G and Ungroup to Meta+Shift+G with visible label ⇧⌘G.',
        'Windows and Linux map Group to Ctrl+G with visible label Ctrl+G and Ungroup to Ctrl+Shift+G with visible label Ctrl+Shift+G.',
        'Registered keyboard input emits the same group or ungroup command intent advertised by the matching descriptor and consumed by the existing Group feature.'
      ],
      bypasses: [
        'Editable shortcut targets retain native behavior and emit no command intent.',
        'An unavailable command remains visible and disabled; its keyboard input emits no executable feature request and performs no mutation.'
      ],
      allowedContributors: [
        'existing deriveGroupCommandState projection',
        'existing runGroupCommand feature API handoff',
        'central InputSystem key map and event constants',
        'test-injected platform formatter input'
      ],
      forbiddenContributors: [
        'row-local hardcoded shortcut text',
        'Design System platform detection or command policy',
        'Input System eligibility or menu semantics',
        'a second Group or Ungroup implementation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/config',
        'apps/asyra-design/src/controllers',
        'apps/asyra-design/src/contents',
        'apps/asyra-design/src/features/group-elements',
        'apps/asyra-design/src/constants',
        'apps/asyra-design/e2e',
        'apps/asyra-design/package.json',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#command-rows',
        '#operating-system-shortcut-labels',
        '#product-cases'
      ],
      failureOwnerStepId: 'project-group-command-descriptors'
    },
    {
      id: 'present-design-system-context-menu',
      order: 1,
      laneId: 'presentation',
      title: 'Present an accessible reusable Context Menu',
      ownerPackage: '@asyra/design-system',
      purpose:
        'Render reusable menu and command-row presentation from app-supplied items, position, enabled state, shortcut text, and intent callbacks without importing app or canonical product policy.',
      inputs: [
        'artifact:app-context-menu-session',
        'artifact:projected-group-command-rows'
      ],
      outputs: [
        'artifact:accessible-context-menu-presentation',
        'artifact:activated-menu-command',
        'artifact:context-menu-dismiss-intent',
        'artifact:disabled-menu-command-bypass'
      ],
      conditions: [
        'The menu exposes role menu and each fixed-order row exposes role menuitem, accessible name, and announced aria-disabled state.',
        'Each row uses one horizontal layout with the command label on the left and the supplied shortcut label on the right; an absent shortcut renders an empty right-side value.',
        'Hover, focus, active, and disabled presentation uses shared Design System tokens and no fixture-specific label offsets.',
        'The app-supplied pointer origin is measured and clamped inside the supplied visible viewport boundary so the complete menu remains accessible at every edge.',
        'Focus enters the first enabled row; ArrowUp and ArrowDown move among enabled rows, Home and End choose the first and last enabled row, and Enter or Space emits one enabled-item activation.',
        'Escape, outside primary-pointer press, and Tab emit dismissal intent; Tab does not trap ordinary focus traversal.'
      ],
      bypasses: [
        'A disabled row cannot emit activation and produces only a presentation-local bypass with no app command.',
        'If every item is disabled, the menu itself remains focusable and dismissal controls remain available.'
      ],
      allowedContributors: [
        'app-supplied presentation props and intent callbacks',
        'React and React DOM portal lifecycle',
        'Design System spacing, color, border, shadow, and typography tokens',
        'browser layout measurement for generic viewport fit'
      ],
      forbiddenContributors: [
        'Asyra Design selection or hierarchy reads',
        'Core, Factory, Feature, Preset, Render, or Input System imports',
        'platform detection or Group command eligibility',
        'canonical document mutation or app-owned menu session'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/design-system/src/components',
        'packages/design-system/src/index.tsx',
        'packages/design-system/src/index.css',
        'docs/ai/framework/packages/design-system.md',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#positioning-and-visual-behavior',
        '#dismissal-and-accessibility',
        '#ownership-contract'
      ],
      failureOwnerStepId: 'present-design-system-context-menu'
    },
    {
      id: 'handoff-enabled-command-to-feature',
      order: 1,
      laneId: 'execution',
      title: 'Handoff one enabled command to the existing feature',
      ownerPackage: 'Asyra Design Group command routing',
      purpose:
        'Close an activated menu session and dispatch exactly one existing Group/Ungroup feature command, while the registered shortcut route dispatches that same feature contract without creating a parallel mutation path.',
      inputs: [
        'artifact:activated-menu-command',
        'artifact:registered-group-shortcut-intent'
      ],
      outputs: [
        'artifact:existing-group-feature-outcome',
        'artifact:group-command-handoff-rejection'
      ],
      conditions: [
        'The menu route consumes one enabled activated descriptor, closes the menu first, and invokes runGroupCommand exactly once.',
        'The keyboard route consumes one registered shortcut intent and invokes the same existing feature definition and command request path exactly once.',
        'Both routes re-evaluate or preserve the existing app eligibility contract and leave Scene Tree as final canonical validator.',
        'The existing Group feature retains one intended Factory transaction, post-operation selection, rollback, history, shared publication, and product-facing failure route.'
      ],
      bypasses: [
        'A disabled, stale, or unavailable command dispatches no feature and performs no canonical or selection mutation.',
        'A canonical rejection is not retried, reinterpreted, or replaced by another Group/Ungroup operation.'
      ],
      allowedContributors: [
        'artifact:activated-menu-command',
        'artifact:registered-group-shortcut-intent',
        'existing runGroupCommand controller',
        'existing Group feature API and command request'
      ],
      forbiddenContributors: [
        'direct hierarchy or selection mutation in Context Menu or Layers UI',
        'a second transaction or Group feature',
        'fallback command routing',
        'Render or Input System product mutation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/app',
        'apps/asyra-design/src/controllers',
        'apps/asyra-design/src/features/group-elements',
        'apps/asyra-design/src/render-app',
        'apps/asyra-design/src/contents',
        'apps/asyra-design/e2e',
        'apps/asyra-design/package.json',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#command-rows',
        '#operating-system-shortcut-labels',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'handoff-enabled-command-to-feature'
    },
    {
      id: 'teardown-isolate-menu-instance',
      order: 1,
      laneId: 'lifecycle',
      title: 'Dispose menu resources and preserve app-root isolation',
      ownerPackage: 'Asyra Design and Design System menu lifecycle',
      purpose:
        'Dispose the current app-root menu session, portal, listeners, and focus handles without sharing open state or platform presentation across app instances.',
      inputs: [
        'artifact:app-context-menu-session',
        'artifact:accessible-context-menu-presentation',
        'mounted app-root and canvas-host lifecycle'
      ],
      outputs: ['artifact:disposed-isolated-menu-instance'],
      conditions: [
        'Unmount, canvas teardown, replacement, and ordinary dismissal remove the owned portal and document listeners exactly once.',
        'The mounted-session route consumes the app session and presentation resources; teardown before presentation consumes only the mounted app-root lifecycle and any existing session.',
        'Focus restoration never targets another app root.',
        'Two simultaneously mounted app roots own independent open state, pointer position, focused item, and injected platform presentation.'
      ],
      bypasses: [
        'Teardown with no open session leaves canonical and UI state unchanged.',
        'One app root closing or unmounting cannot dismiss, reposition, or reformat another root menu.'
      ],
      allowedContributors: [
        'instance-local React lifecycle',
        'owned portal root and document listeners',
        'invoking canvas-host focus handle'
      ],
      forbiddenContributors: [
        'module-global menu or platform state',
        'cross-root focus restoration',
        'retained document listeners after teardown',
        'canonical cleanup transaction'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/render-app',
        'apps/asyra-design/src/app',
        'packages/design-system/src/components',
        'apps/asyra-design/e2e',
        'apps/asyra-design/package.json',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#dismissal-and-accessibility',
        '#product-cases',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'teardown-isolate-menu-instance'
    }
  ]

  const routes = [
    {
      id: 'canvas-context-event-accepted',
      from: 'intake-canvas-context-event',
      to: 'manage-app-menu-session',
      kind: 'input',
      predicate: 'native contextmenu target belongs to the canvas host',
      producedArtifacts: ['artifact:accepted-canvas-context-invocation']
    },
    {
      id: 'native-context-menu-bypasses',
      from: 'intake-canvas-context-event',
      kind: 'terminal',
      predicate: 'target is editable, app chrome, outside, or unmounted',
      producedArtifacts: ['artifact:native-context-menu-bypass']
    },
    {
      id: 'menu-session-reaches-presentation',
      from: 'manage-app-menu-session',
      to: 'present-design-system-context-menu',
      kind: 'presentation',
      predicate: 'one app-local menu session is open',
      producedArtifacts: ['artifact:app-context-menu-session']
    },
    {
      id: 'menu-session-reaches-teardown',
      from: 'manage-app-menu-session',
      to: 'teardown-isolate-menu-instance',
      kind: 'resource',
      predicate: 'the mounted app root owns the current menu session',
      producedArtifacts: ['artifact:app-context-menu-session']
    },
    {
      id: 'menu-session-dismisses',
      from: 'manage-app-menu-session',
      kind: 'terminal',
      predicate: 'dismiss, activation close, replacement, or teardown settles',
      producedArtifacts: ['artifact:context-menu-session-dismissed']
    },
    {
      id: 'command-rows-reach-presentation',
      from: 'project-group-command-descriptors',
      to: 'present-design-system-context-menu',
      kind: 'projection',
      predicate: 'current selection and injected platform produce row props',
      producedArtifacts: ['artifact:projected-group-command-rows']
    },
    {
      id: 'registered-shortcut-reaches-feature',
      from: 'project-group-command-descriptors',
      to: 'handoff-enabled-command-to-feature',
      kind: 'command',
      predicate:
        'non-editable actual shortcut resolves to an available command',
      producedArtifacts: ['artifact:registered-group-shortcut-intent']
    },
    {
      id: 'menu-presentation-reaches-teardown',
      from: 'present-design-system-context-menu',
      to: 'teardown-isolate-menu-instance',
      kind: 'resource',
      predicate: 'the owned portal and listeners are mounted',
      producedArtifacts: ['artifact:accessible-context-menu-presentation']
    },
    {
      id: 'enabled-menu-command-reaches-feature',
      from: 'present-design-system-context-menu',
      to: 'handoff-enabled-command-to-feature',
      kind: 'command',
      predicate: 'focused or clicked row is enabled',
      producedArtifacts: ['artifact:activated-menu-command']
    },
    {
      id: 'presentation-dismissal-reaches-session',
      from: 'present-design-system-context-menu',
      to: 'manage-app-menu-session',
      kind: 'intent',
      predicate:
        'Escape, outside primary press, Tab, or activation requests close',
      producedArtifacts: ['artifact:context-menu-dismiss-intent']
    },
    {
      id: 'disabled-menu-command-terminates',
      from: 'present-design-system-context-menu',
      kind: 'terminal',
      predicate: 'disabled row receives pointer or keyboard activation attempt',
      producedArtifacts: ['artifact:disabled-menu-command-bypass']
    },
    {
      id: 'existing-group-feature-succeeds',
      from: 'handoff-enabled-command-to-feature',
      kind: 'terminal',
      predicate: 'existing Group or Ungroup feature command commits',
      producedArtifacts: ['artifact:existing-group-feature-outcome']
    },
    {
      id: 'group-command-handoff-rejects',
      from: 'handoff-enabled-command-to-feature',
      kind: 'terminal',
      predicate: 'disabled, stale, unavailable, or canonical command rejects',
      producedArtifacts: ['artifact:group-command-handoff-rejection']
    },
    {
      id: 'menu-instance-disposes',
      from: 'teardown-isolate-menu-instance',
      kind: 'terminal',
      predicate: 'owned resources are removed without cross-root effects',
      producedArtifacts: ['artifact:disposed-isolated-menu-instance']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:accepted-canvas-context-invocation',
      ownerStepId: 'intake-canvas-context-event',
      channel: 'React canvas-host context event',
      consumerStepIds: ['manage-app-menu-session'],
      terminal: false
    },
    {
      id: 'artifact:native-context-menu-bypass',
      ownerStepId: 'intake-canvas-context-event',
      channel: 'terminal native browser route',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:app-context-menu-session',
      ownerStepId: 'manage-app-menu-session',
      channel: 'app-root-local React state',
      consumerStepIds: [
        'present-design-system-context-menu',
        'teardown-isolate-menu-instance'
      ],
      terminal: false
    },
    {
      id: 'artifact:context-menu-session-dismissed',
      ownerStepId: 'manage-app-menu-session',
      channel: 'terminal app-local UI result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:projected-group-command-rows',
      ownerStepId: 'project-group-command-descriptors',
      channel: 'app command presentation projection',
      consumerStepIds: ['present-design-system-context-menu'],
      terminal: false
    },
    {
      id: 'artifact:registered-group-shortcut-intent',
      ownerStepId: 'project-group-command-descriptors',
      channel: 'registered InputSystem feature intent',
      consumerStepIds: ['handoff-enabled-command-to-feature'],
      terminal: false
    },
    {
      id: 'artifact:accessible-context-menu-presentation',
      ownerStepId: 'present-design-system-context-menu',
      channel: 'Design System React portal',
      consumerStepIds: ['teardown-isolate-menu-instance'],
      terminal: false
    },
    {
      id: 'artifact:activated-menu-command',
      ownerStepId: 'present-design-system-context-menu',
      channel: 'app intent callback',
      consumerStepIds: ['handoff-enabled-command-to-feature'],
      terminal: false
    },
    {
      id: 'artifact:context-menu-dismiss-intent',
      ownerStepId: 'present-design-system-context-menu',
      channel: 'app intent callback',
      consumerStepIds: ['manage-app-menu-session'],
      terminal: false
    },
    {
      id: 'artifact:disabled-menu-command-bypass',
      ownerStepId: 'present-design-system-context-menu',
      channel: 'terminal presentation result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:existing-group-feature-outcome',
      ownerStepId: 'handoff-enabled-command-to-feature',
      channel: 'existing Group feature result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:group-command-handoff-rejection',
      ownerStepId: 'handoff-enabled-command-to-feature',
      channel: 'terminal existing failure route',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:disposed-isolated-menu-instance',
      ownerStepId: 'teardown-isolate-menu-instance',
      channel: 'terminal lifecycle result',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const invariants = [
    {
      id: 'app-owns-menu-policy',
      title: 'Asyra Design owns menu state and command policy',
      statement:
        'Input System normalizes input and Design System presents props; neither owns which menu opens, which command is enabled, or which Group feature executes.',
      stepIds: [
        'intake-canvas-context-event',
        'manage-app-menu-session',
        'project-group-command-descriptors',
        'present-design-system-context-menu'
      ],
      artifactIds: [
        'artifact:accepted-canvas-context-invocation',
        'artifact:app-context-menu-session',
        'artifact:projected-group-command-rows'
      ],
      specRefs: ['#ownership-contract']
    },
    {
      id: 'one-shared-group-command-contract',
      title: 'Every command surface reaches one existing Group feature',
      statement:
        'Context Menu and actual Meta/Ctrl shortcuts derive from shared descriptors and dispatch the existing Group/Ungroup feature without a parallel transaction or failure path; the Layers/Contents header exposes no Group or Ungroup buttons.',
      stepIds: [
        'project-group-command-descriptors',
        'handoff-enabled-command-to-feature'
      ],
      artifactIds: [
        'artifact:projected-group-command-rows',
        'artifact:registered-group-shortcut-intent',
        'artifact:activated-menu-command',
        'artifact:existing-group-feature-outcome'
      ],
      specRefs: ['#command-rows', '#operating-system-shortcut-labels']
    },
    {
      id: 'menu-only-interaction-is-non-mutating',
      title: 'Menu-only interaction never changes canonical state',
      statement:
        'Opening, replacement, focus movement, disabled activation, dismissal, cancellation, and teardown remain UI-local and create no transaction, history, publication, selection write, or save.',
      stepIds: [
        'manage-app-menu-session',
        'present-design-system-context-menu',
        'teardown-isolate-menu-instance'
      ],
      artifactIds: [
        'artifact:app-context-menu-session',
        'artifact:disabled-menu-command-bypass',
        'artifact:context-menu-session-dismissed',
        'artifact:disposed-isolated-menu-instance'
      ],
      specRefs: ['#open-trigger-and-scope', '#dismissal-and-accessibility']
    },
    {
      id: 'canonical-group-owners-remain-unchanged',
      title: 'Existing canonical Group owners remain unchanged',
      statement:
        'Scene Tree, Preset, Factory, Selection, Render, persistence, and remote restore retain their completed canonical contracts with no app fallback or second state.',
      stepIds: ['handoff-enabled-command-to-feature'],
      artifactIds: [
        'artifact:existing-group-feature-outcome',
        'artifact:group-command-handoff-rejection'
      ],
      specRefs: ['#existing-group-owners', '#explicit-non-goals']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'canvas-intake-and-session-cases',
      title: 'Canvas-scoped intake, replacement, and non-mutation',
      assertions: [
        'Canvas right-click opens one menu at exact client coordinates and a second right-click replaces and repositions it.',
        'Editable fields and non-canvas app surfaces retain native or existing behavior because only accepted canvas events are prevented.',
        'Opening, replacement, focus, disabled rows, dismissal, and teardown create no canonical or selection mutation.'
      ],
      stepIds: ['intake-canvas-context-event', 'manage-app-menu-session'],
      specRefs: ['#product-cases', '#open-trigger-and-scope']
    },
    {
      id: 'command-descriptor-and-shortcut-cases',
      title: 'Fixed rows, platform labels, eligibility, and actual shortcuts',
      assertions: [
        'Group appears before Ungroup with left command labels and right platform shortcut labels.',
        'macOS shows ⌘G and ⇧⌘G and actual Meta+G and Meta+Shift+G invoke the matching existing Group feature command.',
        'Windows/Linux shows Ctrl+G and Ctrl+Shift+G and actual Ctrl+G and Ctrl+Shift+G invoke the matching existing Group feature command.',
        'Valid multi-selection enables Group; one official Group enables Ungroup; unavailable commands remain visible and disabled.',
        'The Layers/Contents header exposes no Group or Ungroup buttons.'
      ],
      stepIds: [
        'project-group-command-descriptors',
        'handoff-enabled-command-to-feature'
      ],
      specRefs: [
        '#command-rows',
        '#operating-system-shortcut-labels',
        '#product-cases'
      ]
    },
    {
      id: 'presentation-accessibility-and-edge-cases',
      title: 'Reusable layout, viewport fit, and accessible navigation',
      assertions: [
        'The complete menu stays inside the visible viewport at center, edge, and corner origins.',
        'Standard menu and menuitem roles, accessible names, disabled state, focus entry, Arrow, Home, End, Enter, Space, Escape, outside press, and Tab behavior are correct.',
        'The reusable row leaves the shortcut side empty when no shortcut is supplied and contains no app command policy.'
      ],
      stepIds: ['present-design-system-context-menu'],
      specRefs: [
        '#positioning-and-visual-behavior',
        '#dismissal-and-accessibility',
        '#product-cases'
      ]
    },
    {
      id: 'execution-failure-and-isolation-cases',
      title: 'Existing feature execution, failure, and app-root isolation',
      assertions: [
        'Enabled menu activation closes first and invokes one existing Group/Ungroup feature command exactly once.',
        'Disabled, stale, unavailable, and canonical rejection routes perform no fallback, retry, or partial mutation.',
        'Separate app roots do not share menu open state, pointer position, focus, or injected platform labels, and teardown removes owned resources.'
      ],
      stepIds: [
        'handoff-enabled-command-to-feature',
        'teardown-isolate-menu-instance'
      ],
      specRefs: ['#product-cases', '#definition-of-done']
    },
    {
      id: 'completion-gates-and-exclusions',
      title: 'Bounded completion and review gates',
      assertions: [
        'Input System, Design System, Inspector, app, E2E, Gherkin/BDD synchronization, dependency, lint, build, template sync, and synchronized center/edge visual gates pass.',
        'No app fallback, second selection or hierarchy state, patch geometry, Render repair path, remote menu policy, extra command, or app-only duplicate menu primitive is introduced.',
        'The follow-up may update the existing PR #97 but stops for explicit user review before another closeout or merge.'
      ],
      stepIds: [
        'intake-canvas-context-event',
        'manage-app-menu-session',
        'project-group-command-descriptors',
        'present-design-system-context-menu',
        'handoff-enabled-command-to-feature',
        'teardown-isolate-menu-instance'
      ],
      specRefs: [
        '#required-validation',
        '#explicit-non-goals',
        '#definition-of-done'
      ]
    }
  ]

  const flowInspectorData = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'asyra-design-group-context-menu',
      kind: 'feature',
      title: 'Asyra Design Group Context Menu Inspector',
      subtitle:
        'Canvas-scoped native intake, app-local session and shared Group command descriptors, reusable Design System presentation, existing feature execution, and isolated teardown.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Asyra Design Group Context Menu Plan',
      inspectorOwner: 'Asyra Design Group Context Menu owner flow'
    },
    links: [
      {
        id: 'group-context-menu-plan',
        kind: 'authority',
        label: 'Product contract',
        href: './group-context-menu-plan.md'
      },
      {
        id: 'existing-group-inspector',
        kind: 'prerequisite',
        label: 'Existing Group feature authority',
        href: './group-interaction-mvp-flow-inspector.html'
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
