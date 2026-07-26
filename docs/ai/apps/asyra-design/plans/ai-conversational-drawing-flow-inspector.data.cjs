;(function () {
  'use strict'

  const specPath =
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-plan.md'
  const inspectorPath =
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-flow-inspector.data.cjs'

  const lanes = [
    {
      id: 'conversation-ui',
      title: 'Conversation Input and Lifecycle',
      order: 1
    },
    { id: 'provider-runtime', title: 'Mock Provider and AI Runtime', order: 2 },
    { id: 'app-execution', title: 'App Action and Transaction', order: 3 },
    {
      id: 'document-durability',
      title: 'Committed Document Durability',
      order: 4
    },
    {
      id: 'result-projection',
      title: 'Conversation and History Projection',
      order: 5
    }
  ]

  const steps = [
    {
      id: 'accept-mock-conversation-intent',
      order: 1,
      laneId: 'conversation-ui',
      title: 'Accept one mock-mode conversation intent',
      ownerPackage: 'Asyra Design AI conversation UI',
      purpose:
        'Expose one app-root-local non-modal Mock AI panel only for exact ai=mock activation and turn one non-empty user submission into one UI intent without starting a second queue.',
      inputs: [
        'exact app URL AI mode',
        'toolbar AI activation',
        'conversation input text',
        'local PNG, JPEG, or WebP files added through selection or drag-and-drop',
        'latest unresolved App-owned drawing-detail choice and its settled-turn attachment context',
        'current app-root panel and active-turn state'
      ],
      outputs: [
        'artifact:user-ai-turn-intent',
        'artifact:conversation-intent-bypass'
      ],
      conditions: [
        'Exact ai=mock mode exposes one toolbar AI control, one platform-labelled Meta/Ctrl+I toggle shortcut, one canvas Context Menu Toggle Agent Panel command, and one Agent panel whose mock status is shown without a provider or speaker name; missing, empty, and unknown AI modes construct no AI UI or runtime, including none of those AI entry surfaces.',
        'Toolbar, shortcut, and Context Menu activation share one app-root-local toggle command; opening focuses the prompt and closing restores the safe connected invoker without trapping canvas interaction.',
        'A draft containing trimmed text with no active AI turn produces one immutable user intent with any detached image attachment descriptors and clears the editable draft only after the controller accepts it.',
        'File selection and panel drag-and-drop share one app-root-local attachment draft; accepted PNG, JPEG, and WebP images show removable accessible thumbnails before submission and submitted thumbnails remain visible in the user turn.',
        'Attachment descriptors contain only file name, accepted media type, byte size, and provider-required image data; they remain in-memory and are never uploaded, written into canonical document state, persisted, or collaboration-shared.',
        'Selecting Balanced detail or Maximum detail on the latest unresolved clarification submits exactly one new App-owned selection intent through the existing conversation controller with the original settled-turn attachments; it never rereads, reuploads, or copies the image into a second request path.',
        'Once selection starts, active-turn exclusion prevents double submission; after any later turn settles, the older clarification remains readable conversation history but no longer exposes actionable choice buttons.',
        'The panel is non-modal and app-root-local so the user can observe ordinary canvas output while the conversation remains open.',
        'One active turn disables Send and attachment changes and exposes Cancel; a second turn is rejected rather than queued.'
      ],
      bypasses: [
        'A draft without trimmed text emits no Feature or provider request, whether or not an image remains in the editable draft.',
        'A choice on a non-latest clarification, a disposed controller, or any active turn emits no new UI intent.',
        'Unsupported files and browser read failures show one concise draft error, preserve the editable draft, and emit no Feature or provider request.',
        'AI-disabled and unknown-mode startup creates no runtime, provider, Feature, mock timer, observer, controller, or AI panel.',
        'Closing a settled panel performs no canonical mutation; closing an active panel emits cancellation through the conversation controller.'
      ],
      allowedContributors: [
        'Asyra Design URL mode parser',
        'instance-local React state',
        'app toolbar and conversation presentation',
        'registered App drawing-detail option identities and selection intents',
        'browser File, FileReader, and drag-and-drop APIs',
        '@asyra/design-system public presentation primitives'
      ],
      forbiddenContributors: [
        'canonical document state as UI draft storage',
        'module-global conversation or active-turn singleton',
        'provider, transaction, or action execution in React handlers',
        'remote image upload, canonical attachment storage, persistence, or collaboration state',
        'default production or generated-app AI activation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/app',
        'apps/asyra-design/src/toolbar',
        'apps/asyra-design/src/config',
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/init',
        'apps/asyra-design/src/constants',
        'apps/asyra-design/src/app/__tests__',
        'apps/asyra-design/src/config/__tests__',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/package.json',
        'apps/asyra-design/e2e',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#explicit-mock-activation',
        '#conversation-surface',
        '#product-cases'
      ],
      failureOwnerStepId: 'accept-mock-conversation-intent'
    },
    {
      id: 'manage-one-conversation-turn',
      order: 2,
      laneId: 'conversation-ui',
      title: 'Manage one Feature-owned conversation turn',
      ownerPackage: 'Asyra Design AI conversation controller and Feature',
      purpose:
        'Assign app-local conversation and turn identity, revalidate non-authoritative semantic target hints, invoke or cancel the one exclusive AI Feature task, and produce one detached terminal turn record.',
      inputs: [
        'artifact:user-ai-turn-intent',
        'artifact:runtime-terminal-result',
        'detached image attachment descriptors from the accepted UI intent',
        'current conversation id and ordered settled turns',
        'non-authoritative semantic role to element-id hints',
        'app common-API canonical target queries'
      ],
      outputs: [
        'artifact:active-conversation-turn',
        'artifact:settled-conversation-turn'
      ],
      conditions: [
        'Each accepted input receives one stable conversation id, one ordered turn id, and one Feature-owned AbortSignal without a controller-owned execution queue.',
        'Accepted immutable image attachment descriptors are copied into the active and settled turn and the Feature request metadata so the runtime provider receives the same app-owned attachment context without a second request path.',
        'Attachment descriptors remain detached JSON-safe in-memory context and are never uploaded, persisted, collaboration-shared, or treated as canonical scene state.',
        'Before a follow-up request, every hinted element id is revalidated against current canonical state and only existing permitted targets enter app context.',
        'A creation result may update session hints from detached semantic-role and generated-id evidence; the hints never become canonical state.',
        'The runtime terminal result settles exactly one active turn and records success, partial, cancelled, unavailable, failed, or no-change outcome with one non-negative monotonic duration from accepted submission through settlement.',
        'A follow-up update targets existing ids and never falls back to deleting and regenerating the complete original composition.'
      ],
      bypasses: [
        'Missing or ambiguous follow-up targets produce a bounded no-mutation turn or explicit clarification request.',
        'Cancellation before mutation settles as cancelled and applies no later result.',
        'Empty, invalid, disposed, or overlapping submissions create no elapsed-time record because no new turn is accepted.',
        'Reload, app-root teardown, conversation disposal, or successful composition deletion removes the in-memory target hints.'
      ],
      allowedContributors: [
        'artifact:user-ai-turn-intent',
        'artifact:runtime-terminal-result',
        '@asyra/feature-system programmatic task lifecycle',
        'app common-API canonical queries',
        'instance-local conversation records',
        'detached JSON-safe image attachment descriptors'
      ],
      forbiddenContributors: [
        'a second execute, session, retry, or cancellation owner',
        'stale target hints treated as canonical truth',
        'whole-composition regeneration fallback',
        'attachment upload, canonical attachment state, persistence, or collaboration document state',
        'persisted or collaboration-shared conversation state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/features/ai-agent',
        'apps/asyra-design/src/common-apis',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/features/ai-agent/__tests__',
        'apps/asyra-design/package.json',
        'apps/asyra-design/e2e',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#incremental-follow-up-targeting',
        '#asyra-design-ai-feature-and-conversation-controller',
        '#product-cases'
      ],
      failureOwnerStepId: 'manage-one-conversation-turn'
    },
    {
      id: 'produce-deterministic-mock-candidate',
      order: 1,
      laneId: 'provider-runtime',
      title: 'Produce one delayed deterministic mock candidate',
      ownerPackage: 'Asyra Design mock AI provider',
      purpose:
        'Map one bounded provider request to a deterministic fixture after a finite abortable delay and return only the public untrusted candidate-plan shape or a stable provider failure.',
      inputs: [
        'artifact:provider-plan-request',
        'bounded Traditional Chinese and English fixture table',
        'detached image attachment descriptors in provider metadata',
        'injected scheduler or product mock delay',
        'Feature-owned AbortSignal'
      ],
      outputs: [
        'artifact:mock-candidate-plan',
        'artifact:mock-provider-failure'
      ],
      conditions: [
        'A bounded draw-this-image phrase with at least one accepted detached image attachment returns only the registered non-mutating request_drawing_detail_choice candidate; it does not select or materialize a drawing fixture.',
        'The exact English draw-only-the-cat instruction with one accepted detached image attachment directly returns the balanced cat-only fixture: its original photographic background is absent and one pure-white ordinary editable background Vector has workspace bounds equal to the uploaded image intrinsic pixel width and height decoded locally from the accepted data URL.',
        'The exact App-owned Balanced detail selection intent with the retained accepted attachment and the ordinary or explicitly detailed text-only cat-face phrases use the balanced frontal tabby fixture with 7,111 ordinary editable VTracer-derived polygon items, at least 115,000 canonical points, and at least 90 editable colors.',
        'The exact App-owned Maximum detail selection intent with the retained accepted attachment uses the highest live-validated frontal tabby fixture with 27,471 valid ordinary editable VTracer-derived polygon items and 295,794 canonical points; every item has at least one finite non-degenerate subpath, and zero-area closed subpaths from the source trace are discarded at the import boundary.',
        'Eye-size, whisker-color, pupil-color, confirmation-delete, balanced partial, failure, and unsupported fixtures are deterministic for the same detached provider input.',
        'The mock provider may decode only the accepted attachment intrinsic pixel dimensions needed by the exact cat-only fixture; raw image data never enters action arguments, provider explanation, progress, or canonical output.',
        'The finite product delay and test-injected scheduler are abortable and release their timer on resolve, reject, abort, or disposal.',
        'A successful fixture returns only planId, optional concise explanation, and ordered id/name/arguments actions.',
        'The explanation describes intended visible work and never contains fabricated private chain-of-thought.'
      ],
      bypasses: [
        'A draw-this-image phrase without an accepted detached image attachment is unsupported and produces no action candidate.',
        'A balanced or maximum detail-selection intent without its retained accepted attachment is unsupported and produces no drawing candidate.',
        'An unsupported phrase returns the declared no-mutation fixture and never invents an unregistered action.',
        'Abort or disposal prevents a delayed candidate from reaching runtime normalization.',
        'Provider failure emits no executor, transaction, history, or canonical mutation.'
      ],
      allowedContributors: [
        'artifact:provider-plan-request',
        'app-owned deterministic fixture table',
        'detached provider metadata describing accepted image attachments',
        'injected scheduler and finite delay',
        '@asyra/ai-agent-runtime AiProvider public contract'
      ],
      forbiddenContributors: [
        'network fetch, model SDK, API key, browser secret, or backend proxy',
        'attachment upload or image data copied into action arguments, explanation, or progress',
        'canonical state or app common-API mutation',
        'permission, confirmation, transaction, or history decisions',
        'mock-only provider output fields outside the public candidate shape'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/package.json',
        'apps/asyra-design/e2e',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#deterministic-mock-provider',
        '#operational-progress-not-hidden-reasoning',
        '#explicit-non-goals'
      ],
      failureOwnerStepId: 'produce-deterministic-mock-candidate'
    },
    {
      id: 'orchestrate-runtime-preflight-and-progress',
      order: 2,
      laneId: 'provider-runtime',
      title: 'Orchestrate complete preflight and detached progress',
      ownerPackage: '@asyra/ai-agent-runtime',
      purpose:
        'Use the completed Gate 4 flow to collect redacted context, request and normalize one candidate, validate every action, evaluate permission, await optional confirmation, execute one accepted plan, and emit observational progress without changing terminal semantics.',
      inputs: [
        'artifact:active-conversation-turn',
        'artifact:mock-candidate-plan',
        'artifact:mock-provider-failure',
        'artifact:app-confirmation-decision',
        'artifact:app-action-execution-result',
        'artifact:fatal-app-action-rejection',
        'registered action descriptions and app context',
        'optional detached progress observer'
      ],
      outputs: [
        'artifact:provider-plan-request',
        'artifact:runtime-progress-update',
        'artifact:app-confirmation-request',
        'artifact:accepted-app-action-plan',
        'artifact:runtime-terminal-result'
      ],
      conditions: [
        'The runtime emits stable redacted operational phases for context, planning, validation, permission, confirmation wait, execution, and terminal settlement when an observer exists.',
        'Progress is detached, observational, ordered per invocation, and cannot alter retry, permission, confirmation, transaction, action order, cancellation, or terminal results.',
        'Observer exceptions are contained; abort/disposal prevents later progress and releases observer references.',
        'The complete provider candidate validates before permission, confirmation, transaction, or executor mutation.',
        'A confirm permission produces one app confirmation request and awaits its decision while racing Feature abort.',
        'One accepted plan is handed to one app transaction execution; a resolved partial app result remains an executed result, while a rejected executor is fatal.'
      ],
      bypasses: [
        'No observer produces no progress callback, listener, timer, or changed result.',
        'Provider failure, malformed/unknown/invalid action, permission denial, confirmation rejection, abort, and timeout settle without canonical mutation.',
        'Allow-only plans bypass app confirmation and enter execution once.',
        'AI-disabled and provider-disabled routes preserve the completed Gate 4 zero-side-effect behavior.'
      ],
      allowedContributors: [
        'artifact:active-conversation-turn',
        'artifact:mock-candidate-plan',
        'artifact:mock-provider-failure',
        'artifact:app-confirmation-decision',
        'artifact:app-action-execution-result',
        'artifact:fatal-app-action-rejection',
        'completed AI Agent Runtime registry, provider, preflight, confirmation, execution, redaction, and lifecycle owners'
      ],
      forbiddenContributors: [
        'React, app conversation UI, mock phrase policy, or Message Bar state',
        'raw provider body, secret, action arguments, canonical state, or chain-of-thought in progress',
        'observer mutation authority or observer failure propagation',
        'framework-owned app permission, confirmation presentation, drawing semantics, history, or target hints'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src',
        'packages/ai-agent-runtime/package.json',
        'packages/ai-agent-runtime/src/__tests__',
        'docs/ai/framework/packages/ai-agent-runtime.md',
        'docs/ai/framework/golden-paths/compose-ai-agent-runtime.md',
        'docs/ai/framework/plans/__tests__',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#operational-progress-not-hidden-reasoning',
        '#confirmation-handshake',
        '#asyraai-agent-runtime'
      ],
      failureOwnerStepId: 'orchestrate-runtime-preflight-and-progress'
    },
    {
      id: 'resolve-app-confirmation',
      order: 3,
      laneId: 'provider-runtime',
      title: 'Resolve one visible app confirmation wait',
      ownerPackage: 'Asyra Design confirmation handler and conversation UI',
      purpose:
        'Turn one redacted confirmation request into a concise visible impact prompt and resolve accept, reject, abort, or teardown through the app-owned handler without requiring low-level or visual plan preview.',
      inputs: [
        'artifact:app-confirmation-request',
        'active conversation turn identity',
        'mounted panel and app-root lifecycle',
        'Feature-owned AbortSignal'
      ],
      outputs: ['artifact:app-confirmation-decision'],
      conditions: [
        'The active panel visibly enters waiting-for-confirmation state and states action kind, affected target/count when known, undoability, and destructive or external impact.',
        'Accept resolves true exactly once; reject resolves false exactly once and opens no transaction.',
        'The App may derive an impact summary from the redacted prepared plan but does not show verbose action arguments by default.',
        'Feature abort, active-panel teardown, app teardown, or handler disposal releases the pending wait and removes owned UI/listeners.'
      ],
      bypasses: [
        'Allow-only plans produce no confirmation UI.',
        'A missing mounted handler cannot wait invisibly and resolves through the declared cancellation or configuration-failure path.',
        'Confirmation presentation performs no canonical, history, persistence, or collaboration mutation.'
      ],
      allowedContributors: [
        'artifact:app-confirmation-request',
        'app permission decision and impact-summary adapter',
        'instance-local conversation UI',
        'Feature-owned AbortSignal'
      ],
      forbiddenContributors: [
        'mandatory complete low-level action listing',
        'visual ghost scene or pre-commit canonical mutation',
        'framework-owned React UI or product wording',
        'unbounded or hidden pending Promise'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/app',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/app/__tests__',
        'apps/asyra-design/package.json',
        'apps/asyra-design/e2e',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#confirmation-handshake',
        '#conversation-surface',
        '#product-cases'
      ],
      failureOwnerStepId: 'resolve-app-confirmation'
    },
    {
      id: 'execute-one-app-composition-transaction',
      order: 1,
      laneId: 'app-execution',
      title: 'Execute one bounded app composition transaction',
      ownerPackage: 'Asyra Design AI actions and common APIs',
      purpose:
        'Apply one accepted insert, update, remove, visibility, or selection plan through strict app schemas and common APIs inside one app transaction while preserving app-owned recoverable partial results and fatal canonical rollback.',
      inputs: [
        'artifact:accepted-app-action-plan',
        'App-owned exact aiDelivery mode resolved as atomic or progressive',
        'current canonical target queries',
        'app common/public mutation APIs',
        'Factory transaction and history owner'
      ],
      outputs: [
        'artifact:app-action-execution-result',
        'artifact:fatal-app-action-rejection',
        'artifact:committed-canonical-persistence-snapshot'
      ],
      conditions: [
        'The registered request_drawing_detail_choice action accepts no provider-selected labels, counts, warnings, attachments, or canonical ids and resolves with App-owned drawing-detail option ids as structured no-change evidence.',
        'The drawing-detail clarification action performs no common-API or canonical mutation and produces no history commit or Undo control.',
        'Insert uses one strict validated batch descriptor, App-generated canonical ids, supported primitive/style fields, finite workspace bounds, and semantic roles without artificial item, subpath, per-path point, or composition point-count ceilings.',
        'Finite multi-element insertion crosses the App common API and Core injected Scene Tree batch-add request in ordered memory-bounded internal chunks inside the same outer transaction; chunks limit only simultaneous transient topology representations, never the accepted total item, subpath, or point count.',
        'The action creates one canonical Group from the validated composition bounds before streaming ordered child batches directly into that Group; the Scene Tree hierarchy owner applies parent membership once per internal chunk instead of repeatedly copying the growing parent child list for every element, and Factory commits one intended undo entry.',
        'The validated Scene Tree batch hierarchy owner replaces each next parent membership array through a clone-free internal canonical write instead of generic Setter cloneDeep, isEqual, and discarded raw-change capture; ordered per-element ADD_ELEMENT records remain the sole transaction, replay, undo/redo, Render, persistence, and optional Collaboration evidence for the batch.',
        'Direct grouped creation retains every original workspace topology point while supplying group-local computed bounds; it does not materialize the complete composition in the workspace and then perform a second full-scene read, 27,471-child move, or per-child geometry rewrite, and Maximum detail settles within the explicit 900-second live E2E budget.',
        'Single-path and finite multi-path Vector items both materialize as ordinary canonical topology networks and follow the same Render route without an AI-only renderer or fallback scene.',
        'Render hierarchy placement precedes the ordinary Preset Vector strategy, and Preset Group projection preserves every Vector workspace point through ancestor transforms; direct grouped creation and later projection must not rewrite canonical vector topology or visually apply the Group origin twice.',
        'Update targets only context-exposed ids revalidated immediately before mutation; oval geometry uses the ordinary element geometry boundary, Vector eye geometry scales every existing canonical anchor/control point around its own center while preserving element, point, segment, network, and subpath ids, whisker stroke color and pupil primary fill color use the ordinary App common APIs, and remove targets the active composition through the ordinary subtree boundary.',
        'Recoverable duplicate, missing, or optional-item semantic failures are classified before a rollback-only nested mutation, skipped, and returned in a resolved partial result.',
        'Successful siblings continue and every committed mutation from the turn remains one intended undo entry.',
        'Executor rejection is reserved for failure that prevents canonical consistency and is propagated so the ordinary app transaction runner rolls back rollbackable writes.',
        'Render, persistence, history, and optional Collaboration receive only the ordinary canonical transaction route.',
        'Missing, duplicated, unknown, or exact atomic aiDelivery resolves to App-owned atomic delivery; it maps AI canonical writes to ordinary transaction-end shared delivery and publishes once only after the outer transaction commits.',
        'Exact progressive aiDelivery maps the same AI canonical writes to ordinary immediate shared delivery; insertion yields to the host after each point-aware child batch with the existing 256-item transient maximum and a 2,048-canonical-point soft target, while one intact over-target element remains one accepted batch and total items, paths, and points remain unlimited.',
        'A progressive multi-target update yields after each applied canonical update so a peer can observe more than one ordered canonical batch before the Agent turn settles.',
        'Atomic and progressive modes preserve the same one outer app transaction and one intended local undo entry; they never reduce accepted detail or turn network batches into separate history actions.',
        'Factory retains the source shared-delivery mode and canonical event boundaries for Undo and Redo replay; progressive replay may publish those batches incrementally while each direction remains one local history action, and already-published immediate work uses linked Factory compensation on rollback.',
        'The local public reference WebSocket transport accepts each resulting valid finite canonical publication without the ws default 100 MiB message ceiling; it never performs server-side splitting, adds an AI-specific route, or changes transaction, history, replay, or remote-apply ownership.'
      ],
      bypasses: [
        'A detail-choice clarification result bypasses canonical mutation while still settling through the ordinary resolved app-action result route.',
        'A zero-mutation result produces no empty undo record.',
        'A missing follow-up target is not replaced by whole-composition regeneration.',
        'Preflight, permission, confirmation, provider, or abort failure never enters this step.'
      ],
      allowedContributors: [
        'artifact:accepted-app-action-plan',
        'registered Asyra Design AI action schemas and executors',
        'App-owned drawing-detail option ids',
        'apps/asyra-design/src/common-apis public boundaries',
        '@asyra/core public Scene Tree facade',
        '@asyra/scene-tree canonical batch hierarchy owner',
        '@asyra/preset canonical Vector render projection',
        'Factory and canonical state-owner validation',
        'ordinary transaction-end and immediate shared delivery',
        'Factory-owned immediate compensation and canonical history replay'
      ],
      forbiddenContributors: [
        'provider-selected clarification labels, element counts, resource warnings, attachments, or image data',
        'provider-selected canonical ids or arbitrary property paths',
        'Render, Pixi, engine handles, package-private stores, or direct model mutation',
        'catching rollback-only fatal failure and committing a prefix',
        'item-level compensation or canonical snapshot ownership in the AI runtime',
        'AI-specific publication protocol, server-side message splitting, or one undo entry per network batch'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/constants',
        'apps/asyra-design/src/common-apis',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/common-apis/__tests__',
        'apps/asyra-design/src/common-apis/element/__tests__',
        'packages/factory/src',
        'packages/factory/src/__tests__',
        'packages/core/src',
        'packages/core/src/__tests__',
        'packages/scene-tree/src',
        'packages/scene-tree/src/__tests__',
        'packages/render/src/layers/scene/render-layer.ts',
        'packages/render/src/__tests__/scene-render-layer.test.ts',
        'packages/preset/src/components/vector.ts',
        'packages/preset/src/__tests__/vector-render-strategy.test.ts',
        'apps/asyra-design/collaboration-server.ts',
        'apps/asyra-design/src/collaboration',
        'apps/asyra-design/__tests__',
        'apps/asyra-design/package.json',
        'apps/asyra-design/e2e',
        'docs/ai/apps/asyra-design/API_SURFACES.md',
        'docs/ai/apps/asyra-design/modules/common-apis.md',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#app-owned-drawing-and-update-actions',
        '#partial-and-fatal-failure-classification',
        '#one-turn-one-transaction-one-history-message'
      ],
      failureOwnerStepId: 'execute-one-app-composition-transaction'
    },
    {
      id: 'persist-committed-document-snapshot',
      order: 1,
      laneId: 'document-durability',
      title: 'Persist the committed canonical document snapshot',
      ownerPackage: '@asyra/persistence selected by Asyra Design',
      purpose:
        'Store and reload the complete committed canonical document through capacity-appropriate browser persistence while preserving Core save scheduling, stable App document identity, explicit failure evidence, and one-time legacy localStorage migration.',
      inputs: [
        'artifact:committed-canonical-persistence-snapshot',
        'Core persistence save queue and transaction status',
        'App-selected FILE or FILE:<encoded fileId> document identity',
        'optional valid legacy localStorage snapshot'
      ],
      outputs: [
        'artifact:persisted-canonical-document',
        'artifact:document-persistence-failure'
      ],
      conditions: [
        'Asyra Design selects the framework IndexedDB provider for ordinary and collaboration document identities so a complete high-detail canonical document is not constrained by localStorage quota.',
        'Save and reload preserve the complete detached canonical snapshot, including ids, topology, hierarchy, styles, bounds, and document version, without an AI-specific storage representation.',
        'When IndexedDB has no document and the matching legacy localStorage key contains a valid snapshot, App startup writes that value to IndexedDB and removes the legacy key only after the durable write succeeds.',
        'Core remains the sole commit-time snapshot, serial save queue, and persistence-status owner; persisted acknowledgement and persistence-failed evidence remain separate from runtime commit.',
        'Attachments, conversation turns, progress, semantic target hints, and provider data never enter the canonical persistence snapshot.'
      ],
      bypasses: [
        'A non-mutating or rolled-back turn produces no committed snapshot for this step.',
        'An existing IndexedDB document bypasses legacy localStorage migration and remains authoritative for that App document identity.',
        'A missing legacy snapshot initializes the ordinary canonical empty document through the same IndexedDB provider.'
      ],
      allowedContributors: [
        'artifact:committed-canonical-persistence-snapshot',
        '@asyra/core existing persistence queue and status reporting',
        '@asyra/persistence IndexedDB provider',
        'Asyra Design document identity and startup migration composition',
        'browser IndexedDB and legacy localStorage APIs'
      ],
      forbiddenContributors: [
        'AI-specific canonical snapshot or persistence queue',
        'drawing-detail reduction, bitmap replacement, or dropped canonical elements',
        'attachment, conversation, progress, target-hint, or provider persistence',
        'silent fallback to a failed localStorage write',
        'runtime rollback caused only by provider acknowledgement failure'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/persistence/src',
        'packages/persistence/src/providers/__tests__',
        'packages/persistence/package.json',
        'yarn.lock',
        'apps/asyra-design/src/document-persistence.ts',
        'apps/asyra-design/src/render-app',
        'apps/asyra-design/src/controllers/app.ts',
        'apps/asyra-design/package.json',
        'apps/asyra-design/README.md',
        'apps/asyra-design/e2e',
        'create-app/asyra-design/template',
        'release-configs/asyra-design.json',
        'docs/ai/framework/packages/persistence.md',
        'docs/ai/apps/asyra-design/API_SURFACES.md',
        'docs/ai/apps/asyra-design/ARCHITECTURE.md',
        'docs/ai/apps/asyra-design/modules/init-and-startup.md',
        'docs/ai/apps/asyra-design/modules/collaboration-reference.md',
        'docs/ai/apps/asyra-design/decisions/releases/unreleased.md',
        'docs/ai/decisions/releases/unreleased.md',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#high-detail-document-durability',
        '#app-owned-drawing-and-update-actions',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'persist-committed-document-snapshot'
    },
    {
      id: 'project-conversation-and-current-history',
      order: 1,
      laneId: 'result-projection',
      title: 'Project conversation, progress, and current history action',
      ownerPackage: 'Asyra Design AI conversation and Message Bar UI',
      purpose:
        'Render ordered operational progress and settled turn summaries, correlate a committed mutating AI turn with the current history top, and expose accessible Undo or Redo without owning document state or history.',
      inputs: [
        'artifact:runtime-progress-update',
        'artifact:settled-conversation-turn',
        'registered request_drawing_detail_choice result and App-owned detail option presentation',
        'app AI transaction correlation',
        'ordinary user-action, undo, and redo events',
        'app-root and panel lifecycle'
      ],
      outputs: [
        'artifact:projected-ai-conversation-and-history',
        'artifact:disposed-ai-conversation-projection'
      ],
      conditions: [
        'Progress renders in invocation order with stable operational labels and no raw arguments, secrets, provider body, canonical state, or private chain-of-thought.',
        'Settled complete, partial, cancelled, unavailable, failed, and no-change turns render concise distinct summaries.',
        'Only an exact settled request_drawing_detail_choice no-change result projects the App-owned Balanced detail and Maximum detail option identities, element and point counts, and concise resource guidance; Maximum visibly warns that it may temporarily use much more memory and reduce App responsiveness.',
        'The detail-choice projection uses only registered action and option identities, retains the settled turn attachment context for later UI intent acceptance, and never presents provider wording, raw attachment data, action arguments, or canonical state.',
        'Every settled turn projects its recorded duration as a concise elapsed-time summary without starting a UI timer or reconstructing runtime timing.',
        'Ordered user intents and Agent results remain visually distinct without any You or Mock AI speaker/provider labels in the panel header, messages, or Message Bar; concise mock-mode status remains available without acting as speaker attribution.',
        'A committed mutating AI turn shows one Message Bar Undo control only while it is the applicable top history action.',
        'After successful Undo the same current bar offers Redo; a later committed action invalidates an older AI history control before it can affect unrelated state.',
        'Undo and Redo invoke app history APIs and canonical Factory replay; UI stores no inverse, snapshot, or replay patch.',
        'Panel, confirmation, progress, and Message Bar state remain app-root-local and accessible.'
      ],
      bypasses: [
        'Failed, denied, cancelled, unsupported, provider-disabled, and zero-mutation turns expose no enabled Undo control.',
        'Malformed, unknown, provider-invented, or incomplete clarification evidence projects only the ordinary safe no-change summary and no detail options.',
        'A stale Message Bar control is disabled or removed instead of invoking history.',
        'Projection failure cannot alter the settled runtime result or canonical state.'
      ],
      allowedContributors: [
        'artifact:runtime-progress-update',
        'artifact:settled-conversation-turn',
        'registered App action and drawing-detail option identities',
        'app transaction correlation and ordinary history events',
        'app history common APIs',
        'instance-local React state and public Design System primitives'
      ],
      forbiddenContributors: [
        'UI-owned canonical scene, inverse operations, snapshots, or history stack',
        'Undo/Redo against a non-top older AI action',
        'Render or provider values as product state',
        'module-global conversation, progress, confirmation, or Message Bar state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/app',
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/common-apis/history.ts',
        'apps/asyra-design/src/init',
        'apps/asyra-design/src/app/__tests__',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/package.json',
        'apps/asyra-design/e2e',
        'docs/ai/apps/asyra-design/features/undo-redo.md',
        'docs/ai/apps/asyra-design/prd/undo-redo.md',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#conversation-surface',
        '#operational-progress-not-hidden-reasoning',
        '#one-turn-one-transaction-one-history-message'
      ],
      failureOwnerStepId: 'project-conversation-and-current-history'
    }
  ]

  const routes = [
    {
      id: 'route-accepted-ui-intent',
      from: 'accept-mock-conversation-intent',
      to: 'manage-one-conversation-turn',
      kind: 'handoff',
      predicate:
        'Exact mock mode accepts one idle submission containing trimmed text and any accepted image attachments.',
      producedArtifacts: ['artifact:user-ai-turn-intent']
    },
    {
      id: 'route-ui-intent-bypass',
      from: 'accept-mock-conversation-intent',
      kind: 'terminal',
      predicate:
        'AI is disabled, the draft has no trimmed text, an attachment is invalid, or another turn is active.',
      producedArtifacts: ['artifact:conversation-intent-bypass']
    },
    {
      id: 'route-active-turn-to-runtime',
      from: 'manage-one-conversation-turn',
      to: 'orchestrate-runtime-preflight-and-progress',
      kind: 'handoff',
      predicate: 'Feature accepts one turn with revalidated current targets.',
      producedArtifacts: ['artifact:active-conversation-turn']
    },
    {
      id: 'route-runtime-provider-request',
      from: 'orchestrate-runtime-preflight-and-progress',
      to: 'produce-deterministic-mock-candidate',
      kind: 'handoff',
      predicate: 'Context and provider-safe action descriptions are ready.',
      producedArtifacts: ['artifact:provider-plan-request']
    },
    {
      id: 'route-mock-candidate',
      from: 'produce-deterministic-mock-candidate',
      to: 'orchestrate-runtime-preflight-and-progress',
      kind: 'handoff',
      predicate:
        'The deterministic fixture delay settles successfully before abort.',
      producedArtifacts: ['artifact:mock-candidate-plan']
    },
    {
      id: 'route-mock-provider-failure',
      from: 'produce-deterministic-mock-candidate',
      to: 'orchestrate-runtime-preflight-and-progress',
      kind: 'failure',
      predicate:
        'The declared failure fixture, abort, timeout, or disposal settles provider work.',
      producedArtifacts: ['artifact:mock-provider-failure']
    },
    {
      id: 'route-runtime-progress-projection',
      from: 'orchestrate-runtime-preflight-and-progress',
      to: 'project-conversation-and-current-history',
      kind: 'observation',
      predicate:
        'An optional observer exists and one stable runtime phase occurs.',
      producedArtifacts: ['artifact:runtime-progress-update']
    },
    {
      id: 'route-runtime-confirmation-request',
      from: 'orchestrate-runtime-preflight-and-progress',
      to: 'resolve-app-confirmation',
      kind: 'handoff',
      predicate:
        'Complete preflight succeeds and at least one action requires confirm.',
      producedArtifacts: ['artifact:app-confirmation-request']
    },
    {
      id: 'route-app-confirmation-decision',
      from: 'resolve-app-confirmation',
      to: 'orchestrate-runtime-preflight-and-progress',
      kind: 'handoff',
      predicate:
        'The visible App handler resolves accept, reject, abort, or teardown.',
      producedArtifacts: ['artifact:app-confirmation-decision']
    },
    {
      id: 'route-accepted-plan-execution',
      from: 'orchestrate-runtime-preflight-and-progress',
      to: 'execute-one-app-composition-transaction',
      kind: 'handoff',
      predicate:
        'Validation and permission pass and confirmation is accepted or bypassed.',
      producedArtifacts: ['artifact:accepted-app-action-plan']
    },
    {
      id: 'route-resolved-app-action-result',
      from: 'execute-one-app-composition-transaction',
      to: 'orchestrate-runtime-preflight-and-progress',
      kind: 'handoff',
      predicate:
        'The one app transaction commits complete, partial, or zero-mutation action evidence.',
      producedArtifacts: ['artifact:app-action-execution-result']
    },
    {
      id: 'route-committed-document-to-persistence',
      from: 'execute-one-app-composition-transaction',
      to: 'persist-committed-document-snapshot',
      kind: 'persistence',
      predicate:
        'The outer App transaction commits at least one canonical mutation and Core captures its detached persistence snapshot.',
      producedArtifacts: ['artifact:committed-canonical-persistence-snapshot']
    },
    {
      id: 'route-fatal-app-action-rejection',
      from: 'execute-one-app-composition-transaction',
      to: 'orchestrate-runtime-preflight-and-progress',
      kind: 'failure',
      predicate:
        'Executor or canonical consistency failure rejects and triggers app-runner rollback.',
      producedArtifacts: ['artifact:fatal-app-action-rejection']
    },
    {
      id: 'route-runtime-terminal-to-turn',
      from: 'orchestrate-runtime-preflight-and-progress',
      to: 'manage-one-conversation-turn',
      kind: 'handoff',
      predicate:
        'The invocation settles exactly once with executed, cancelled, failed, unavailable, or no-change evidence.',
      producedArtifacts: ['artifact:runtime-terminal-result']
    },
    {
      id: 'route-persisted-document',
      from: 'persist-committed-document-snapshot',
      kind: 'terminal',
      predicate:
        'The App-selected IndexedDB provider acknowledges the complete canonical snapshot.',
      producedArtifacts: ['artifact:persisted-canonical-document']
    },
    {
      id: 'route-document-persistence-failure',
      from: 'persist-committed-document-snapshot',
      kind: 'failure',
      predicate:
        'Snapshot capture, migration, IndexedDB open, transaction, or provider save fails and Core reports persistence-failed without reversing runtime commit.',
      producedArtifacts: ['artifact:document-persistence-failure']
    },
    {
      id: 'route-settled-turn-projection',
      from: 'manage-one-conversation-turn',
      to: 'project-conversation-and-current-history',
      kind: 'handoff',
      predicate:
        'The active turn settles and target hints are updated or cleared as applicable.',
      producedArtifacts: ['artifact:settled-conversation-turn']
    },
    {
      id: 'route-projected-ai-ui',
      from: 'project-conversation-and-current-history',
      kind: 'terminal',
      predicate:
        'Current progress, turn, and top-history state are projected for the mounted app root.',
      producedArtifacts: ['artifact:projected-ai-conversation-and-history']
    },
    {
      id: 'route-disposed-ai-ui',
      from: 'project-conversation-and-current-history',
      kind: 'terminal',
      predicate:
        'Panel/app teardown releases owned projection, listener, and pending UI resources.',
      producedArtifacts: ['artifact:disposed-ai-conversation-projection']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:user-ai-turn-intent',
      ownerStepId: 'accept-mock-conversation-intent',
      channel: 'app UI intent with detached image attachments',
      consumerStepIds: ['manage-one-conversation-turn'],
      terminal: false
    },
    {
      id: 'artifact:conversation-intent-bypass',
      ownerStepId: 'accept-mock-conversation-intent',
      channel: 'terminal UI bypass',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:active-conversation-turn',
      ownerStepId: 'manage-one-conversation-turn',
      channel: 'Feature task request',
      consumerStepIds: ['orchestrate-runtime-preflight-and-progress'],
      terminal: false
    },
    {
      id: 'artifact:settled-conversation-turn',
      ownerStepId: 'manage-one-conversation-turn',
      channel: 'app conversation projection',
      consumerStepIds: ['project-conversation-and-current-history'],
      terminal: false
    },
    {
      id: 'artifact:provider-plan-request',
      ownerStepId: 'orchestrate-runtime-preflight-and-progress',
      channel: 'AiProvider input',
      consumerStepIds: ['produce-deterministic-mock-candidate'],
      terminal: false
    },
    {
      id: 'artifact:mock-candidate-plan',
      ownerStepId: 'produce-deterministic-mock-candidate',
      channel: 'untrusted provider result',
      consumerStepIds: ['orchestrate-runtime-preflight-and-progress'],
      terminal: false
    },
    {
      id: 'artifact:mock-provider-failure',
      ownerStepId: 'produce-deterministic-mock-candidate',
      channel: 'provider failure',
      consumerStepIds: ['orchestrate-runtime-preflight-and-progress'],
      terminal: false
    },
    {
      id: 'artifact:runtime-progress-update',
      ownerStepId: 'orchestrate-runtime-preflight-and-progress',
      channel: 'detached observation',
      consumerStepIds: ['project-conversation-and-current-history'],
      terminal: false
    },
    {
      id: 'artifact:app-confirmation-request',
      ownerStepId: 'orchestrate-runtime-preflight-and-progress',
      channel: 'app confirmation handler',
      consumerStepIds: ['resolve-app-confirmation'],
      terminal: false
    },
    {
      id: 'artifact:app-confirmation-decision',
      ownerStepId: 'resolve-app-confirmation',
      channel: 'app confirmation handler result',
      consumerStepIds: ['orchestrate-runtime-preflight-and-progress'],
      terminal: false
    },
    {
      id: 'artifact:accepted-app-action-plan',
      ownerStepId: 'orchestrate-runtime-preflight-and-progress',
      channel: 'validated executor handoff',
      consumerStepIds: ['execute-one-app-composition-transaction'],
      terminal: false
    },
    {
      id: 'artifact:app-action-execution-result',
      ownerStepId: 'execute-one-app-composition-transaction',
      channel: 'detached executor result',
      consumerStepIds: ['orchestrate-runtime-preflight-and-progress'],
      terminal: false
    },
    {
      id: 'artifact:committed-canonical-persistence-snapshot',
      ownerStepId: 'execute-one-app-composition-transaction',
      channel: 'Core commit-time persistence handoff',
      consumerStepIds: ['persist-committed-document-snapshot'],
      terminal: false
    },
    {
      id: 'artifact:fatal-app-action-rejection',
      ownerStepId: 'execute-one-app-composition-transaction',
      channel: 'transaction failure',
      consumerStepIds: ['orchestrate-runtime-preflight-and-progress'],
      terminal: false
    },
    {
      id: 'artifact:runtime-terminal-result',
      ownerStepId: 'orchestrate-runtime-preflight-and-progress',
      channel: 'Feature task result',
      consumerStepIds: ['manage-one-conversation-turn'],
      terminal: false
    },
    {
      id: 'artifact:persisted-canonical-document',
      ownerStepId: 'persist-committed-document-snapshot',
      channel: 'terminal persistence acknowledgement',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:document-persistence-failure',
      ownerStepId: 'persist-committed-document-snapshot',
      channel: 'terminal persistence failure evidence',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:projected-ai-conversation-and-history',
      ownerStepId: 'project-conversation-and-current-history',
      channel: 'app UI projection',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:disposed-ai-conversation-projection',
      ownerStepId: 'project-conversation-and-current-history',
      channel: 'lifecycle cleanup',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const invariants = [
    {
      id: 'one-feature-turn-one-transaction',
      statement:
        'One accepted mutating user turn uses the one Feature lifecycle, one runtime invocation, one app transaction runner call, and one intended undo commit.',
      stepIds: [
        'manage-one-conversation-turn',
        'orchestrate-runtime-preflight-and-progress',
        'execute-one-app-composition-transaction',
        'project-conversation-and-current-history'
      ],
      artifactIds: [
        'artifact:active-conversation-turn',
        'artifact:accepted-app-action-plan',
        'artifact:app-action-execution-result',
        'artifact:settled-conversation-turn'
      ],
      specRefs: ['#one-turn-one-transaction-one-history-message']
    },
    {
      id: 'partial-is-resolved-fatal-is-rejected',
      statement:
        'App-declared recoverable item failures resolve as partial evidence and commit successful siblings; executor rejection means fatal consistency failure and triggers ordinary app rollback.',
      stepIds: [
        'execute-one-app-composition-transaction',
        'orchestrate-runtime-preflight-and-progress'
      ],
      artifactIds: [
        'artifact:app-action-execution-result',
        'artifact:fatal-app-action-rejection'
      ],
      specRefs: ['#partial-and-fatal-failure-classification']
    },
    {
      id: 'canonical-scene-owns-follow-up-truth',
      statement:
        'Conversation role/id hints are non-authoritative and every follow-up revalidates current canonical ids without whole-composition regeneration fallback.',
      stepIds: [
        'manage-one-conversation-turn',
        'execute-one-app-composition-transaction'
      ],
      artifactIds: [
        'artifact:active-conversation-turn',
        'artifact:app-action-execution-result'
      ],
      specRefs: ['#incremental-follow-up-targeting']
    },
    {
      id: 'progress-and-conversation-are-observational',
      statement:
        'Progress, provider explanation, conversation records, confirmation UI, and Message Bar are detached projections with no canonical mutation, history ownership, secret, raw provider body, or private chain-of-thought.',
      stepIds: [
        'produce-deterministic-mock-candidate',
        'orchestrate-runtime-preflight-and-progress',
        'resolve-app-confirmation',
        'project-conversation-and-current-history'
      ],
      artifactIds: [
        'artifact:runtime-progress-update',
        'artifact:settled-conversation-turn',
        'artifact:projected-ai-conversation-and-history'
      ],
      specRefs: [
        '#operational-progress-not-hidden-reasoning',
        '#ownership-contract'
      ]
    },
    {
      id: 'mock-mode-is-explicit-and-replaceable',
      statement:
        'Only exact ai=mock activates the deterministic no-network provider and UI; provider replacement and AI-disabled default startup remain unchanged.',
      stepIds: [
        'accept-mock-conversation-intent',
        'produce-deterministic-mock-candidate',
        'orchestrate-runtime-preflight-and-progress'
      ],
      artifactIds: [
        'artifact:user-ai-turn-intent',
        'artifact:provider-plan-request',
        'artifact:mock-candidate-plan'
      ],
      specRefs: ['#explicit-mock-activation', '#deterministic-mock-provider']
    },
    {
      id: 'high-detail-commit-is-durable',
      statement:
        'A committed high-detail canonical snapshot persists and reloads through the App-selected IndexedDB provider without localStorage quota loss, canonical reduction, AI-owned storage, or runtime rollback on provider failure.',
      stepIds: [
        'execute-one-app-composition-transaction',
        'persist-committed-document-snapshot'
      ],
      artifactIds: [
        'artifact:committed-canonical-persistence-snapshot',
        'artifact:persisted-canonical-document',
        'artifact:document-persistence-failure'
      ],
      specRefs: ['#high-detail-document-durability']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'mock-activation-and-lifecycle-cases',
      title: 'Explicit activation, input, overlap, cancellation, and isolation',
      assertions: [
        'Missing or unknown AI mode has zero AI/UI side effects; exact ai=mock exposes one AI toolbar and Agent panel route without a provider or speaker name.',
        'The Agent prompt accepts PNG, JPEG, and WebP images through file selection or drag-and-drop, shows removable draft/submitted thumbnails, and keeps attachment data app-root-local without upload or canonical mutation.',
        'A draft without trimmed text and every invalid attachment are inert, one active turn rejects overlap and attachment changes, and Cancel/panel/app teardown release the Feature task and every mock timer/listener.',
        'Two app roots keep provider, conversation, progress, confirmation, target hints, and Message Bar state isolated.'
      ],
      stepIds: [
        'accept-mock-conversation-intent',
        'manage-one-conversation-turn',
        'produce-deterministic-mock-candidate',
        'project-conversation-and-current-history'
      ],
      specRefs: [
        '#explicit-mock-activation',
        '#conversation-surface',
        '#product-cases'
      ]
    },
    {
      id: 'cat-face-and-incremental-follow-up-cases',
      title: 'Cat-face creation and existing-id follow-up edits',
      assertions: [
        'A draw-this-image phrase with an accepted image attachment produces one non-mutating detail-choice result and no history; Balanced detail retains the attachment and selects 7,111 ordinary Vector items with at least 115,000 canonical points, while Maximum detail retains it and selects 27,471 valid ordinary Vector items with 295,794 canonical points and a visible App-owned resource warning.',
        'The exact English draw-only-the-cat attached-reference instruction directly selects the balanced cat-only fixture, removes the original photographic background, and creates one pure-white ordinary editable background Vector whose bounds equal the uploaded photo intrinsic width and height.',
        'Text-only cat-face creation phrases use the balanced fixture; both drawing fixtures create ordinary editable grouped Asyra elements and return App-generated semantic role/id hints without an artificial composition-count ceiling.',
        'Eye enlargement, whisker recolor, and pupil recolor plans reference only current semantic target ids; pupil recolor uses the aggregate pupils role and never requests portrait regeneration.',
        'A two-actor E2E drives Actor A through attachment drag-and-drop, the exact cat-only same-size-white-background request, blue whiskers, and red pupils; both actors converge through ordinary Collaboration publication while ids and point counts remain stable across follow-ups and only Actor A gains one undo entry for each mutating turn.',
        'Missing or ambiguous targets produce no-mutation or clarification rather than replacement output.'
      ],
      stepIds: [
        'manage-one-conversation-turn',
        'produce-deterministic-mock-candidate',
        'orchestrate-runtime-preflight-and-progress',
        'execute-one-app-composition-transaction'
      ],
      specRefs: [
        '#goal',
        '#app-owned-drawing-and-update-actions',
        '#incremental-follow-up-targeting'
      ]
    },
    {
      id: 'progress-confirmation-and-safety-cases',
      title: 'Operational progress, visible confirmation, and safe output',
      assertions: [
        'Actual runtime phases project through an optional observer and observer failure cannot alter execution.',
        'Each accepted turn records one monotonic duration through terminal settlement and projects that elapsed time without another timer owner.',
        'No progress, explanation, preview, result, or UI exposes raw arguments, secrets, provider body, canonical state, or private chain-of-thought.',
        'Confirm visibly waits for an App impact decision; accept executes once, reject opens no transaction, and abort/teardown releases the wait.'
      ],
      stepIds: [
        'produce-deterministic-mock-candidate',
        'orchestrate-runtime-preflight-and-progress',
        'resolve-app-confirmation',
        'project-conversation-and-current-history'
      ],
      specRefs: [
        '#operational-progress-not-hidden-reasoning',
        '#confirmation-handshake',
        '#product-cases'
      ]
    },
    {
      id: 'partial-fatal-and-history-cases',
      title: 'Partial commit, fatal rollback, and current history controls',
      assertions: [
        'Recoverable item failure skips only that item, commits successful siblings, reports partial evidence, and creates one undo entry.',
        'Fatal executor/canonical rejection rolls back rollbackable writes and exposes no accepted prefix or enabled Undo.',
        'Message Bar Undo/Redo acts only on the applicable top AI history action and is invalidated by a later committed action.'
      ],
      stepIds: [
        'orchestrate-runtime-preflight-and-progress',
        'execute-one-app-composition-transaction',
        'project-conversation-and-current-history'
      ],
      specRefs: [
        '#partial-and-fatal-failure-classification',
        '#one-turn-one-transaction-one-history-message',
        '#product-cases'
      ]
    },
    {
      id: 'high-detail-document-durability-cases',
      title: 'High-detail commit persistence and legacy migration',
      assertions: [
        'A canonical drawing larger than localStorage quota saves and reloads with identical ids, topology, hierarchy, styles, bounds, and version through IndexedDB.',
        'Ordinary and collaboration document identities remain isolated and an existing valid legacy localStorage value migrates only when IndexedDB is empty.',
        'The legacy key is removed only after the IndexedDB write succeeds; provider failure remains explicit and does not reverse runtime commit.',
        'Attachments, conversation turns, progress, semantic target hints, and provider data are never persisted.'
      ],
      stepIds: [
        'execute-one-app-composition-transaction',
        'persist-committed-document-snapshot'
      ],
      specRefs: [
        '#high-detail-document-durability',
        '#product-cases',
        '#definition-of-done'
      ]
    },
    {
      id: 'bounded-completion-gates',
      title: 'Formal, visual, template, and boundary completion',
      assertions: [
        'Inspector, BDD, package, App, E2E, dependency, lint, build, generated-template, and synchronized visual gates pass.',
        'Canonical ids, geometry, roles, styles, hierarchy, and transaction evidence are asserted before screenshots.',
        'The explicit resource-aware collaboration visual gate retains paired screenshots from both independent live app contexts after each converged drawing state and records those same live views side-by-side in one 2560-by-720 WebM; the compositor recording is presentation evidence, never the canonical oracle.',
        'Before the recorded drawing request, each live actor frames the complete known 1,672-by-941 output bounds from its actual visible viewport with safe padding, and the explicit E2E command owns dedicated fresh App and Collaboration server ports instead of reusing an unrelated long-running process.',
        'No live provider, default AI activation, second queue/history/canonical owner, arbitrary model action, patch drawing path, Render bypass, regeneration fallback, or chain-of-thought output is introduced.'
      ],
      stepIds: [
        'accept-mock-conversation-intent',
        'manage-one-conversation-turn',
        'produce-deterministic-mock-candidate',
        'orchestrate-runtime-preflight-and-progress',
        'resolve-app-confirmation',
        'execute-one-app-composition-transaction',
        'persist-committed-document-snapshot',
        'project-conversation-and-current-history'
      ],
      specRefs: [
        '#required-validation',
        '#definition-of-done',
        '#stop-conditions'
      ]
    }
  ]

  const flowInspectorData = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'asyra-design-ai-conversational-drawing',
      kind: 'feature',
      title: 'Asyra Design Conversational AI Mock Drawing Inspector',
      subtitle:
        'Explicit mock conversation intake, Feature-owned turns, deterministic delayed planning, Gate 4 preflight and confirmation, bounded app composition transactions, durable high-detail documents, partial/fatal outcomes, incremental targets, and current-history UI.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Asyra Design Conversational AI Mock Drawing Plan',
      inspectorOwner: 'Asyra Design Conversational AI owner flow'
    },
    links: [
      {
        id: 'ai-conversational-drawing-plan',
        kind: 'authority',
        label: 'Product contract',
        href: './ai-conversational-drawing-plan.md'
      },
      {
        id: 'ai-agent-runtime-inspector',
        kind: 'prerequisite',
        label: 'Completed Gate 4 runtime authority',
        href: '../../../framework/plans/ai-agent-runtime-flow-inspector.html'
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
