# Canonical Workcell Editing v0

## Ownership

Each candidate is a Scene Tree container. Body components below it own actual
parent membership, names, and visibility. A registered body property contains
only role, mounting pose, joint definition, native colliders, original part
bindings, and display color. It
must not contain an editable id/parent/name/visibility duplicate. Candidate
properties identify the selected fixed robot root. Detached `Workcell` values
are query/import/analysis artifacts, never a second editable store.

All body components are containers because tools, fixtures, and links can have
rigid attachments. The spatial projection renders their complete original parts
or explicitly authored native shapes; component
registration deliberately emits no default 2D rectangle.

## Intent and Application

Original part bindings are authoritative geometry sources. Attaching one clears
the previous primitive geometry in the same transaction; Undo restores both.
Removing all bindings leaves an empty body, not a surrogate fallback. Ordinary
body updates cannot remove the last original source while retaining legacy
primitive shapes. Author replacement native parts explicitly after removal.
Whole-document replacement and historical Undo retain their explicit meanings.

The registered edit Feature exposes typed programmatic APIs for candidate
creation, model replacement, body create/update/remove, and history. It is a
one-shot, priority-100, exclusive intent owner. Calls enter the public Feature
System interaction queue, settle conflicting sessions, then run a finite common
API transaction. There is no App-owned command queue or history stack. Inputs
are detached before waiting. Repeating a create intent creates a new object;
repeating an unchanged update is a no-op. Failures roll back the whole action.

Field edits update the existing canonical property and metadata owners. Parent
changes use Scene Tree hierarchy APIs. Full replacement is reserved for an
explicit replace/import action, not ordinary field editing. Validation checks
the resulting complete mechanism before applying changes. Deleting a subtree
also validates the resulting root/membership contract.

Replacement reconciles retained identities instead of deleting and recreating
them. Temporarily detach changed surviving edges through the canonical hierarchy
API, remove obsolete subtrees, add genuinely new bodies in dependency order,
then apply the validated final relations and properties within the same outer
transaction. This handles parent/child reversal without an intermediate cycle.
Do not bypass Scene Tree tombstone ownership or reuse identities owned by
another candidate. Undo restores the original identities and property owners.

The App load entry checks the same complete property validators used at runtime,
including forbidden duplicate identity/hierarchy fields. Core field fallback may
not emit a field-level diagnostic, so this App check is mandatory; it does not
replace Core validation or invent repaired geometry.

Undo/Redo and document load use their public canonical replay/apply owners, not
a second user-intent interpretation. A load diagnostic affecting geometry must
be retained as an analysis blocker until corrected or explicitly acknowledged.
Property schema defaults are recovery values, never evidence that the user's
original experiment is preserved.

The same editing Feature exposes `captureDocument` and `applyDocument` for local
persistence. Capture awaits Core serialization inside the public interaction
queue, so a later edit cannot mix Scene Tree and Props revisions. Database I/O
occurs after capture, outside that queue and outside canonical transactions.
Apply receives detached data and a mandatory current-document guard; the guard
runs inside the queue immediately before Core load. Core owns load validation.
These are canonical capture/apply helpers, not complete project replacement.
Ordinary load does not clear history. Production Open must use the approved
complete App reset in [Local Storage](local-storage-v0.md#complete-runtime-reset).
Its empty-history regression belongs at that lifecycle boundary, not at ordinary
load. The caller retains both source and new recovery diagnostics; no App history
mask or independent Undo stack is permitted.

## Object Field Interaction

Object properties have no form-wide Apply or Reset action. Following Asyra
Design's field-completion convention, text, numeric and color inputs commit on
Enter or blur; selects, checkboxes and part add/remove controls dispatch their
change directly. Mount and original-part axis-angle fields need no second Set
action. Choosing an axis for an identity rotation is presentation-only until
the angle changes. Length/angle units are presentation settings, not model edits.

Each completed changed field uses the existing editing Feature and finite
common-API transaction. Unchanged values create no history. Escape discards
the active input text; empty/non-finite numeric text restores the canonical
value without dispatch. Domain-invalid edits are rejected by the existing
canonical validation, show an error and restore the current model value without
creating history. There is no pending whole-body form or alternate model store.

The selected Object editor survives ordinary canonical revisions, preserving
focus, unit choices, scroll and expanded sections. Fields project the current
canonical values after Undo/Redo; an external change to that field's value supersedes
unfinished input text. A different body, candidate or App lifetime creates a new
editor. Experiment drafts, import preview/acceptance and explicit project saving
retain their separate existing contracts.

Formal cases cover automatic field completion, sequential edits, focus and unit
retention, rotation replay, no-op/Escape, invalid dimensions/scales/joint limits,
and one Undo per completed field through the ordinary browser workbench.

## Viewport Navigation

Camera navigation is transient UI state. It never edits geometry, changes
analysis scope, stops playback, or creates Undo history. Normal left or middle
drag orbits; Shift + middle drag pans (Blender convention), with Shift + left
drag as the trackpad alternative. Only an unmodified left click selects.
The gesture is chosen at pointer-down and remains fixed until release. A second
pointer cannot replace it. Cancellation, capture loss, hidden documents, window
blur and runtime retirement release the gesture without selection. Wheel input
does not interrupt an active drag.

Camera state belongs to the viewport subtree. Navigation must not reread the
canonical workbench, retained runs or experiment definitions. Playback and
panel-only changes reuse the current read-only UI projection; canonical
notifications, candidate changes and runtime replacement refresh it. Errors
remain visible until the matching owner changes, rather than being retried by
every camera event. No projection is another editable model or Undo authority.

Formal work-count tests cover camera bursts, playback, panel changes and
canonical invalidation. A repeatable browser CPU profile covers the ordinary
full-geometry workcell; its timings are local evidence, not a portable FPS
guarantee.

Two-finger vertical scrolling, mouse wheel scrolling and Chromium's Ctrl-wheel
pinch gesture all zoom about the current camera target. Horizontal scrolling
does not pan. Shift-drag remains the pan gesture; orbit, Fit and Reset are
unchanged. There is no device-mode switch or navigation preference dependency;
previously stored input preferences cannot restore scroll-to-pan behavior.
Browser zoom outside the canvas and scrolling within panels remain native.
The canvas-host capture listener handles navigation before Framework bubble
listeners suppress browser scrolling; already-consumed ancestor events remain
ignored. Removal uses the same capture phase on replacement or unmount.

Wheel deltas use CSS pixels, with 16 px per line and viewport height per page.
Zero, horizontal-only, nonfinite, consumed, Alt/Meta-modified and retired
events do not move the camera. Burst deltas accumulate against the latest
accepted view before React's next render; no input is discarded or replayed in
a second animation loop. Scrolling and pinch change distance without panning
or page zoom.

Pan translates the eye and target together in the screen plane at the target's
depth. CSS-pixel distance and the perspective field of view set its scale;
device pixels and model units must not introduce another multiplier.

`Meta+1` / `Ctrl+1` and **Fit all** frame all currently visible parts, preserving
the view direction and leaving at least 32 CSS pixels on each viewport edge.
The actual canvas dimensions exclude panels. Grid/floor decorations and hidden
parts do not affect fitting. Current trajectory or historical replay poses and
pending part-placement previews use the same displayed spatial projection.
Display bounds are never collision geometry or analysis evidence. Empty scenes
and surfaces too small for the padding leave the camera unchanged. Fit adjusts
clipping planes when necessary and cancels a current navigation drag.
Subsequent wheel zoom remains incremental even when fitting required a camera
distance beyond the initial workcell scale; zooming out preserves far-plane
coverage instead of jumping back to a fixed distance limit.

Fit shortcuts use the same editable-control, current-runtime, consumed-event,
composition and repeat safeguards as History; Shift/Alt and combined Ctrl+Meta
are not Fit shortcuts. **Reset view** remains a separate default-camera action.
Formal gates prove screen-space pan, perspective containment at multiple aspect
ratios, complete source placement, control cancellation, shortcut/button parity,
and unchanged canonical fields, selection and history in the normal browser.
Input cases cover two-axis natural scrolling, rapid bursts, delta modes,
Ctrl-wheel pinch, remembered device choice and unavailable preference storage.

## History Shortcuts

Outside native input, textarea, select and contenteditable controls, `Meta+Z`
or `Ctrl+Z` undoes one committed action; adding Shift redoes it. The Object
editor's Enter/Escape completion releases field focus so the next shortcut can
operate on model history. While a field owns focus, native editing keeps its
own Undo/Redo behavior and must not also replay the model.

The workbench keyboard bridge and toolbar buttons call the same guarded History
Feature APIs. The bridge runs on document keydown after local controls and before
the window-level input adapter's browser-default suppression. It does not add
an input registry, transaction wrapper, parallel queue, history stack or canonical
mutation. It ignores consumed events, composition, Alt combinations and ambiguous
Ctrl+Meta combinations. A held key triggers only once; repeat events are consumed
without additional replay. Unrelated keys remain outside this bridge.

Registration exists only while the workbench is ready. Cleanup retires retained
callbacks, and the normal current-runtime guard rejects late old-document work.
Project replacement must restore one successor binding, never accumulate listeners.
Errors and completion status follow the same toolbar action path. Formal gates
cover both modifier families, native field Undo/Redo, event order, repeat and
composition guards, disabled/unmounted bindings and project replacement.

## M0 Proof Gate

Before expanding to M1 interaction, prove normal Core creation, one Undo per
intent, property/hierarchy restoration, rejected invalid writes, failed-action
rollback, and Core save/load roundtrip. This proof does not complete the UI,
persistence acknowledgements, or the public-release workflow.
