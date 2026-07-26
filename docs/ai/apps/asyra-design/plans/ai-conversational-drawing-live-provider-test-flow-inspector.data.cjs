;(function () {
  'use strict'

  const specPath =
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-live-provider-test-plan.md'
  const inspectorPath =
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-live-provider-test-flow-inspector.data.cjs'

  const lanes = [
    {
      id: 'credential-authorization',
      title: 'Credential Authorization',
      order: 1
    },
    { id: 'live-provider-boundary', title: 'Live Provider Boundary', order: 2 },
    {
      id: 'runtime-and-app-execution',
      title: 'Runtime and App Execution',
      order: 3
    },
    { id: 'formal-evidence', title: 'Formal Evidence', order: 4 }
  ]

  const steps = [
    {
      id: 'authorize-live-provider-test-run',
      order: 1,
      laneId: 'credential-authorization',
      title: 'Authorize one live-provider test run',
      ownerPackage: 'Asyra Design provider account and test release owner',
      purpose:
        'Select one capable vendor/model, request one dedicated least-privilege API key, approve the bounded test window and budgets, and establish revocation or rotation ownership without placing the secret value in any Inspector artifact.',
      inputs: [
        'live-provider structured-plan and image-input requirements',
        'provider account and billing ownership',
        'Framework credential and transport security boundary',
        'explicit product-owner authorization'
      ],
      outputs: ['artifact:approved-live-provider-test-run'],
      conditions: [
        'A human provider account owner confirms structured JSON and required image-input capability before requesting a dedicated project-scoped test key.',
        'The approved run allows at most eight vendor requests, five live-provider minutes, USD 2.00, and 45 seconds per request unless the plan and Inspector are updated first.',
        'The approval records only provider/model aliases, numeric budgets, test window, secret name, and revocation or rotation owner; the API-key value is never an artifact.',
        'The credential has minimum inference permission and no production, administrative, unrelated-project, or unrestricted personal billing scope.'
      ],
      bypasses: [
        'Missing capability, account owner, billing owner, budget, test window, or revocation policy blocks the run before proxy, App, browser, or vendor work.',
        'Missing or suspected-exposed credentials fail closed and require request, revocation, or rotation by the credential owner.',
        'Ordinary CI and exact ai=mock bypass this step and never consult live credential state.'
      ],
      allowedContributors: [
        'provider account owner',
        'Asyra Design test release owner',
        'checked-in non-secret run configuration',
        'Framework security and provider contracts'
      ],
      forbiddenContributors: [
        'API-key values in source, chat, fixtures, logs, reports, or browser state',
        'automatic credential minting by App or test code',
        'unbounded spend or request policy',
        'production or personal unrestricted credentials'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/e2e',
        'apps/asyra-design/__tests__',
        'docs/ai/apps/asyra-design/plans',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#credential-request-and-secret-contract',
        '#test-authority-and-nondeterminism',
        '#stop-conditions'
      ],
      failureOwnerStepId: 'authorize-live-provider-test-run'
    },
    {
      id: 'accept-explicit-live-test-intent',
      order: 1,
      laneId: 'live-provider-boundary',
      title: 'Accept one explicit live-test conversation intent',
      ownerPackage: 'Asyra Design App AI startup and conversation controller',
      purpose:
        'Compose one live-test Agent turn only when exact server and query opt-ins plus a ready non-secret same-origin endpoint capability agree, while preserving disabled and deterministic Mock behavior.',
      inputs: [
        'artifact:approved-live-provider-test-run',
        'exact server-side ASYRA_DESIGN_LIVE_AI_TEST=1 opt-in',
        'exact single ai=live-test query value',
        'ready non-secret same-origin endpoint capability',
        'App-owned user intent and accepted attachment descriptors'
      ],
      outputs: ['artifact:live-test-agent-intent'],
      conditions: [
        'The query value alone cannot compose a provider; server-side preflight must supply the non-secret endpoint capability.',
        'The App reuses the existing non-modal Agent panel, attachment handling, operational status, elapsed time, confirmation UI, one-active-turn rule, cancellation, and Message Bar.',
        'The accepted intent contains only bounded immutable attachment data, provider-safe action context, conversation and turn correlation, and the Feature-owned AbortSignal.',
        'Exact ai=mock remains isolated, deterministic, network-free, and keyless.'
      ],
      bypasses: [
        'Duplicate, mixed, empty, or unknown ai values resolve to disabled startup.',
        'Missing key, provider, model, budget, proxy, or ready capability fails the explicit command before browser launch or settles unavailable without a vendor request.',
        'Empty, invalid, overlapping, cancelled, or disposed App intent creates no provider request.'
      ],
      allowedContributors: [
        'artifact:approved-live-provider-test-run',
        'Asyra Design AI mode and startup composition',
        'App conversation controller and attachment validator',
        'Feature System intent and AbortSignal'
      ],
      forbiddenContributors: [
        'client-exposed secret or VITE-prefixed API key',
        'query-only provider enablement',
        'silent Mock fallback presented as live evidence',
        'speaker/provider labels or private reasoning UI'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/init',
        'apps/asyra-design/src/app',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/e2e'
      ],
      specRefs: [
        '#explicit-live-test-activation',
        '#formal-test-matrix',
        '#ownership-contract'
      ],
      failureOwnerStepId: 'accept-explicit-live-test-intent'
    },
    {
      id: 'request-live-provider-candidate',
      order: 2,
      laneId: 'live-provider-boundary',
      title: 'Request one live provider candidate through the proxy',
      ownerPackage: 'Asyra Design live-test proxy',
      purpose:
        'Send the minimum provider context from one accepted intent through a loopback same-origin endpoint, authenticate to the selected vendor with the server-only key, enforce budgets, and return only an untrusted public candidate or stable redacted failure.',
      inputs: [
        'artifact:approved-live-provider-test-run',
        'artifact:live-test-agent-intent',
        'server-only ASYRA_DESIGN_LIVE_AI_TEST_API_KEY secret',
        'provider-specific structured-response adapter'
      ],
      outputs: [
        'artifact:untrusted-live-provider-candidate',
        'artifact:redacted-live-provider-usage'
      ],
      conditions: [
        'The browser uses createGenericHttpAiProvider against one same-origin endpoint and sends no vendor key or authorization value.',
        'The proxy binds to loopback, allows only the test App origin and method, validates content type and size, and rejects work beyond the approved request, time, or spend budgets.',
        'The proxy owns vendor authentication, request and response translation, usage accounting, provider timeout, abort, and stable authentication, quota, rate-limit, transport, parse, and schema failure mapping.',
        'Only the minimum committed prompt, attachment, provider-safe context, and action catalog needed by the scenario reach the vendor.',
        'The returned candidate is detached and untrusted; proxy translation grants no validation, permission, confirmation, transaction, or mutation authority.'
      ],
      bypasses: [
        'Missing explicit approval or server-only secret fails before vendor fetch and produces no candidate.',
        'Caller abort, App teardown, proxy teardown, timeout, or exhausted budget cancels request and retry work and prevents a late candidate.',
        'Raw vendor bodies, SDK exceptions, headers, and authorization diagnostics are replaced by stable redacted failures.'
      ],
      allowedContributors: [
        'artifact:approved-live-provider-test-run',
        'artifact:live-test-agent-intent',
        '@asyra/ai-agent-runtime generic HTTP provider',
        'loopback same-origin test proxy',
        'selected vendor structured-response API'
      ],
      forbiddenContributors: [
        'direct browser-to-vendor transport',
        'vendor key in App source, HTML, metadata, query, storage, DOM, or browser request',
        'canonical stores, history, collaboration state, or unrelated attachments',
        'raw vendor response or chain-of-thought as terminal output'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/e2e',
        'apps/asyra-design/vite.config.ts',
        'apps/asyra-design/package.json',
        'packages/ai-agent-runtime/src/providers'
      ],
      specRefs: [
        '#credential-request-and-secret-contract',
        '#backend-proxy-contract',
        '#formal-test-matrix'
      ],
      failureOwnerStepId: 'request-live-provider-candidate'
    },
    {
      id: 'validate-and-orchestrate-live-candidate',
      order: 1,
      laneId: 'runtime-and-app-execution',
      title: 'Validate and orchestrate the live candidate',
      ownerPackage: '@asyra/ai-agent-runtime',
      purpose:
        'Treat the live provider candidate as untrusted data, normalize and validate the complete registered plan, evaluate App permission, await App confirmation when required, and open one App transaction only for an authorized mutating plan.',
      inputs: [
        'artifact:untrusted-live-provider-candidate',
        'Feature-owned AbortSignal',
        'registered deterministic action catalog and schemas',
        'App permission, confirmation, and transaction adapters'
      ],
      outputs: [
        'artifact:authorized-live-app-plan',
        'artifact:redacted-live-runtime-preflight-evidence'
      ],
      conditions: [
        'The complete candidate normalizes and passes every registered action schema before permission, confirmation, transaction, or execution.',
        'Permission is explicit and App-owned; unknown action, malformed plan, denial, abort, and provider failure produce no accepted canonical prefix.',
        'Confirmation pauses in the existing App handler before transaction entry and returns only a decision to the runtime.',
        'Transient provider retry is bounded before transaction start by runtime policy and the eight-request run budget; retry after transaction entry is forbidden.',
        'Progress and terminal evidence contain stable operational phases and redacted summaries only, never provider bodies, action arguments, App context, secrets, or chain-of-thought.'
      ],
      bypasses: [
        'A no-change drawing-detail clarification returns structured no-mutation evidence and opens no transaction.',
        'Schema-invalid, unknown, denied, confirmation-cancelled, aborted, timed-out, or disposed work never reaches an App executor.',
        'Missing confirmation UI fails or cancels rather than waiting invisibly.'
      ],
      allowedContributors: [
        'artifact:untrusted-live-provider-candidate',
        '@asyra/ai-agent-runtime public orchestration',
        'registered App action descriptions and schemas',
        'App permission, confirmation, transaction, and progress adapters'
      ],
      forbiddenContributors: [
        'provider-selected arbitrary code, property paths, or canonical ids',
        'proxy-owned validation or permission decision',
        'runtime-owned canonical mutation or history',
        'raw reasoning or vendor diagnostics'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src',
        'packages/ai-agent-runtime/src/__tests__'
      ],
      specRefs: [
        '#backend-proxy-contract',
        '#formal-test-matrix',
        '#ownership-contract'
      ],
      failureOwnerStepId: 'validate-and-orchestrate-live-candidate'
    },
    {
      id: 'execute-registered-live-app-actions',
      order: 2,
      laneId: 'runtime-and-app-execution',
      title: 'Execute registered App actions',
      ownerPackage: 'Asyra Design AI actions and common APIs',
      purpose:
        'Execute an authorized live plan only through registered schemas and ordinary App common APIs, revalidate current canonical targets, and preserve complete, partial, fatal rollback, transaction, and history semantics.',
      inputs: [
        'artifact:authorized-live-app-plan',
        'current canonical App context',
        'one App transaction runner',
        'Feature-owned AbortSignal'
      ],
      outputs: ['artifact:live-app-action-result'],
      conditions: [
        'A bounded live cat-face composition uses the existing strict composition action and App-generated canonical ids; it is not a direct provider mutation path.',
        'External request, token, time, and spend budgets never become an App item, path, point, payload, or composition acceptance ceiling.',
        'A blue-whisker follow-up includes only permitted current target hints and revalidates each canonical id immediately before mutation.',
        'A mutating turn uses one outer App transaction and creates exactly one intended Undo action while preserving ordinary Render, persistence, and optional Collaboration projection.',
        'A recoverable per-object failure resolves as partial evidence and commits successful siblings; a fatal consistency failure rejects and rolls back the complete rollbackable turn.',
        'Confirmation-delayed targets are revalidated after Allow and before the first mutation.'
      ],
      bypasses: [
        'No-change, invalid, denied, cancelled, unsupported, zero-mutation, or failed plans create no history action.',
        'Missing or ambiguous follow-up targets produce bounded no-mutation evidence and never regenerate the complete composition.',
        'Executor rejection cannot be caught and committed as a successful prefix.'
      ],
      allowedContributors: [
        'artifact:authorized-live-app-plan',
        'Asyra Design registered action schemas and executors',
        'apps/asyra-design/src/common-apis public boundaries',
        'Factory and ordinary canonical owners'
      ],
      forbiddenContributors: [
        'direct model, proxy, UI, or Render mutation',
        'provider-owned canonical ids or arbitrary property maps',
        'one transaction or history action per element or network batch',
        'whole-composition regeneration for a missing follow-up target'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/common-apis',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/common-apis/__tests__',
        'apps/asyra-design/e2e'
      ],
      specRefs: [
        '#formal-test-matrix',
        '#ownership-contract',
        '#product-cases'
      ],
      failureOwnerStepId: 'execute-registered-live-app-actions'
    },
    {
      id: 'evaluate-redacted-live-provider-evidence',
      order: 1,
      laneId: 'formal-evidence',
      title: 'Evaluate redacted formal evidence',
      ownerPackage: 'Asyra Design formal live-provider test harness',
      purpose:
        'Prove explicit opt-in, credential isolation, live-vs-Mock identity, provider budgets, runtime/App invariants, failure cleanup, and synchronized live UI from one bounded credentialed run without retaining secrets or raw provider data.',
      inputs: [
        'artifact:approved-live-provider-test-run',
        'artifact:redacted-live-provider-usage',
        'artifact:redacted-live-runtime-preflight-evidence',
        'artifact:live-app-action-result',
        'ordinary canonical and history queries',
        'same-live-state App screenshots'
      ],
      outputs: ['artifact:live-provider-formal-proof'],
      conditions: [
        'The explicit command fails before browser launch when any secret, provider/model, endpoint, budget, or approval prerequisite is missing and cannot accept Mock fallback as live success.',
        'The suite covers attachment interpretation, App-owned clarification, bounded creation, existing-id follow-up, confirmation, cancellation, invalid or revoked key, quota, rate limit, timeout, malformed output, schema failure, and teardown.',
        'Assertions cover registered actions, complete preflight, target revalidation, canonical preservation, one transaction and Undo action per mutating turn, no-change history, partial evidence, fatal rollback, redaction, and cleanup.',
        'The run stays within eight requests, five live-provider minutes, USD 2.00, and 45 seconds per request and reports provider/model aliases, timings, outcomes, usage, estimated cost, and stable error codes only.',
        'Synchronized visual review inspects the same live App state while reports, screenshots, videos, and traces remain ignored local artifacts.',
        'Exact Mock and VTracer suites remain deterministic merge-CI, drawing-detail, visual, collaboration, and performance authority.'
      ],
      bypasses: [
        'A run with missing opt-in, missing approval, stale server, hidden Mock fallback, leaked secret, missing usage, or exceeded budget cannot produce formal proof.',
        'Visually plausible model output cannot replace canonical, transaction, history, or redaction assertions.',
        'Raw vendor request/response data, image bytes, App context, full canonical snapshots, or chain-of-thought are never retained as evidence.'
      ],
      allowedContributors: [
        'declared redacted artifacts from this Inspector',
        'ordinary App canonical and history queries',
        'dedicated Playwright server and browser lifecycle',
        'app-visual-review-sync same-live-state inspection',
        'provider account owner revocation or rotation confirmation'
      ],
      forbiddenContributors: [
        'API key or authorization-value inspection, printing, screenshotting, or attachment',
        'Mock response accepted as live evidence',
        'nondeterministic exact prose or pixel assertions',
        'committed generated reports, screenshots, videos, or traces'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/e2e',
        'apps/asyra-design/__tests__',
        'apps/asyra-design/visual-review-records',
        'docs/ai/apps/asyra-design/bdd-features',
        'docs/ai/apps/asyra-design/plans/__tests__'
      ],
      specRefs: [
        '#formal-test-matrix',
        '#test-authority-and-nondeterminism',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'evaluate-redacted-live-provider-evidence'
    }
  ]

  const routes = [
    {
      id: 'route-approved-run-to-live-intent',
      from: 'authorize-live-provider-test-run',
      to: 'accept-explicit-live-test-intent',
      kind: 'authorization',
      predicate:
        'Provider capability, dedicated credential ownership, numeric budgets, and test window are approved.',
      producedArtifacts: ['artifact:approved-live-provider-test-run']
    },
    {
      id: 'route-approved-run-to-proxy',
      from: 'authorize-live-provider-test-run',
      to: 'request-live-provider-candidate',
      kind: 'authorization',
      predicate:
        'The loopback proxy may read the named server-only secret during the approved run.',
      producedArtifacts: ['artifact:approved-live-provider-test-run']
    },
    {
      id: 'route-approved-run-to-proof',
      from: 'authorize-live-provider-test-run',
      to: 'evaluate-redacted-live-provider-evidence',
      kind: 'observation',
      predicate:
        'Non-secret approval and budget metadata are available for formal evaluation.',
      producedArtifacts: ['artifact:approved-live-provider-test-run']
    },
    {
      id: 'route-live-intent-to-proxy',
      from: 'accept-explicit-live-test-intent',
      to: 'request-live-provider-candidate',
      kind: 'handoff',
      predicate:
        'Exact server/query opt-in and App intent validation produced one accepted live turn.',
      producedArtifacts: ['artifact:live-test-agent-intent']
    },
    {
      id: 'route-live-candidate-to-runtime',
      from: 'request-live-provider-candidate',
      to: 'validate-and-orchestrate-live-candidate',
      kind: 'handoff',
      predicate:
        'The proxy returned one detached untrusted public provider candidate.',
      producedArtifacts: ['artifact:untrusted-live-provider-candidate']
    },
    {
      id: 'route-provider-usage-to-proof',
      from: 'request-live-provider-candidate',
      to: 'evaluate-redacted-live-provider-evidence',
      kind: 'observation',
      predicate:
        'The proxy settled with bounded redacted request and usage evidence.',
      producedArtifacts: ['artifact:redacted-live-provider-usage']
    },
    {
      id: 'route-authorized-plan-to-app',
      from: 'validate-and-orchestrate-live-candidate',
      to: 'execute-registered-live-app-actions',
      kind: 'handoff',
      predicate:
        'The complete plan passed registered schemas, permission, and any required confirmation.',
      producedArtifacts: ['artifact:authorized-live-app-plan']
    },
    {
      id: 'route-runtime-evidence-to-proof',
      from: 'validate-and-orchestrate-live-candidate',
      to: 'evaluate-redacted-live-provider-evidence',
      kind: 'observation',
      predicate:
        'Runtime preflight or a no-mutation terminal path produced stable redacted evidence.',
      producedArtifacts: ['artifact:redacted-live-runtime-preflight-evidence']
    },
    {
      id: 'route-live-action-result-to-proof',
      from: 'execute-registered-live-app-actions',
      to: 'evaluate-redacted-live-provider-evidence',
      kind: 'observation',
      predicate:
        'The App action and transaction route settled with detached result evidence.',
      producedArtifacts: ['artifact:live-app-action-result']
    },
    {
      id: 'route-live-provider-formal-proof',
      from: 'evaluate-redacted-live-provider-evidence',
      kind: 'terminal',
      predicate:
        'Every required credential, provider, runtime, App, budget, cleanup, and authority assertion was evaluated.',
      producedArtifacts: ['artifact:live-provider-formal-proof']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:approved-live-provider-test-run',
      ownerStepId: 'authorize-live-provider-test-run',
      channel: 'non-secret release authorization',
      consumerStepIds: [
        'accept-explicit-live-test-intent',
        'request-live-provider-candidate',
        'evaluate-redacted-live-provider-evidence'
      ],
      terminal: false
    },
    {
      id: 'artifact:live-test-agent-intent',
      ownerStepId: 'accept-explicit-live-test-intent',
      channel: 'App Feature intent',
      consumerStepIds: ['request-live-provider-candidate'],
      terminal: false
    },
    {
      id: 'artifact:untrusted-live-provider-candidate',
      ownerStepId: 'request-live-provider-candidate',
      channel: 'generic HTTP provider candidate',
      consumerStepIds: ['validate-and-orchestrate-live-candidate'],
      terminal: false
    },
    {
      id: 'artifact:redacted-live-provider-usage',
      ownerStepId: 'request-live-provider-candidate',
      channel: 'bounded redacted proxy evidence',
      consumerStepIds: ['evaluate-redacted-live-provider-evidence'],
      terminal: false
    },
    {
      id: 'artifact:authorized-live-app-plan',
      ownerStepId: 'validate-and-orchestrate-live-candidate',
      channel: 'runtime-authorized registered plan',
      consumerStepIds: ['execute-registered-live-app-actions'],
      terminal: false
    },
    {
      id: 'artifact:redacted-live-runtime-preflight-evidence',
      ownerStepId: 'validate-and-orchestrate-live-candidate',
      channel: 'detached runtime evidence',
      consumerStepIds: ['evaluate-redacted-live-provider-evidence'],
      terminal: false
    },
    {
      id: 'artifact:live-app-action-result',
      ownerStepId: 'execute-registered-live-app-actions',
      channel: 'detached App action and transaction result',
      consumerStepIds: ['evaluate-redacted-live-provider-evidence'],
      terminal: false
    },
    {
      id: 'artifact:live-provider-formal-proof',
      ownerStepId: 'evaluate-redacted-live-provider-evidence',
      channel: 'terminal redacted formal evidence',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const invariants = [
    {
      id: 'credential-never-enters-browser-or-artifacts',
      statement:
        'The dedicated API key is read only by the loopback proxy process and never enters App source, browser-visible state, runtime metadata, fixtures, logs, screenshots, videos, traces, or formal artifacts.',
      stepIds: [
        'authorize-live-provider-test-run',
        'accept-explicit-live-test-intent',
        'request-live-provider-candidate',
        'evaluate-redacted-live-provider-evidence'
      ],
      artifactIds: [
        'artifact:approved-live-provider-test-run',
        'artifact:live-test-agent-intent',
        'artifact:redacted-live-provider-usage',
        'artifact:live-provider-formal-proof'
      ],
      specRefs: [
        '#credential-request-and-secret-contract',
        '#backend-proxy-contract'
      ]
    },
    {
      id: 'mock-and-default-remain-keyless',
      statement:
        'Default startup and exact ai=mock remain deterministic, keyless, network-free from live-provider calls, and independent of live-test readiness.',
      stepIds: [
        'authorize-live-provider-test-run',
        'accept-explicit-live-test-intent',
        'evaluate-redacted-live-provider-evidence'
      ],
      artifactIds: [
        'artifact:approved-live-provider-test-run',
        'artifact:live-provider-formal-proof'
      ],
      specRefs: [
        '#explicit-live-test-activation',
        '#test-authority-and-nondeterminism'
      ]
    },
    {
      id: 'provider-output-remains-untrusted',
      statement:
        'Proxy translation never grants authority; every live candidate must pass complete runtime schema, permission, and confirmation preflight before one registered App execution route.',
      stepIds: [
        'request-live-provider-candidate',
        'validate-and-orchestrate-live-candidate',
        'execute-registered-live-app-actions'
      ],
      artifactIds: [
        'artifact:untrusted-live-provider-candidate',
        'artifact:authorized-live-app-plan',
        'artifact:live-app-action-result'
      ],
      specRefs: ['#backend-proxy-contract', '#ownership-contract']
    },
    {
      id: 'canonical-and-history-ownership-is-unchanged',
      statement:
        'Live-provider origin does not change target revalidation, canonical common-API ownership, one-turn transaction and Undo boundaries, partial results, fatal rollback, Render, persistence, or Collaboration semantics.',
      stepIds: [
        'validate-and-orchestrate-live-candidate',
        'execute-registered-live-app-actions',
        'evaluate-redacted-live-provider-evidence'
      ],
      artifactIds: [
        'artifact:authorized-live-app-plan',
        'artifact:live-app-action-result',
        'artifact:live-provider-formal-proof'
      ],
      specRefs: ['#formal-test-matrix', '#product-cases']
    },
    {
      id: 'live-evidence-is-bounded-not-ci-authority',
      statement:
        'The credentialed suite is bounded formal release evidence and cannot replace deterministic Mock and VTracer merge-CI, exact visual, collaboration, or performance authority.',
      stepIds: [
        'authorize-live-provider-test-run',
        'evaluate-redacted-live-provider-evidence'
      ],
      artifactIds: [
        'artifact:approved-live-provider-test-run',
        'artifact:live-provider-formal-proof'
      ],
      specRefs: ['#test-authority-and-nondeterminism', '#definition-of-done']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'credential-and-budget-readiness',
      title: 'Dedicated credential, fail-closed preflight, and budgets',
      assertions: [
        'A human owner requests one dedicated least-privilege key after provider/model capability review and owns revocation or rotation.',
        'Explicit live execution without approval, key, proxy, provider/model, or budget fails before browser and vendor work and cannot fall back to Mock.',
        'One run is limited to eight requests, five provider minutes, USD 2.00, and 45 seconds per request.'
      ],
      stepIds: [
        'authorize-live-provider-test-run',
        'accept-explicit-live-test-intent',
        'request-live-provider-candidate',
        'evaluate-redacted-live-provider-evidence'
      ],
      specRefs: [
        '#credential-request-and-secret-contract',
        '#explicit-live-test-activation'
      ]
    },
    {
      id: 'proxy-and-secret-isolation',
      title: 'Loopback same-origin proxy and secret isolation',
      assertions: [
        'The browser calls only the generic same-origin endpoint and never receives or sends a vendor key or authorization value.',
        'The proxy alone owns server-side secret read, vendor authentication, provider translation, usage enforcement, abort, and stable redacted failures.',
        'Raw vendor request and response data never becomes runtime, UI, log, or formal evidence.'
      ],
      stepIds: [
        'accept-explicit-live-test-intent',
        'request-live-provider-candidate',
        'evaluate-redacted-live-provider-evidence'
      ],
      specRefs: [
        '#credential-request-and-secret-contract',
        '#backend-proxy-contract'
      ]
    },
    {
      id: 'live-planning-and-app-semantics',
      title: 'Live planning, existing ids, confirmation, and one Undo',
      assertions: [
        'The real model receives the bounded committed attachment and returns only registered candidate actions that pass complete runtime preflight.',
        'Bounded creation and blue-whisker follow-up use ordinary App common APIs, revalidated current ids, one outer transaction, and one intended Undo action per mutating turn.',
        'No-change clarification, confirmation, cancellation, invalid output, partial result, and fatal rollback preserve existing owner semantics.'
      ],
      stepIds: [
        'request-live-provider-candidate',
        'validate-and-orchestrate-live-candidate',
        'execute-registered-live-app-actions',
        'evaluate-redacted-live-provider-evidence'
      ],
      specRefs: ['#formal-test-matrix', '#product-cases']
    },
    {
      id: 'formal-evidence-and-authority',
      title: 'Redacted evidence, visual review, and deterministic authority',
      assertions: [
        'The formal report contains only bounded aliases, timings, outcomes, usage, cost, stable errors, and canonical history summaries.',
        'Synchronized review inspects the same credentialed live App state and generated reports, screenshots, videos, and traces remain ignored.',
        'Mock and VTracer suites remain deterministic merge-CI, exact drawing-detail, visual, collaboration, and performance authority.'
      ],
      stepIds: ['evaluate-redacted-live-provider-evidence'],
      specRefs: ['#test-authority-and-nondeterminism', '#definition-of-done']
    }
  ]

  const flowInspectorData = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'asyra-design-ai-conversational-drawing-live-provider-test',
      kind: 'feature',
      title:
        'Asyra Design Conversational AI Live Provider Formal Test Inspector',
      subtitle:
        'Dedicated API-key authorization, loopback same-origin provider proxy, untrusted live candidate preflight, registered App execution, and bounded redacted formal evidence.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner:
        'Asyra Design Conversational AI Live Provider Formal Test Plan',
      inspectorOwner:
        'Asyra Design Conversational AI live-provider formal-test owner flow'
    },
    links: [
      {
        id: 'live-provider-test-plan',
        kind: 'authority',
        label: 'Live provider formal test contract',
        href: './ai-conversational-drawing-live-provider-test-plan.md'
      },
      {
        id: 'mock-drawing-inspector',
        kind: 'prerequisite',
        label: 'Active Mock drawing behavior authority',
        href: './ai-conversational-drawing-flow-inspector.html'
      },
      {
        id: 'performance-inspector',
        kind: 'prerequisite',
        label: 'First queued performance successor',
        href: './ai-conversational-drawing-performance-flow-inspector.html'
      },
      {
        id: 'framework-runtime-inspector',
        kind: 'prerequisite',
        label: 'Framework AI Agent Runtime authority',
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
