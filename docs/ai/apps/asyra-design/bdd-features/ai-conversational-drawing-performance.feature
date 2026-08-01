Feature: Conversational AI drawing performance
  As an Asyra Design user creating high-detail editable drawings
  I want canonical drawing, local projection, and collaboration to use one bounded framework flow
  So that high detail remains interactive without weakening identity or history semantics

  Background:
    Given the committed 1672 by 941 tabby reference image
    And every production App session has one required fileId and starts one formal server-backed Agent runtime and provider
    And production identifiers name the action batch, drawing artifact, canonical batch, and wire artifact, not plan, Mock, fake, or simulated data
    And product spans are separated from server, browser, assertion, screenshot, and recording overhead
    And the final high-detail reference gate reuses one guarded creation-only endpoint run without warm-up or repeat

  Scenario: Profiling remains observational
    When the balanced high-detail collaboration profile is evaluated
    Then timing should distinguish product execution, Factory artifact construction, worker encode, server queue and drain, worker decode, remote apply, Render, UI, and harness overhead
    And the Contents present average should be 7.026 seconds
    And the Contents omitted average should be 7.074 seconds
    And prior high-detail throughput evidence should retain the receiver provider and worker handoff timing
    And detached profiling should not alter canonical state, delivery, history, retry, cancellation, or terminal results

  Scenario: Runtime resolves one server-prepared AiActionBatch without client model validation
    Given the provider "requestActionBatch()" returns one server-prepared "AiActionBatch" with a batchId and one large insert-composition action
    When Runtime passes that batch to "resolveAiActionBatch()"
    Then "resolveAiActionBatch()" should return one "ResolvedAiActionBatch" without a public or internal client prepare, normalize, or validate phase
    And the complete control envelope should reject empty, duplicate, or unknown actions without traversing item, path, point, style, bounds, or geometry arguments
    And each action definition should expose one backend-facing inputSchema and one executor without a client action schema, parse, or prepare API
    And the server should validate and normalize every item, path, point, role, style, and bound before returning the batch
    And the server-prepared action should contain one PreparedDrawingArtifact with one prepared Group descriptor and ordered child descriptor slices containing complete source creation data, stable ids, relationships, point counts, and roles
    And it should contain one bounded redaction-ready summary rather than a parallel point-object graph
    And permission resolution should return one "PermissionReadyAiActionBatch"
    And permission and execution should receive the same action arguments identity from the resolved batch
    And confirmation and terminal presentation should consume one "AiActionBatchPreview" containing bounded summaries without items, paths, points, or complete geometry
    And Runtime should not recursively detach or freeze the server-prepared arguments
    And production should expose only the AiActionBatch API without a compatibility conversion, Mock, fake, simulated, or local-only provider path
    And the action definition should receive no large-payload, validation, delivery, progressive, loading, or collaboration mode
    And the front end should perform no item, path, or point validation or drawing-artifact encoding
    And the executor should preserve exact items, roles, order, bounds, point counts, stable IDs, and relationships while submitting only the next prepared progressive descriptor slice through "Core.createElementsInParent(...)" after the server-prepared loading bounds are visible
    And create-app template output parity should remain deferred to a separate follow-up outside this CRDT closure
    But the ordinary App common API and plural Core route should remain the only canonical commit owners
    And the resolved batch should remain local, noncanonical, and nonshared

  Scenario: Guarded prepared-descriptor source proof precedes high-detail execution
    Given the exact 16-item response contains 12919 points in eight prepared slices
    And Runtime pre-execute remains less than 1 millisecond
    When the App consumes the prepared Group and child descriptors
    Then it should create the Group through "Core.createElementsInParent(...)"
    And it should cross one browser paint opportunity after the Group before submitting children
    And the guarded 16-item proof should pass below the fixed host limit before the guarded 7076-element proof may start

  Scenario: Local source pipeline preserves shared records without per-record runtime work
    Given the server-prepared drawing artifact contains stable property records and IDs for every point, segment, network, root Vector, and fill
    When Actor A submits each prepared descriptor slice through "Core.createElementsInParent(...)"
    Then one bulk action containing 100 Vector items should create 100 independently addressable Vector element data records, plus one Group record when grouping is requested
    And it should not merge those Vector items into one giant Vector data record
    And Core should build one owner-to-relationship index before element creation
    And Props should materialize the complete slice without a per-record structured clone, save, or equality boundary
    And relationship propagation should use one manager-owned affected-owner batch with no per-edge subscription
    And Scene Tree local Computed projection should consume the same owner artifact and remain outside shared data
    And Factory should deliver one local canonical batch while exposing ordered record ranges only to transport
    And Preset, Render, and UI should not split that local canonical batch into single-entry changes
    And every successful slice should cross a browser paint opportunity before the next canonical mutation

  Scenario: Each named endpoint checkpoint proves high-detail effectiveness without overwhelming the host
    Given one endpoint completed its focused formal tests and bounded review
    And its guarded 16-item safety proof completed below the fixed host limit
    And the local-source, relay, or final checkpoint has explicit product-owner approval for at most one 7076-element creation with no follow-up, persistence, media, trace, CPU profile, warm-up, or repeat
    And production build commands completed as separate setup outside the runtime guard and product timing
    And artifact attestation succeeded before Playwright started
    When the guarded endpoint benchmark starts
    Then an authenticated ready heartbeat should confirm process ownership and CPU sampling before the drawing request
    And Actor A should reach collaboration-ready and two fresh raw settled samples before the independent Actor B browser is launched
    And Actor B should reach collaboration-ready and both Actors should reach two fresh raw settled samples before the ready heartbeat
    And settled bootstrap samples should require the requested Actor roles, freshness, both per-Actor browser values, and the real overall value below the ordinary 80-percent idle baseline instead of using a fixed sleep
    And the test or manual harness should seed the exact server response inbox before Actor A navigation
    And the fileId-selected response inbox read should complete before App and Agent readiness
    And those response-inbox, App, and Collaboration bootstrap phases should remain outside product execution timing
    And response inbox adapter seed, read, structured clone, and handoff should remain external backend and transport timing that is recorded separately and excluded from frontend product execution
    And the fixed two-Actor tracked roles should be test-harness, client-a-browser, client-b-browser, app-server, and websocket-server while a single-Actor attribution omits only client-b-browser
    And Actor A and Actor B should run in independently launched Chromium process groups
    And each invocation should own one production preview and one WebSocket server while HMR and pre-existing listeners remain absent
    And one bounded operating-system ps snapshot should retain exact PID, PPID, PGID, cumulative CPU-time, and command identity without supplying formal CPU percentages
    And Darwin top should filter on those exact PIDs plus one long-lived unreported guard-process anchor, produce two bounded pid,cpu tables, and ignore the initialization table
    And only the second current raw percent-CPU table intersected with exact still-live test-owned identities should enter the accepted sample
    And the sampler anchor, untracked system PIDs, and test-owned identities retired before the second current table should not enter any report value
    And the nominal 1,000-millisecond polling cadence should only request another current raw system sample and should never become a measurement window or CPU-percentage formula
    And periodic and phase-boundary sampling should share one serialized OS sample queue with ordered state consumption
    And an observed sampling gap above 3,000 milliseconds should fail closed because the guard may have missed a current raw system peak
    And the exact 7076-element high-performance case should use a 500-percent raw same-snapshot limit for each complete Actor browser process group while 16-item and 1280-item safety or attribution cases retain 250 percent per Actor
    And one raw same-snapshot complete Actor A or Actor B browser sum above the active per-Actor proof-class limit or one raw same-snapshot aggregate both-Actor frontend, backend, and harness sum above 500 percent for 7076 or 400 percent for 16-item and 1280-item should stop all exact tracked roles while the violation report retains separate role CPU
    And Actor A and Actor B should each retain their own highest complete raw frontend snapshot while backend and harness CPU remain excluded from both Actor peaks
    And subtracting cumulative process CPU time, dividing by elapsed wall time, normalizing to the polling cadence, averaging snapshots, or otherwise converting an interval into CPU percent should never determine the formal peak, pass, failure, or stop
    And raw system percent-CPU snapshots and phaseCpuMaximums should never be used as owner attribution
    And root-browser, GPU, utility, other browser CPU, and each renderer PID should remain separately visible and fully included in its owning Actor browser total
    And each renderer PID should retain its Actor identity and its own raw same-snapshot system percent-CPU value
    And page-target CDP should report TaskDuration, ScriptDuration, LayoutDuration, and RecalcStyleDuration while visible worker targets are reported separately
    And unexplained renderer CPU should remain residual renderer evidence instead of being guessed as page or Worker ownership
    And bootstrap before guard ready should remain safety-only while legal process registration or identity churn resets the candidate baseline
    And one complete raw system snapshot after App, Collaboration, and Agent readiness should freeze the request identity
    And prompt fill, locator resolution, and actionability should complete outside the product boundary
    And App-owned request acceptance or dispatch should start local-request
    And no Playwright locator, visibility, count, text, or attribute polling should execute in the product window
    And one App-owned O(1) scalar completion signal should end product timing before UI assertions run after the boundary
    And local-request should report the maximum raw frontend system value observed during the product window
    And each bounded heartbeat should report its capture time, the latest completed phase, any currently active started phase, Actor A and Actor B canonical and uncapped Render projection element counts, and publication progress
    And each guard safety sample should retain its own sample time and heartbeat age instead of presenting the values as co-temporal
    And each attribution invocation may retain one request-wide cumulative process CPU-time boundary as direct non-percentage milliseconds per role
    And ordered browser-monotonic owner spans should distinguish provider request and batch handoff, Runtime resolution, loading, Group, and plural batch work without treating the OS sample as a nested JavaScript timer
    And every boundary sample should pass the same active proof-class raw same-snapshot frontend and aggregate safety evaluations and require exact PID-set equality while any observed process identity change before an accepted terminal heartbeat should make attribution invalid
    And raw operating-system CPU should never become the sole owner-attribution signal
    And the production performance profile should provide O(1) canonical, Render projection, Factory publication, and history scalar evidence without exposing a mutable runtime owner
    And required provider, Runtime, execution, Group, and plural-batch phase presence should use exact O(1) per-name phase counts after retained phase-ring rollover while the bounded phase timeline remains timing evidence only
    And the Render projection count should query the exact ordinary viewport RenderLayer size rather than a computed mirror or capped fixture count
    And exact Undo depth should use the Factory read-only history query rather than private transaction storage
    And ordinary Playwright discovery should exclude this guarded endpoint even when guard environment variables are present
    And the 1,000-millisecond polling cadence should be armed before the first current raw system sample
    And two successfully completed serialized raw observations may be at most 7,000 milliseconds apart while a larger gap should fail closed without averaging or changing either raw CPU value
    And only the authenticated phase-boundary HTTP handoff should have a 7,000-millisecond client deadline for one in-flight plus one requested serialized current-CPU sample
    And ordinary heartbeat and resource-status requests should retain 3,000 milliseconds while the boundary deadline should not extend product execution or the 300-second CRDT flow
    And every CPU sample should have a 200-millisecond hard timeout while sampling failure, guard signals, and exceptional exit terminate the fixed registered process groups
    And an endpoint complete heartbeat should revalidate both exact Actor canonical and uncapped Render projection counts so late over-projection cannot reuse an earlier report
    And after a valid terminal complete heartbeat closes the product proof window, later Chrome teardown process-identity changes should not create a resource stop or invalidate the accepted proof while exact process-group termination remains required
    And a local-attribution complete heartbeat should use a distinct proof kind, validate Actor A only, carry no Actor B report, and never create an accepted endpoint baseline
    And one required proof kind should remain fixed for the entire guarded invocation so endpoint, local-attribution, and collaboration-attribution heartbeats cannot switch categories
    And one raw same-snapshot complete Actor A or Actor B browser sum above 500 percent or one raw same-snapshot aggregate both-Actor frontend, backend, and harness sum above 500 percent should stop the 7076-element benchmark immediately and mark the active endpoint as an invalid architecture attempt
    And Actor A complete, Actor B first-visible, and Actor B complete or converged time should be reported separately
    And CPU above the fixed limit, stale heartbeat above the ordinary 80 percent baseline, or stalled Actor A and Actor B progress above that baseline should fail the endpoint
    And the guard should terminate tracked Playwright, headless browser, App server, and collaboration server processes before returning
    And the failure report should retain the last completed phase, Actor A and Actor B element counts, and last owner timing
    And a raw CPU limit, 300-second product-flow deadline, or 360-second Playwright ceiling should stop the current benchmark action without stopping the implementation task
    And the same owner should immediately capture the first blocker, find its bounded root cause, re-read the Inspector, revise its owner plan and formal oracle, and execute the new iteration before any downstream owner advances
    And a stop whose last heartbeat precedes the first completed canonical Group should pause further 7076-element attempts without claiming which owner was active
    And each single-Actor attribution case should use a fresh browser invocation, one required fileId URL, an active Collaboration session, the WebSocket server, and no Actor B
    And one guarded single-Actor 16-item cat-prefix case with 12919 vector points should begin from a response resident before readiness and separate provider request and batch handoff from material canonical and Render work
    And only after that corrected raw-snapshot case crosses the 250-percent frontend or 400-percent aggregate limit and stops should a bounded replan authorize one equivalent reduced-motion control
    And otherwise one guarded single-Actor 1280-item cat-prefix case should separate provider handoff, Runtime control-envelope resolution, bounded preview, loading, Group, and first plural batch work
    And a two-Actor 1280-item attribution case should run only when the single-Actor case cannot separate collaboration overhead
    And no 16-item or 1280-item attribution case should create an accepted endpoint baseline or replace the exact 7076-element proof
    And the completed attribution should route to exactly one server-response boundary, Runtime, loading, local canonical, or receiver owner
    And an effective endpoint should preserve exact canonical, detail, identity, transaction, history, and zero-client-persistence evidence
    And an ineffective endpoint should return only to its first incorrect owner
    And one design hypothesis should receive at most five materially revised architecture attempts before mandatory root-cause replanning
    But the same focused failure three times should end that attempt loop and start a new bounded owner iteration rather than stopping the task

  Scenario: Converted CPU-time percentages cannot consume a high-detail proof
    Given the 2026-07-31 7076-element attempt stopped only because cumulative CPU-time deltas were converted into interval percentages
    And that attempt recorded a raw same-snapshot frontend value of 199.4 percent
    And that attempt recorded a raw same-snapshot aggregate value of 209.2 percent
    When the performance evidence is evaluated against the raw 250-percent frontend and 400-percent aggregate limits
    Then the converted 397.203-percent frontend value and 401.175-percent aggregate value should be rejected as formal peak and stop evidence
    And the attempt should create no accepted baseline, architecture-attempt count, or next-owner selection
    And no replacement 7076-element run should start before contract review, focused guard correction, a corrected guarded 16-item proof, bounded review, and explicit product-owner approval

  Scenario: Revised high-performance threshold requires a corrected local-source proof
    Given the earlier local-source 7076-element attempt stopped at a raw same-snapshot frontend value of 251.7 percent
    And its same-snapshot aggregate value was 259.0 percent
    When the product owner classifies 7076 elements as a high-performance test with 500-percent frontend and aggregate limits
    Then the earlier stop should remain raw observation evidence but should not be accepted as a limit violation or completed endpoint proof
    And guarded 16-item and 1280-item cases should retain their 250-percent frontend limit
    And guarded 16-item and 1280-item cases should retain the 400-percent aggregate hard safety limit
    And one corrected local-source 7076-element proof should run after focused threshold tests and bounded review before remote apply advances

  Scenario: Two-Actor 16-item activity separates operation from settled idle
    Given production build commands completed as separate setup outside the runtime guard
    And the production App runtime starts through one preview and one WebSocket server
    And Actor A and Actor B opened the same required fileId
    And the exact 16-item server response was resident in the response inbox before App and Agent readiness
    And both Actors reached Collaboration readiness before the guard accepted the request baseline
    When Actor A requests the two-Actor 16-item high-detail fixture
    Then prompt fill, locator resolution, and actionability should have completed outside the product boundary
    And App-owned request acceptance or dispatch should begin operation timing
    And operation should run until Actor B canonical and Render counts are exactly 17
    And Actor A should retain one Undo action while Actor B retains zero Undo, zero echo, and zero client persistence
    And after Actor B completes both Actors should idle for exactly 10 seconds without another product action
    And each Actor page-target should use CDP Performance threadTicks deltas for TaskDuration, ScriptDuration, LayoutDuration, and RecalcStyleDuration
    And those deltas should report page main-thread task occupancy rather than complete Actor CPU
    And worker, GPU, browser, App server, WebSocket server, and harness work should remain in separate OS guard evidence
    And operation timing should contain no response inbox adapter read or fixture materialization
    And the raw same-snapshot 250-percent frontend and 400-percent aggregate hard stops should remain active during operation and idle
    And the case should use collaboration-attribution and should not create an accepted endpoint baseline

  Scenario: Exact-bounds loading state precedes local drawing
    Given one validated local AI composition has exact accepted workspace bounds
    When the App begins the mutating turn
    Then it should publish runtime-only drawing progress with those exact bounds
    And a connected App DOM overlay should commit with the exact transformed bounds before any canonical element is created
    And the overlay should be pointer-events none and never become canonical, persistent, shared, Render-owned, or an AI-only renderer
    And its CSS activity should animate only transform and opacity through the compositor
    And the App should cross a browser paint opportunity after DOM commit and before canonical mutation
    And the App should create the Group through "Core.createElementsInParent(...)" and cross another browser paint opportunity before the first child batch
    And the first completed drawing batch should use the ordinary Vector route
    And success, failure, cancellation, and teardown should clear the drawing progress

  Scenario: Local progressive composition becomes visible in cooperative batches
    Given one validated AI composition contains one Group and 7111 accepted children
    And the production App session opened with its required fileId
    When the local Agent executes the mutating turn
    Then the App should use deterministic point and element-count batch boundaries with at most 32 elements per ordinary work unit
    And it should call plural "Core.createElementsInParent" once per non-empty batch
    And every successful batch should complete ordinary projection and advance actual element progress
    And the next batch should begin only after a browser paint opportunity in the same serialized loop
    And a microtask-only yield or one independently scheduled timeout per range should not satisfy that boundary
    And the Feature-owned AbortSignal should be checked after every awaited boundary
    And all batches should remain inside one outer transaction
    And the complete turn should create one Undo action
    And fatal failure or cancellation should roll back the complete composition
    And no loading, progress, or slice-policy parameter should enter Core, Props Manager, or Scene Tree

  Scenario: Drawing progress keeps navigation responsive while edits stay locked
    Given one progressive local AI drawing turn is active
    And the App acquired its document interaction lock before the outer transaction
    When the serialized composition loop yields through a browser paint opportunity
    Then ordinary viewport pan and zoom should remain available
    And pan and zoom should repaint the same live loading frame and ordinary Vector output
    And navigation may continue through ordinary Feature execution and its existing transaction wrapper
    And navigation should produce no canonical mutation or History
    And navigation should not alter the AI action transaction evidence
    And every other tool interaction and document mutation should remain blocked
    And another mutating Agent turn, selection changes, property edits, deletion, Undo, and Redo should create no canonical mutation or history
    And AI cancellation should remain available
    And success, failure, cancellation, or teardown should release the App lock
    And a second reactive-events bus should not act as the scheduling or admission lock
    And the complete drawing turn should still create one Undo action

  Scenario: Core exposes one fixed plural element creation path
    Given one validated AI composition contains one Group and many accepted children
    When the App submits the next cooperative progressive child batch
    Then it should call plural "Core.createElementsInParent"
    And Core should return only ordered canonical element ids
    And a single-item create API should use the same batch-of-one canonical path
    And Group and children should remain inside one outer Factory transaction
    And Core should expose no Factory delivery handle, progressive handle, timing result, or transport receipt
    And the active Factory transaction should record ordered Props and Scene owner evidence directly
    And Core should receive no loading, progress, AI mode, slice size, or host-yield parameters
    And every non-empty plural Core batch should complete one canonical atomic apply before the serialized loop advances
    And the complete composition should submit multiple ordered plural batches without opening another transaction

  Scenario: Production App exposes one formal server-backed Agent route
    Given the ordinary production entry starts with one required fileId
    And App startup constructs one required server-backed Agent runtime and provider
    When the local Agent executes one server-prepared composition action
    Then the App should use its single cooperative progressive plural-batch route
    And the production App should mount its ordinary Contents projection
    And an opt-in detached performance profile should not configure the App, provider, Runtime, composition route, or Contents projection
    And the composition should yield between deterministic plural Core batches
    And no AI activation or delivery query should select another provider, runtime, or composition path

  Scenario: Canonical element property replacement uses the update path
    Given group geometry, element geometry, stroke, fill, or property-panel changes replace complete canonical property field values
    When one or many elements receive those complete field replacements
    Then Core should use plural "updateElementProperties"
    And that API should not accept record set or remove operations
    And Scene Tree should resolve the complete element-to-property targets without mutation
    And Props Manager should preflight every complete property value before one apply
    And a property-only request should require no prepared Scene mutation
    And the result should contain only ordered affected element ids
    And a later invalid target or value should leave no property or evidence prefix

  Scenario: Canonical element property record delta uses the patch path
    Given a vector topology action contains typed record set or remove operations
    When one or many elements receive that ordered record delta
    Then Core should use plural "patchElementProperties"
    And record set or remove should not use the complete replacement API
    And Props Manager should preflight every child instance, owner relation, order, and field before one apply
    And setting a missing record should materialize its typed child only after complete preflight
    And removing a record should unlink its exact relation and remove only an otherwise unowned child
    And forward and inverse evidence should restore exact values, registry membership, relations, and order
    And "changeComputedData" and "changeComputedDataPatch" should not remain as canonical compatibility APIs

  Scenario: Props and Scene Tree apply separate prepared owner mutations
    Given an accepted batch contains property inputs and Scene lifecycle inputs
    When Core requests complete owner preflights
    Then Props Manager should validate schema, property instances, relationships, registration, and property evidence
    And Core should call public Props prepare and apply owner capabilities instead of package-private methods
    And active property value replacements and record patches should use one whole-batch preflight and apply
    And Scene Tree should validate Scene ids, maps, parent children, hierarchy order, tombstones, and Scene evidence
    And "PreparedCanonicalElementInsertion" should expose its frozen owner relations for Core to pass unchanged to Props exact graph creation
    And Scene Tree element-to-property target resolution should be read-only
    And Core should receive both complete prepared owner mutations before authorizing either apply
    And Props Manager should not mutate Scene maps or hierarchy
    And Scene Tree should not materialize property instances, rebind relationships, or register properties
    And a later invalid item should leave no committed owner prefix
    And an unexpected apply failure should roll back both owners through the outer Factory transaction

  Scenario: Canonical lifecycle selects evidence without origin-specific APIs
    Given ordinary descriptors provide complete source creation or removal data
    And detached canonical data provides exact ids, relations, and ordering
    And retained property evidence provides its separate Props cleanup or restore batch
    When Core coordinates the matching Props and Scene owner preparations
    Then one origin-neutral canonical lifecycle should apply the complete evidence
    And Scene Tree should produce one "PreparedElementMutation"
    And no "UsingActiveProperties" API family or local/remote mutation mode should exist

  Scenario: Scene plural evidence remains sliceable without splitting records
    Given one accepted Scene batch contains many canonical elements
    When Scene Tree applies the complete prepared insertion or removal mutation
    Then Scene Tree should emit one plural Scene event
    And Scene Tree should expose one ordered shared record per element for "ADD_ELEMENTS" and "REMOVE_ELEMENTS"
    And a publication slice may group complete records but should not split one semantic record
    And progressive delivery should not create another Scene mutation or history action

  Scenario: Shared property updates fan out through Scene relations
    Given two distinct element relation tuples reference one compatible canonical property component id
    And each relation is identified by its element id and property name rather than by exclusive component ownership
    When either owner element requests the same canonical property update
    Then Scene Tree should group equivalent targets by property id into one property mutation
    And "UPDATE_PROPERTY" should remain source-only evidence without using the initiating element as fanout authority
    And Scene Tree should resolve both owner elements through its derived reverse relation index
    And both owner elements should receive computed projection through one ordered local batch
    And CRDT should publish the property source once without publishing computed projection
    But conflicting writes to the same shared field or record in one batch should reject atomically before Props preflight

  Scenario: Shared property roots survive until the final relation is removed
    Given two element relation tuples reference the same canonical root property graph
    And that graph contains a nested child which is also another element's canonical root
    When a direct Scene removal releases the first relation
    Then the prepared Scene removal should record released and retained relations and retain Props
    And the remaining element relation should keep the same root and descendant component ids active
    When Core full lifecycle removes the final relation
    Then Scene Tree should identify the deduplicated orphan root from an exact relation-set read
    And Scene Tree should provide the complete retained root property ids from all prepared remaining element relations
    And Core should pass orphan and retained root ids unchanged without inspecting the property graph
    And Props Manager should stop orphan traversal at every retained root
    And Props Manager should remove only the final orphan property graph exactly once
    And a changed relation set between prepare and apply should reject as stale before mutation
    And Undo and Redo should restore and remove the exact relation tuples and canonical component ids
    And remote exact removal should use one origin-neutral Core canonical-data path and consume its Scene and Props batches once
    And CRDT remote apply should preserve the same shared evidence without computed payloads or client persistence

  Scenario: Shared relation boundary remains minimal
    Given Props independently owns property/component identity, lifecycle, and the property-child graph
    And Scene independently owns element hierarchy and each element-slot-to-root relation
    Then that separation should remain the stable extension seam for future shared props, shared components, and shared elements
    But the current contract should not introduce generic owner kinds, reference-count APIs, multi-parent shared elements, shared-element DAG, permissions, leases, pinning, garbage collection, server persistence, server-owned lifecycle policy, or a universal relationship service

  Scenario: Typed subtree removal remains one Scene mission
    Given one non-empty Group owns nested editable elements and canonical property relations
    When Scene Tree calls "prepareSubtreeRemoval" with that one root
    Then the prepared removal should contain the complete child-first canonical element order
    And the prepared removal should contain one "CHANGE_SUBTREE" evidence record
    And the prepared removal should delegate mutation to the same "applyPreparedElementMutation" owner
    And a direct Scene apply should retain Props
    When Core full lifecycle applies that prepared removal
    Then Core should pass the complete orphan and retained root ids unchanged to Props

  Scenario: Load relations preflight before any owner applies
    Given Scene Tree has an owner-issued load validation result and detached Props validated data
    When Scene Tree calls "preflightLoadPropertyRelations"
    Then a missing component id, wrong property type, or changed registration should reject
    And no owner should apply any state
    And the Core version should remain unchanged
    And no file load complete event should publish
    But compatible shared component relations should pass without materialization or active Props reads

  Scenario: Computed data remains a local Render projection
    Given Actor A updates one canonical property
    When Props Manager emits "UPDATE_PROPERTY"
    Then Factory may record and publish the property source evidence
    And the local property subscription should derive computed state
    And "UPDATE_COMPUTED_DATA" should reach Render through an ordinary local reactive event
    And computed evidence should create no History entry, SharedDataChannel batch, Collaboration publication, or persistence snapshot
    And Actor B should derive the same computed state locally after applying the property source evidence
    And a future local animation tick may update computed state without changing a property component or publishing CRDT data
    And the local computed API should accept no "EVENT_OPTIONS"

  Scenario: Settled canvas schedules only demanded frames
    Given the production App has settled with zero elements and no pending invalidation
    Then the Pixi Application ticker should not bypass the Render dirty gate
    And no frame, engine flush, or unbounded performance evidence should continue while idle
    When pan, zoom, canonical, computed, or render-affecting system property data changes
    Then the ordinary Render path should schedule at most one frame and perform at most one explicit engine flush
    And a future local animation should request later frames through its computed updates instead of a permanent idle loop

  Scenario: Nonvisual system state and workspace identity queries stay bounded
    Given AI progress and the document interaction lock are nonvisual system property values
    When either nonvisual system property changes
    Then it should cause no Canvas invalidation
    When Core reads the workspace id
    Then the query should remain constant-time
    And it should never call Scene Tree save or serialize the complete hierarchy

  Scenario: Raw element data and computed projection use distinct evidence
    Given one action changes a canonical raw element field and another changes local computed projection
    When Scene Tree prepares the raw mutation and separately projects computed state
    Then raw name, visibility, and lock should use canonical "UPDATE_ELEMENT_DATA" evidence
    And local computed values should use ordinary "UPDATE_COMPUTED_DATA" projection events
    And Factory should record the raw evidence
    But Factory, History, Collaboration, and persistence should never record the computed projection

  Scenario: SharedDataChannel has one required batch contract
    Given a framework shared channel receives one or many canonical changes
    When Factory delivers the ordered changes
    Then the channel should use required "appendBatch" and "observeBatch" methods
    And framework internals should use the same batch method for a one-item batch
    And public single-item append and observe conveniences should delegate to batch-of-one
    And the built-in batch should be deeply detached and frozen once
    And no atomicity flag, prototype identity branch, WeakSet capability check, or single-item fallback loop should run

  Scenario: Custom shared channels own their implementation correctness
    Given a developer registers a custom SharedDataChannel
    When the channel exposes the complete required batch method shape
    Then the framework should use that declared batch contract without probing its implementation
    And custom atomicity and correctness should remain the developer's responsibility
    But a channel missing the required method shape should fail registration
    And the framework should not repair, split, benchmark, or infer custom behavior

  Scenario: Factory keeps one transaction semantic
    Given one intended action mutates canonical property and Scene owners
    When Factory records the ordered source evidence
    Then each Props or Scene owner evidence emission should be recorded exactly once by the existing transaction journal as one immutable ordered batch
    And canonical ordered ids and shared records should remain inside their owning transaction event
    And "updateTransactionBatch" should accept no parallel evidence parameter
    And the public single-event transaction convenience should delegate to a batch-of-one
    And the existing Factory journal should group those owner batches into one intended History action
    And the outer action transaction should group the ordinary journal entries into one intended Undo stack entry
    And Factory should create no AI-specific or bulk-specific forward/inverse history artifact
    And Factory should create no parallel applied-result mirror of the canonical payload
    And every transaction should use the same record, commit, and rollback semantics
    And observer evidence should publish only after the owner commit as one ordered batch
    But rollback or owner finalization failure should publish no observer prefix
    And progressive local composition may deliver ordinary immediate owner batches inside that transaction
    And progressive visibility should remain an App delivery policy rather than a Factory transaction mode
    And rollback should compensate every already-visible immediate batch from the same journal evidence
    And optional later publication slicing may use the ordinary active staged-delivery controller without creating a status artifact
    And the one active staged-delivery controller should reject ids absent from the current Factory journal
    And Factory should derive each eligible staged slice, committed remainder, or rollback compensation through the same "SharedPublication" route
    And an eligible staged publication should retain stable transaction, publication, slice, and inverse-compensation identity
    And acknowledged staged slices should use the same journal evidence for rollback compensation
    And commit should not republish an acknowledged staged canonical record
    And Undo and Redo should each restore the complete intended action

  Scenario: Factory reuses existing action history and emits only a minimal wire artifact
    Given the registered bulk action runs inside one ordinary App transaction
    And Props and Scene owners emit their ordinary reversible before/after or add/remove change batches
    When the shared-data boundary prepares Collaboration output
    Then the existing Factory journal and Undo stack should remain the only local action-history owners
    And local Render and UI should consume the ordinary canonical owner batch rather than History evidence
    And production should perform no post-action save, equality comparison, finalize-save, full-document comparison, or evidence clone
    And Collaboration should receive one minimal transport wire artifact
    And that "SharedPublication" should contain publication identity, origin, mode, ordered slices, channel batches, and one remote-apply payload per delivery
    And its artifactId should be an opaque wire correlation identity rather than a reference to local History
    And each slice, batch, and delivery should expose only its required ids, order, channel, event name, payload, and actual compensation reference
    But it should contain no inverseEvents, History evidence, rollback evidence, reserved compensation ids, top-level delivery alias, batch records or changes alias, or nested record wrapper
    And Factory and every direct consumer should switch to that one shape atomically without an old-shape compatibility conversion

  Scenario: Collaboration Provider has one publication path
    Given Factory emits one ordered "SharedPublication" transaction batch
    When Collaboration sends or receives that publication
    Then Collaboration should use one required "sendPublication" path
    And Collaboration should use one required "onPublication" async consumer path
    And Collaboration should consume only Factory-owned "SharedPublication" artifacts instead of inferring publications from staged status
    And the outbound promise should resolve only after bounded Provider queue acceptance and delivery ownership
    And the inbound consumer promise should settle only after App canonical apply completes or fails
    And generic Collaboration should own no publication group size, concurrency constant, lease mode, or runtime capability branch

  Scenario: Binary publication transport applies byte backpressure
    Given Collaboration hands one publication to the Provider
    When the Dedicated Worker creates versioned binary publication frames
    Then control frames should remain JSON
    And the Dedicated Worker should own the browser WebSocket data plane
    And the main thread should never receive publication bytes or send "frame-consumed"
    And publication payloads should remain ArrayBuffer values inside that Worker-owned data plane without JSON pre-serialization
    And outbound binary frames should be written directly by the Worker instead of returning to a main-thread socket
    And the server should relay canonical payload bytes without decode or re-encode
    And the receiver should admit frames into a bounded 2 MiB worker ingress window
    And the worker should validate header, order, and duplicate identity before emitting "frame-consumed"
    And each peer should enforce an exact 2 MiB unretired byte capacity
    And one oversized indivisible frame should be allowed only for an otherwise empty peer queue
    And already-admitted peer frames should continue in FIFO order through the bounded byte window before prior "frame-consumed" credit
    And frame retirement and capacity release should still require both the exact socket callback and exact "frame-consumed" credit
    And blocked peer admission should resume when contiguous retirement leaves exact capacity for the next frame
    And blocked publication admission should not pause the JSON control fast path
    And "server-accepted", "frame-consumed", and "peer-applied" should remain distinct receipts
    And those receipts should remain diagnostic status rather than alternate "sendPublication" completion modes
    And client and server WebSockets should use "perMessageDeflate: false"

  Scenario: Wire owners advance from codec through guarded small proof
    Given the transport wire artifact contains only the remote-apply payload, ordered ids, and publication metadata
    When codec encode completes its focused gates
    Then one guarded 16-item proof should pass before receiver admission changes
    And receiver admission should complete before remote apply
    And remote apply should complete before relay backpressure
    And relay should pass the guarded 7076-element endpoint proof only after those owners

  Scenario: Remote property follow-ups derive computed state locally
    Given Actor B receives one valid property-only source publication
    When the required async consumer opens the remote Factory transaction
    Then Actor B should open exactly one remote Factory transaction for that publication
    And the App should submit one ordered "CanonicalChange" request through "Core.applyCanonicalChanges"
    And different source publications should not be merged
    And App policy should validate the publication before Core canonical apply
    And Actor B should apply "UPDATE_PROPERTY" without receiving "UPDATE_COMPUTED_DATA" through CRDT
    And Actor B should derive computed state locally and update ordinary Render output
    And the consumer promise should resolve only after canonical apply completes
    And Actor B should create no Undo action
    And Actor B should create no echo publication
    And Actor B should perform no persistence capture, provider save, or document IndexedDB write

  Scenario: Demo documents load empty without client persistence
    Given an App-owned demo document session starts from one required fileId URL
    When RenderApp starts Core for the demo session
    Then each actor should load one canonical empty document after Core starts
    And Collaboration should connect only after its empty document is loaded
    And the single-Actor session should receive no client persistence provider
    And Actor A should receive no client persistence provider
    And Actor B should receive no client persistence provider
    And single-Actor local actions, Undo, and Redo should perform no persistence capture, provider save, document IndexedDB read, or document IndexedDB write
    And Actor A local actions, Undo, and Redo should perform no persistence capture, provider save, document IndexedDB read, or document IndexedDB write
    And Actor B remote apply should perform no persistence capture, provider save, document IndexedDB read, or document IndexedDB write
    But demo reload durability and server database checkpoints should remain outside this plan

  Scenario: Required fileId selects the document without toggling Collaboration
    Given RenderApp receives one required fileId URL
    And that fileId selects the App-owned document session
    When the first Actor connects after the document load
    Then Collaboration should always be active for the opened document
    And root dev:all should start only frontend workspace processes and the App dev server
    And the explicit collaboration:server command or collaboration Playwright should separately make the reference WebSocket server ready before the App connects
    And one Actor in that document session should be classified as single-Actor processing
    When a second Actor opens the same fileId
    Then both Actors should use the same collaboration room
    And the session should be classified as two-Actor CRDT processing
    But fileId should select the document and never toggle Collaboration
    And a missing or empty fileId should not open a document session

  Scenario: Reset loads a fresh empty demo document without client persistence
    Given RenderApp startup and resetData use the same App-owned fresh empty-document factory
    When resetData is invoked
    Then it should call Core.load exactly once with a fresh empty canonical document
    And Core.load should be the sole FILE_LOAD_COMPLETE publisher
    And Render readiness should not synthesize another file-load-complete event
    And it should perform no document IndexedDB access
    And it should perform no localStorage access
    And it should perform no URL parsing
    And it should perform no page reload
    But it should remain a local reset and create no Factory action or CRDT clear publication

  Scenario: Required fileId preloads one server response inbox record before App readiness
    Given the test or manual harness validates, normalizes, summarizes, and builds one PreparedDrawingArtifact from one exact model response outside the production bundle
    And the production build passed its own artifact attestation
    And the harness generated the exact compressed response and hash manifest into an ignored preview overlay before the runtime guard
    And the response overlay passed a separate attestation before Playwright started
    And canonical production dist contains no prepared response fixture and the overlay is never a production deployment artifact
    And the required fileId selects that response independently from the empty canonical document
    When a same-origin blank seed page fetches and decompresses the selected response before App navigation
    Then it should write that versioned server-prepared "AiActionBatch" directly to the IndexedDB response inbox adapter
    And Playwright should receive only bounded file identity and URL strings, never the prepared response object
    And fetch, decompress, parse, and IndexedDB write timing should be reported separately from frontend product execution
    When App bootstrap begins
    Then it should read only the exact 16, 320, 1280, or 7075-child response selected by fileId
    And the selected response should be resident before App readiness, Agent readiness, and the stable performance baseline
    And selecting a smaller response should not read, construct, or slice a larger response
    And the canonical document should remain empty, noncanonical, and nonshared before Actor A sends a conversation request
    When Actor A sends the response's expected request through the ordinary Agent route
    Then the provider should call only "requestActionBatch()" and return the server-prepared batch selected by fileId
    And request-time response inbox access, fixture import, JSON or SVG parse, path tokenization, geometry transform, model validation, normalization, drawing-artifact encoding, materialization, slicing, and provider deep-freeze should remain zero
    And production should contain no artificial delay, phrase-selected fixture fallback, failure simulation, or Mock, fake, simulated, and local-compat provider naming
    And deterministic preparation, seed data, and fixture selection should remain test or manual harness concerns excluded from the production bundle
    And Actor B should receive the drawing only through Actor A canonical CRDT publications
    But the IndexedDB response inbox adapter should remain separate from document persistence
    And local actions, Undo, Redo, and remote apply should perform no document persistence capture, provider save, or document IndexedDB read or write

  Scenario: Fast server-response AI CRDT correctness stays bounded
    Given two browser actors share one fresh collaboration document
    And their required fileId selected the exact 16-item server response before App readiness
    When Actor A accepts the server-prepared batch through the ordinary Agent route
    Then both actors should converge on identical canonical ids, topology, hierarchy, and styles
    And Actor A should gain one Undo action while Actor B gains no local Undo action
    And the 7112-element balanced correctness gate should remain change-aware or explicitly requested
    And high-detail performance and CRDT suites should remain independent and explicitly opt-in
    And the 7076-element two-window full recording should remain manual opt-in

  Scenario: The guarded endpoint run also proves Actor A local interactivity
    Given two production browser actors share one required fileId and Collaboration is ready
    And the 500-percent frontend and 500-percent aggregate high-performance resource guards own the production App, browser, harness, and WebSocket server processes
    And the independently attested response preview overlay is served instead of modifying canonical production dist
    And Contents, request-time response inbox access, document IndexedDB, HMR, media, warm-up, and repeat are absent
    When Actor A creates the server-prepared 7076-element high-detail composition once
    Then Actor A should show connected exact-bounds loading and ordinary Vector milestones while pan and zoom remain responsive
    And every other document interaction should leave canonical state and history unchanged until terminal cleanup releases the lock
    And bounded counters should report Actor A settled, Actor B first-visible and complete, convergence, Render, UI, harness, and separately attributed server timing
    And Actor A and Actor B should each produce one terminal exact summary with all 7076 projections and identical detail
    And Actor A should gain one Undo action while Actor B gains none
    And Actor A should settle within 30 seconds
    And Actor B should show its first canonical batch within 2 seconds of the first shared publication
    And Actor B should converge within 30 seconds of Actor A canonical commit
    And the CRDT product flow from Actor A request through Actor B convergence should have a 300-second deadline
    And the guarded Playwright test should have a 360-second ceiling so bootstrap, assertions, and teardown cannot preempt that product deadline
    But no additional single-Actor or unguarded 7000-plus run should start

  Scenario: Maximum detail remains editable and meets its budget
    When Actor A creates the maximum-detail fixture
    Then the drawing should contain 27471 ordinary editable Vector elements and 295794 canonical points
    And the observed accepted-turn-to-settled time should be at most 300 seconds
    And no item, path, point, payload, frame, or composition ceiling should reject the drawing
    And the turn should create one intended Undo action

  Scenario: Production performance evidence remains detached from dev-only globals
    Given the production performance profile observes canonical and transaction evidence
    When the formal performance harness queries the measured App state
    Then it should receive detached canonical, history, Factory status, commit, and publication snapshots
    And dev-only "window.__Core__" should not satisfy production evidence
    And navigation, App readiness, collaboration readiness, server AI readiness, reference attachment, runtime evidence, and history baseline should remain named harness spans
    And after the pre-ready response inbox seed and lookup the harness should not open, poll, normalize, stringify, or hash document IndexedDB

  Scenario: Performance work preserves cancellation and failure semantics
    When the user cancels, a recoverable item fails, a fatal canonical error occurs, a frame is invalid, the transport closes, the worker tears down, or the app tears down
    Then recoverable siblings should still commit as one partial result
    And fatal failure should roll back the complete turn
    And an already-published immediate slice should use the inverse already retained by the existing Factory journal for compensation
    And no performance path should fabricate success, skip an owner, configure collaboration client persistence, or leave an extra history action
