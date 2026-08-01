# Asyra Design Conversational AI Live Provider Formal Test Plan

## Status

Queued credential-gated successor to the completed Conversational AI Mock
Drawing and drawing-performance plans. It remains inactive until the product
owner explicitly starts it and the credential-owner requirements below are
satisfied.

This plan does not close, replace, or weaken the completed Mock plan. In
particular, exact `ai=mock` remains deterministic, network-free, and usable
without an API key.

Implementation may begin only after:

- the product owner has validated the completed Mock drawing experience;
- the completed performance successor remains the retained deterministic
  collaboration and performance authority;
- a provider account owner approves one live-test vendor/model, budget, and
  credential owner; and
- the matching Inspector, bounded Gherkin cases, and security gates agree.

Architecture authority:

- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-live-provider-test-flow-inspector.data.cjs`
- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-live-provider-test-flow-inspector.html`
- `docs/ai/apps/asyra-design/plans/__tests__/ai-conversational-drawing-live-provider-test-flow-inspector.contract.test.cjs`

Executable product cases:

- `docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-live-provider-test.feature`

Framework prerequisites:

- `docs/ai/framework/SECURITY.md`
- `docs/ai/framework/packages/ai-agent-runtime.md`
- `docs/ai/framework/plans/ai-agent-runtime-flow-inspector.data.cjs`

## Goal

Add a formal, explicitly opt-in acceptance suite that calls one real AI model
through the existing provider contract and proves the Asyra Design Agent can
use live provider output without weakening credential, action, transaction,
confirmation, cancellation, canonical-id, or redaction boundaries.

The first formal live-provider run is intentionally smaller than the
deterministic high-detail VTracer drawing suite:

1. A provider account owner selects a model that supports structured JSON and
   image input, then requests a dedicated project-scoped test API key.
2. A dedicated loopback test proxy receives the key through server-only secret
   injection and exposes one same-origin App endpoint.
3. The operator explicitly enables the live suite and opens the App with exact
   `ai=live-test`.
4. The user attaches the committed tabby reference and asks the Agent to draw
   only the cat on a same-size white background.
5. The live provider must return a schema-valid registered action plan. A
   generic image request may first choose the App-owned drawing-detail
   clarification and must not mutate the canvas during that clarification.
6. A bounded editable cat-face creation case proves a live provider candidate
   can execute through the ordinary registered composition action. It is not a
   photographic-fidelity oracle.
7. Against the resulting or deterministically seeded canonical composition,
   the user asks for blue whiskers. The live plan must target only revalidated
   existing canonical ids and create one intended Undo action.
8. A confirmation-required request visibly pauses; cancellation, denial,
   timeout, invalid credentials, and teardown settle without leaked work.
9. The suite emits only a redacted run summary and the credential owner revokes
   the disposable key or applies the approved rotation policy.

The committed Mock/VTracer suite remains the exact drawing-detail, visual,
canonical, collaboration, Undo/Redo, and merge-CI authority. The live suite is
formal release evidence for provider integration, not a replacement for
deterministic tests.

## Current Baseline

- Exact `ai=mock` is the only enabled App AI mode.
- The App conversation surface, attachment handoff, progress projection,
  confirmation UI, registered drawing actions, partial/fatal behavior,
  existing-id follow-ups, transaction correlation, and Message Bar are already
  owned by the active Mock plan.
- `@asyra/ai-agent-runtime` already provides a generic HTTP adapter that accepts
  only HTTPS or same-origin endpoints.
- The App integration suite proves a generic HTTP provider can replace the
  mock provider without changing registered action contracts.
- The runtime and generic adapter never read API keys, environment files,
  browser storage, or other implicit credential sources.
- No Asyra Design live-test mode, vendor proxy, server-only secret injection,
  provider account, API key, cost policy, or opt-in live E2E command exists.

## Credential Request and Secret Contract

- A human provider account owner selects the vendor/model and requests one
  dedicated, project-scoped API key for Asyra Design formal testing.
- The selected model must support the required structured plan response and
  accepted image media types before a key is requested. A key is not evidence
  that the model satisfies the action contract.
- The key has only the minimum inference permission. It must not share
  production data access, administrative permissions, unrelated projects, or
  a personal unrestricted billing scope.
- The default per-run limits are:
  - at most eight vendor requests;
  - at most five minutes of live-provider wall time;
  - a hard spend ceiling of USD 2.00; and
  - a 45-second timeout per request.
- Raising any default limit requires an explicit product-owner decision and a
  plan/Inspector update before the next run.
- The test proxy reads the key only from the server-side
  `ASYRA_DESIGN_LIVE_AI_TEST_API_KEY` secret at process start. The name and
  presence may be checked; the value is never copied into App code, a
  `VITE_*` value, HTML, runtime metadata, query strings, request bodies sent by
  the browser, local storage, fixtures, screenshots, videos, traces, logs, or
  committed files.
- Local runs inject the secret into the dedicated proxy process from the
  operator's existing secret source. CI, if ever authorized for a protected
  manual environment, must use its secret manager. This plan never adds a
  tracked `.env` file.
- The checked-in run configuration contains provider/model aliases, endpoint
  path, timeouts, and numeric budgets only. It contains no credential.
- Before plan completion, the account owner either revokes the disposable key
  or confirms the approved retention and rotation policy. Any suspected
  exposure immediately blocks further runs and requires revocation.

## Explicit Live-Test Activation

- The default test, build, and App startup paths remain AI-disabled or
  deterministic Mock-only and make no vendor request.
- A formal live run requires both:
  - exact server-side opt-in `ASYRA_DESIGN_LIVE_AI_TEST=1`; and
  - exactly one `ai=live-test` URL value supplied by the dedicated test
    harness.
- The query value alone is insufficient. The dedicated test server must also
  supply a non-secret same-origin endpoint capability after server-side
  preflight succeeds.
- Duplicate, empty, unknown, or mixed `ai` values resolve to the existing
  disabled behavior. Exact `ai=mock` continues to select only the deterministic
  mock provider and never consults live-test configuration.
- If the operator explicitly requests a live run but the key, provider/model,
  budget, or proxy preflight is missing, the command fails before browser
  launch and before any vendor request. It must not silently skip, fall back to
  Mock, or report live success.
- When the live-test query appears outside the dedicated ready server, the App
  remains disabled or shows one stable unavailable result without attempting a
  vendor call.
- The live mode reuses the same non-modal panel, attachment UI, operational
  summaries, confirmation UI, and Message Bar. It does not add speaker labels,
  provider names, raw model text, or chain-of-thought.

## Backend Proxy Contract

- The browser calls only a same-origin endpoint such as
  `/api/ai-agent/live-test` through `createGenericHttpAiProvider(...)`.
- The dedicated proxy binds to loopback, accepts only the test App origin and
  method, validates content type and request size, and rejects requests outside
  its active run budget.
- The proxy owns vendor endpoint selection, authentication header
  construction, provider-specific request/response translation, rate limiting,
  usage accounting, and stable error mapping.
- The proxy sends the minimum provider context required by the scenario. It
  never forwards canonical stores, history, collaboration state, raw audit
  output, or unrelated attachments.
- Vendor output is untrusted. The proxy may translate the vendor's structured
  response into the public candidate shape, but it cannot mark a plan valid,
  grant permission, confirm an action, open a transaction, or mutate App state.
- Raw vendor response bodies, SDK exceptions, headers, request ids that encode
  secrets, and authorization diagnostics never cross the proxy boundary.
- The proxy returns stable provider error codes plus bounded redacted usage
  metadata. Authentication failure, quota exhaustion, rate limiting, timeout,
  invalid JSON, and schema-invalid output remain distinguishable without
  exposing the credential or raw response.
- App teardown or test cancellation aborts the browser request, proxy vendor
  request, retry delay, and response translation. No late candidate may reach a
  disposed runtime.
- The test proxy is formal test infrastructure only. Production authentication,
  multi-tenant authorization, durable audit retention, deployment secrets, and
  a public production endpoint require a separate production plan.

## Formal Test Matrix

### Keyless and disabled authority

- Normal unit, integration, E2E, lint, and build commands run with no key and
  produce no live-provider request.
- Exact `ai=mock` continues to pass without a key or proxy.
- An explicitly requested live command with a missing key fails preflight
  before server/browser/provider work and reports only the missing secret name.

### Credential and transport failures

- An invalid or revoked key maps to a stable authentication failure.
- Quota, rate-limit, timeout, connection, malformed JSON, and provider schema
  failures remain bounded, redacted, and non-mutating.
- Cancellation during fetch or retry and App/test teardown release all
  request-local resources.

### Live planning and safe execution

- The committed tabby attachment plus the exact cat-only, same-size-white-
  background request reaches the real selected model.
- A generic reference request may return only the registered App-owned
  drawing-detail clarification before mutation. Provider-selected option
  labels, counts, warnings, or hidden reasoning are rejected.
- A bounded cat-face creation candidate must normalize and validate completely
  before permission or transaction work, then execute only through the
  registered App action and ordinary common APIs.
- This plan adds no App action-schema item, path, point, payload, or composition
  ceiling. Provider request/token/spend limits bound the external formal run,
  not the finite editable drawing accepted by canonical App owners.
- A blue-whisker follow-up receives only currently permitted, revalidated
  target ids and updates existing elements without regenerating the complete
  composition.
- Every mutating live-provider turn produces one outer transaction and one
  intended Undo action; no-change, denied, cancelled, invalid, and failed turns
  produce none.
- A confirmation-required action pauses in the App-owned Allow/Deny UI and
  revalidates target ids after the wait before mutation.
- Operational status contains stable phases and elapsed time only. It never
  exposes model chain-of-thought, raw action arguments, provider bodies, or
  secrets.

### Bounded evidence

- Each formal run records provider/model aliases, start/end time, scenario
  outcomes, request count, usage totals when supplied, estimated cost, stable
  error codes, canonical result summaries, and transaction/history assertions.
- Reports contain no key, authorization value, raw vendor request/response,
  chain-of-thought, image bytes, full canonical snapshot, or App context.
- Generated live-run reports, screenshots, traces, and videos remain ignored
  local artifacts unless a later product-owner decision promotes a specifically
  reviewed redacted fixture.
- No live scenario automatically retries after transaction start. Transient
  pre-transaction retries remain bounded by the runtime policy and the eight-
  request run limit.

## Test Authority and Nondeterminism

- The live-provider suite is checked-in, named, and reviewable formal test code,
  but execution is an explicit credentialed release gate.
- It is not part of ordinary CI, cannot run on untrusted pull requests, and
  never becomes the sole merge or semantic authority.
- Assertions target stable contracts: accepted media, candidate schema,
  registered action names, complete preflight, permission, confirmation,
  canonical id targeting, transaction/history count, cancellation, redaction,
  request/usage budget, and stable terminal outcomes.
- Tests do not assert exact prose, exact provider explanation, hidden reasoning,
  exact token count, or photographic pixel equality from model output.
- The deterministic Mock/VTracer suite remains authoritative for exact
  high-detail element/point counts, visual fidelity, partial/fatal fixtures,
  collaboration convergence, and reproducible performance measurements.
- One live-provider failure is reported with its stable owner stage and
  redacted artifact. It is not hidden by automatically substituting a mock
  result.

## Ownership Contract

### Provider account and test release owner

- selects vendor/model capability, requests and owns the dedicated key,
  approves budgets and test window, and owns revocation/rotation;
- authorizes each live run; and
- never supplies the key through source, chat transcript, browser input, or
  committed test data.

### Asyra Design live-test proxy

- owns server-only secret read, loopback/same-origin policy, vendor
  authentication, provider translation, usage/cost enforcement, abort, and
  stable redacted failures;
- returns only an untrusted public provider candidate; and
- owns no App permission, confirmation, transaction, canonical state, history,
  Render, or Collaboration decisions.

### Asyra Design App composition and UI

- owns exact live-test mode resolution, non-secret endpoint capability,
  conversation intent, attachments, operational projection, confirmation UI,
  elapsed time, and teardown;
- uses only the generic HTTP provider against the same-origin proxy; and
- preserves exact Mock behavior and disabled-default startup.

### `@asyra/ai-agent-runtime`

- treats the live candidate exactly like every other provider result;
- owns normalization, complete registered-schema preflight, permission,
  confirmation wait, transaction wrapping, bounded pre-transaction retry,
  cancellation, redaction, and terminal result; and
- never reads or receives the vendor API key.

### Asyra Design actions and canonical owners

- revalidate targets and execute only registered actions through ordinary App
  common APIs;
- preserve one mutating turn, one transaction, and one intended Undo action;
  and
- retain the active plan's partial, fatal rollback, Render, persistence, and
  Collaboration ownership.

### Formal live-test harness

- owns server/browser lifecycle, explicit opt-in, key-presence preflight,
  numeric budgets, scenario orchestration, canonical/history assertions,
  redacted reporting, ignored artifacts, and synchronized live visual review;
- cannot inspect, print, snapshot, or attach the secret value; and
- cannot accept a Mock response as live-provider evidence.

## Product Cases

Formal product cases cover:

1. Default commands and exact Mock mode run without a key and make no live
   request.
2. Explicit live opt-in without every prerequisite fails before browser launch
   and cannot silently skip or fall back to Mock.
3. A dedicated key is requested by the provider account owner, injected only
   into the loopback proxy, constrained by request/time/spend budgets, and
   revoked or rotated according to the approved policy.
4. Exact `ai=live-test` plus a ready non-secret endpoint capability composes one
   generic HTTP provider; duplicate, mixed, or unsupported values stay
   disabled.
5. The committed tabby attachment and cat-only request reach the selected real
   model without exposing the API key or unrelated App/canonical context.
6. A live reference interpretation can produce the registered no-mutation
   drawing-detail clarification without provider-owned labels or resource
   claims.
7. A live bounded creation candidate passes complete runtime preflight before
   one ordinary App transaction; schema-invalid or unknown actions never
   mutate.
8. A live blue-whisker follow-up targets only revalidated existing canonical
   ids, preserves unrelated members, and adds exactly one Undo action.
9. A confirmation-required request pauses visibly, revalidates after the wait,
   and accepts, denies, aborts, or tears down without a hidden Promise.
10. Invalid/revoked credential, quota, rate limit, timeout, malformed response,
    cancellation, and provider failure are stable, redacted, bounded, and
    non-mutating.
11. The run cannot exceed eight requests, five live-provider minutes, USD 2.00,
    or 45 seconds per request without failing closed.
12. The redacted report proves provider transport and App invariants while
    exact Mock/VTracer tests remain deterministic CI and visual authority.

## Explicit Non-Goals

- committing, printing, recording, or transmitting an API key to the browser;
- direct browser-to-vendor calls or vendor authorization headers in App code;
- making live tests automatic CI or pull-request authority;
- making `ai=live-test` a default, generated-template, or production launch
  mode;
- production identity, authorization, billing, observability, secret
  rotation automation, or a public multi-tenant proxy;
- replacing Mock/VTracer exact drawing, visual, collaboration, or performance
  tests with nondeterministic model output;
- asserting private chain-of-thought, raw provider bodies, exact prose, or exact
  photographic output;
- adding an artificial item, path, point, payload, or composition acceptance
  ceiling to the existing drawing action;
- expanding the registered action catalog, bypassing app schemas/common APIs,
  or granting a provider arbitrary code/property access;
- storing live conversation history, attachments, or reports as canonical
  document state; or
- requesting or using a real key during this plan-authoring step.

## Inspector Owner Steps

The matching Inspector defines these exact owner steps:

1. **Authorize one live-provider test run**
   - vendor/model capability, dedicated API-key request owner, numeric budgets,
     test window, revocation/rotation policy, and no secret value in artifacts.
2. **Accept one explicit live-test conversation intent**
   - exact server/query opt-in, ready non-secret endpoint capability,
     App-owned attachment/intent, disabled/Mock bypasses, and one active turn.
3. **Request one live provider candidate through the proxy**
   - same-origin generic HTTP transport, server-only authentication, minimal
     provider context, usage accounting, abort, and redacted stable failures.
4. **Validate and orchestrate the live candidate**
   - untrusted candidate normalization, complete action-schema preflight,
     permission, confirmation wait, bounded retry, transaction entry, and safe
     progress.
5. **Execute registered App actions**
   - immediate target revalidation, common APIs, complete/partial/fatal
     semantics, canonical owners, and one history action per mutating turn.
6. **Evaluate redacted formal evidence**
   - opt-in/missing-key gates, request/time/spend budgets, live-vs-Mock proof,
     canonical/history assertions, failure cases, cleanup, ignored artifacts,
     and synchronized live visual review.

Every step declares owner, inputs, outputs, conditions, bypasses, allowed and
forbidden contributors, implementation boundary, specification references,
failure owner, product cases, and Definition of Done.

## Planned Implementation Slices

Each future slice starts with a Step Execution Card and may receive a bounded
local commit only after its focused formal tests and direct-consumer review
pass.

1. Close plan/Inspector/BDD readiness without requesting a key.
2. Add failing keyless regression tests for disabled/default startup, exact
   live-test activation, missing-key preflight, Mock isolation, redaction,
   budget failure, and teardown before production/test implementation.
3. Add the dedicated loopback proxy, non-secret endpoint capability, exact
   live-test startup composition, and a fully local fake-vendor integration
   route; no real key is needed for this slice.
4. Add the checked-in opt-in formal E2E command, ignored redacted-artifact
   policy, live-vs-Mock proof, and dry-run budget accounting.
5. Have the provider account owner select the vendor/model and request the
   dedicated test API key. Inject it only into the proxy process and prove
   browser/log/artifact non-disclosure.
6. Execute the bounded live matrix once, inspect failures by their owning
   Inspector step, and retain only redacted evidence.
7. Run synchronized live-app visual review from the same credentialed App
   state, then revoke the disposable key or apply the approved rotation policy.

## Required Validation

### Plan and Inspector readiness

- target-specific Inspector contract test;
- shared Flow Inspector structural/viewer test;
- exact plan/Inspector/BDD authority, queue order, paths, and anchors;
- completed Mock and performance plan routing remains consistent; and
- no contradiction with Framework provider/secret boundaries.

### Keyless implementation gates

- exact mode parsing and startup side-effect tests;
- missing-key explicit-run preflight fails before browser/vendor work;
- Mock mode never consults live-test capability or secret state;
- proxy request/response translation, origin, method, size, timeout, abort,
  retry, budget, and redaction tests use fake vendor responses;
- runtime generic-provider integration and App action/transaction tests;
- no secret-like value appears in browser requests, DOM, console, traces,
  screenshots, videos, or result artifacts.

### Credentialed formal gates

- one explicitly authorized live run against the selected vendor/model;
- image attachment and cat-only intent reach the live provider through the
  proxy;
- registered clarification, bounded creation, existing-id follow-up,
  confirmation, cancellation, timeout, invalid credential, and stable failure
  cases;
- canonical ids, target preservation, transaction count, Undo count, no-change
  history, and rollback assertions before visual review;
- request, time, token/usage when available, and estimated spend remain within
  the approved limits;
- synchronized same-live-state screenshots inspected with
  `app-visual-review-sync`;
- affected App/runtime tests, lint, builds, dependency validation, and
  generated-template disabled-default checks; and
- disposable key revocation or approved retention/rotation confirmed without
  recording the key.

## Definition of Done

- The plan, Inspector, BDD, active-plan routing, Framework security boundary,
  and checked-in test commands agree.
- A human owner has requested and controls one dedicated least-privilege
  provider test key; the key is never in source, browser state, artifacts, or
  runtime metadata.
- Default and Mock paths remain keyless, deterministic, and free of live
  provider requests.
- Explicit live-test activation is fail-closed and cannot report Mock output as
  live evidence.
- The real provider is reached only through the loopback same-origin proxy and
  every candidate remains untrusted until complete runtime preflight passes.
- The credentialed matrix proves registered App execution, existing-id
  follow-up, one-turn/one-transaction/one-Undo behavior, confirmation,
  cancellation, failure redaction, and teardown.
- The live run remains within eight requests, five live-provider minutes, USD
  2.00, and 45 seconds per request.
- Exact Mock/VTracer tests remain the merge-CI, visual-detail, collaboration,
  and performance authority.
- Formal redacted evidence and synchronized same-live-state visual review pass;
  generated run artifacts remain ignored.
- The disposable key is revoked or the approved retention/rotation policy is
  applied.
- The final bounded review finds no client credential, direct vendor call,
  raw-provider leakage, chain-of-thought, action/catalog bypass, second
  transaction/history owner, hidden Mock fallback, or production-launch claim.

## Stop Conditions

Stop and request direction if implementation or testing requires:

- placing any API key or vendor authorization value in browser-visible or
  committed state;
- a direct browser-to-vendor request or a proxy reachable beyond the bounded
  test origin without production authorization;
- running without an explicit request/time/spend ceiling;
- treating live model output as deterministic CI, exact visual, or canonical
  semantics authority;
- weakening exact `ai=mock`, disabled-default startup, action schemas,
  permission, confirmation, transaction, rollback, history, or canonical-id
  ownership;
- exposing raw provider bodies, prompts beyond the committed formal cases,
  secrets, or private chain-of-thought;
- selecting a model that cannot produce the required structured candidate or
  accept the committed image input;
- expanding into production authentication, public deployment, or a broader
  action catalog without a separately authorized plan; or
- three failed implementation iterations at the same Inspector owner step.
