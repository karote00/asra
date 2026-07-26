Feature: Conversational AI mock drawing
  As an Asyra Design user without a live model API key
  I want to exercise a realistic AI conversation and drawing flow
  So that planning, confirmation, mutation, partial failure, follow-up editing, and history behavior are visible and testable

  Background:
    Given Asyra Design is opened with the exact "ai=mock" mode
    And the UI exposes mock-mode status without a provider or speaker name
    And mock planning uses deterministic fixtures and a finite abortable delay
    And Feature System owns one active AI turn

  Scenario: AI-disabled startup keeps the mock experience absent
    Given the app URL has no exact "ai=mock" mode
    When Asyra Design starts
    Then no AI toolbar control or conversation panel should be present
    And no AI runtime, provider, Feature, observer, mock timer, or network request should be created

  Scenario: A cat-face request shows operational progress and creates ordinary elements
    When the user adds a PNG tabby reference image to the Agent prompt
    And the user submits "請依照這張圖繪製"
    Then the Agent should offer "Balanced detail" with 7111 editable elements
    And the Agent should offer "Maximum detail" with 27471 editable elements and a high resource-load warning
    And the clarification turn should not mutate the canvas or create an Undo action
    When the user chooses "Balanced detail"
    Then the conversation should show bounded operational status while mock planning waits
    And it should not show raw action arguments, secrets, provider bodies, or private chain-of-thought
    And the mock provider should return the same schema-valid 7111-item high-detail cat-face composition plan used by the explicitly detailed phrase
    And the app should create ordinary editable Asyra elements through common APIs
    And the created elements should be grouped with app-generated canonical ids
    And grouped vector points should keep their original workspace geometry without a doubled group offset
    And the turn should create one intended undo commit
    And the Message Bar should offer Undo for the current AI action

  Scenario: An exact attached-reference request draws only the cat on a same-size white background
    When the user adds the local PNG tabby reference image to the Agent prompt
    And the user submits "Draw only the cat from the reference image. Exclude the original background and place the cat on a pure white background canvas with exactly the same width and height as the uploaded photo."
    Then the mock provider should directly return the balanced cat-only composition plan
    And the original photographic background should be absent
    And one ordinary editable background Vector should be pure white
    And that background Vector should have the uploaded photo's exact intrinsic pixel width and height
    And the portrait should expose canonical left-pupil and right-pupil semantic targets

  Scenario: The Agent prompt accepts local reference images
    Given the Agent panel is open and no AI turn is active
    When the user adds PNG, JPEG, or WebP images through the Add image control or panel drag-and-drop
    Then the draft should show accessible removable image thumbnails
    And submitting trimmed text with any accepted images should create one immutable user-turn intent
    And submitted image thumbnails should remain visible in that user turn
    And no image should be uploaded, written to canonical document state, persisted, or collaboration-shared
    But when the user selects an unsupported file or an image read fails
    Then the panel should show a concise draft error
    And no Feature or provider request should be created
    And a draft without trimmed text should remain inert

  Scenario: An arbitrary attached raster is vectorized through the App-owned VTracer tool
    Given the stable App-owned provider prompt advertises registered actions and the installed VTracer capability
    When the user attaches an arbitrary non-cat PNG, JPEG, or WebP image
    And the user submits "Vectorize this image"
    Then the mock provider should invoke the same-origin App VTracer tool exactly once
    And an accepted WebP should be normalized to detached in-memory PNG bytes before the tool call
    And the attachment should never leave the local App origin or enter an external model request
    And one or more valid traced items should become ordinary editable Vectors with deterministic generic roles inside one Group
    And the provider should return one existing insert_vector_composition action
    And the turn should create one intended undo commit
    And reloading should restore the identical committed canonical vector composition
    And the tool should not infer subject-only segmentation, background replacement, OCR, a cat fixture, or bitmap insertion
    But when the attachment, VTracer result, or validated SVG is invalid or empty
    Then the turn should fail before mutation without a fixture fallback

  Scenario: The App prompt never invents an unavailable image-preparation tool
    Given the App-owned prompt requires analysis, registered-tool selection, vector validation, resource estimation, confirmation, and registered action execution
    And the Mock tool catalog registers only whole-image VTracer
    When a generic attached-image request requires segmentation, background removal, crop, or reimage
    Then the provider should report the missing capability before mutation
    And it should produce no derived raster, VTracer call, action candidate, or Undo action
    And it should never pretend that an unregistered tool or deterministic fixture performed the preparation
    But when a future live provider receives an App-registered image-preparation tool
    Then its detached derived raster may be passed to VTracer
    And that raster should never enter canonical state, conversation persistence, or collaboration

  Scenario: Every accepted terminal turn reports its elapsed time
    Given the conversation controller uses an instance-local monotonic clock
    When an accepted turn reaches success, partial, no-change, cancelled, unavailable, or failed settlement
    Then its immutable settled record should contain the non-negative elapsed milliseconds from accepted submission through settlement
    And the Agent response should show one concise elapsed-time summary
    And no rejected, empty, or overlapping submission should create a timing record

  Scenario: A high-detail tabby portrait stays bounded and editable
    Given the user submitted a tabby reference image and received drawing-detail choices
    When the user chooses "Maximum detail"
    Then the mock provider should return one schema-valid 27471-item composition plan
    And every item should be an ordinary Vector with at least one finite non-degenerate subpath and 295794 canonical points across the composition
    And no artificial item, subpath, per-path point, or composition point-count ceiling should reject the finite plan
    And the App common API and Core should use ordered memory-bounded Scene Tree batch-add requests inside the same outer transaction
    And internal chunk size should limit only simultaneous transient topology representations, never the accepted total element or point count
    And the app should create one canonical Group before streaming the ordered children directly into it
    And the app should retain workspace topology points while supplying group-local computed bounds
    And the app should not perform a post-hoc 27471-child move or geometry rewrite
    And Scene Tree should apply each validated next Group membership without generic Setter cloning of growing children snapshots
    And the ordered ADD_ELEMENT records should remain the only batch history, replay, Render, persistence, and collaboration evidence
    And the turn should create one intended undo commit
    And the creation turn should settle within the explicit 900-second live E2E budget
    And the synchronized live screenshot should show a high-detail frontal tabby portrait beside the Agent panel

  Scenario: A high-detail committed drawing survives browser reload
    Given the balanced cat-only canonical document exceeds localStorage quota
    When Core persists the committed drawing through the App-selected document provider
    Then the provider should acknowledge the complete snapshot in IndexedDB
    And reloading the same ordinary or collaboration document identity should restore identical canonical ids, topology, hierarchy, styles, and bounds
    And an existing valid "FILE" or "FILE:<encoded fileId>" localStorage snapshot should migrate only when IndexedDB has no document
    And the legacy value should be removed only after the IndexedDB write succeeds
    And attachment, conversation, progress, and semantic target-hint data should not be persisted
    And IndexedDB should be described as browser-local reference-demo durability only
    And a production derivation should replace the App-selected provider with a server-backed database integration
    But when IndexedDB persistence fails
    Then Core should report persistence-failed without reversing the committed runtime state

  Scenario: Text-only cat-face aliases retain the balanced fixture
    When the user submits "畫一個精緻的貓臉"
    And the text-only alias "畫一個貓臉" remains supported
    Then the mock provider should return one schema-valid 7111-item balanced composition plan
    And every item should be an ordinary Vector with at least 115000 canonical points across the composition

  Scenario: Recoverable damage uses the same high-detail fixture
    When the user submits "模擬部分成功"
    Then the mock provider should return 7111 valid high-detail items and one duplicate-role item
    And the app should apply 7111 ordinary editable elements and skip only the duplicate
    And the partial turn should create one intended undo commit

  Scenario: The Agent panel has shared design-tool entry points
    Given the app is running with exact ai=mock mode
    When the user toggles the Agent panel from the toolbar, platform shortcut, or canvas Context Menu
    Then every entry should route to the same app-local non-modal right panel
    And opening should focus the Agent prompt
    And closing should restore focus to a safe connected invoker
    And the panel header, conversation bubbles, and Message Bar should omit "You" and "Mock AI" speaker or provider labels
    And AI-disabled modes should expose none of those entry points

  Scenario: A follow-up enlarges existing eyes without regeneration
    Given the current conversation created a cat face
    When the user submits "把眼睛放大一點"
    Then the app should revalidate the existing left-eye and right-eye ids
    And oval eyes should receive bounded geometry updates
    And Vector eyes should scale every existing canonical topology point around each eye center
    And the eye element, point, segment, and network ids should remain unchanged
    And the face, ears, nose, and whiskers should not be deleted or recreated
    And the follow-up should create one new intended undo commit

  Scenario: A follow-up recolors existing whiskers
    Given the current conversation created a cat face
    When the user submits "把鬍鬚改成藍色"
    Then the app should revalidate the existing whisker ids
    And only those existing whisker elements should receive the bounded style update
    And the follow-up should create one new intended undo commit

  Scenario: A follow-up recolors existing pupils
    Given the current conversation created a cat face with pupil target ids
    When the user submits "make the pupils red"
    Then the provider should reference only the current revalidated pupil ids
    And only those existing pupil elements should receive the bounded primary-fill update
    And pupil element, point, segment, network, and subpath ids should remain unchanged
    And it should not request replacement cat-face output
    And the follow-up should create one new intended undo commit

  Scenario: Two collaboration actors record the exact attached-reference flow
    Given two independent browser actors opened the same Asyra Design document in exact "ai=mock&aiDelivery=progressive" mode
    And one side-by-side 2560-by-720 recorder shows both 1280-by-720 live app views
    And fresh E2E-owned App and collaboration servers run on dedicated ports
    When Actor A opens the Agent panel
    And Actor A drag-drops the local PNG tabby reference image
    And both actors frame the complete 1672 by 941 output bounds with safe padding before drawing
    And Actor A submits "Draw only the cat from the reference image. Exclude the original background and place the cat on a pure white background canvas with exactly the same width and height as the uploaded photo."
    Then Actor B should observe more than one ordered canonical creation batch before Actor A settles
    And both actors should converge on the same canonical grouped portrait ids and topology
    And the local reference WebSocket transport should accept the finite transaction publication without an artificial message-size ceiling
    And one pure-white ordinary editable background Vector should be exactly 1672 by 941
    And Actor A should gain exactly one undo action while Actor B gains no local undo action
    When Actor A submits "make the whiskers blue"
    Then both actors should converge with the same existing ids and blue whisker strokes
    And Actor A should gain exactly one additional undo action
    When Actor A submits "make the pupils red"
    Then both actors should converge with the same existing ids, blue whiskers, and exactly two red pupil fills
    And Actor A should gain exactly one additional undo action
    And each converged drawing state should retain one screenshot from each live app view
    And the same live views should be retained in one continuous side-by-side WebM

  Scenario: The App selects atomic or progressive collaboration delivery without splitting history
    Given exact "ai=mock" mode is active with Collaboration connected
    When "aiDelivery" is missing, duplicated, unknown, or exactly "atomic"
    Then one mutating Agent turn should use ordinary transaction-end delivery
    And the peer should receive one publication only after the turn commits
    But when "aiDelivery" is exactly "progressive"
    Then the same canonical writes should use ordinary immediate delivery
    And creation should yield after each point-aware child batch
    And each progressive child batch should target at most 2048 canonical topology points and retain the existing 256-item transient maximum
    And one intact element over the soft point target should remain accepted in one batch
    And the point target should never cap total items, paths, or points
    And multi-target updates should yield after each applied canonical update
    And the peer should observe ordered progress before the Agent turn settles
    And one mutating turn should still create exactly one local undo action
    When the user invokes Undo and Redo from the current AI Message Bar
    Then Factory canonical replay should retain the source delivery mode and batch boundaries
    And each direction should remain one local history action
    And a fatal failure after an immediate publication should use linked Factory compensation

  Scenario: Recoverable item damage produces one partial commit
    Given the mock fixture contains one recoverable missing or duplicate item
    When the app action performs semantic preflight
    Then the damaged item should be skipped before a rollback-only canonical failure
    And successful sibling mutations should commit
    And the assistant should report completed and skipped item counts
    And the successful mutations should remain one intended undo commit

  Scenario: Fatal canonical failure rolls back the turn
    Given the mock fixture reaches an executor failure that prevents canonical consistency
    When the app transaction runner rejects
    Then every rollbackable mutation from that turn should be reversed
    And no accepted partial prefix or enabled Undo control should remain

  Scenario: Confirmation waits visibly for the app decision
    Given the user asks to delete the current cat-face composition
    And app permission returns "confirm"
    When the runtime pauses at the confirmation handler
    Then the panel should show a concise destructive impact and undoability summary
    And it should not require a verbose action list or visual ghost preview
    When the user accepts
    Then one removal transaction should execute
    But when the user rejects
    Then no transaction or canonical mutation should occur

  Scenario: Cancellation removes delayed mock work
    Given mock planning is waiting
    When the user cancels the active turn
    Then the Feature-owned signal should abort the provider delay
    And every request-owned timer and observer reference should be released
    And no later candidate, action, or canonical mutation should be applied

  Scenario: Unsupported and provider-failure fixtures do not mutate
    When the mock provider selects an unsupported-request or provider-failure fixture
    Then the conversation should show a stable no-mutation result
    And no transaction or enabled Undo control should be created

  Scenario: Message Bar Undo and Redo follow the current history top
    Given one mutating AI turn committed
    When the user chooses Undo from the current Message Bar
    Then Factory should revert that entire AI turn through ordinary history replay
    And the Message Bar should offer Redo
    When the user chooses Redo
    Then Factory should reapply that entire AI turn
    But if a later non-AI action commits first
    Then the older AI Message Bar should not undo that unrelated newer action

  Scenario: Separate app roots keep mock conversations isolated
    Given two mounted Asyra Design app roots in mock mode
    When each root submits a different mock request
    Then provider state, delays, progress, confirmation, target hints, turns, and Message Bars should not cross roots
