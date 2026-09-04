# Canonical Workcell Editing v0

## Ownership

Each candidate is a Scene Tree container. Body components below it own actual
parent membership, names, and visibility. A registered body property contains
only role, mounting pose, joint definition, colliders, and display color. It
must not contain an editable id/parent/name/visibility duplicate. Candidate
properties identify the selected fixed robot root. Detached `Workcell` values
are query/import/analysis artifacts, never a second editable store.

All body components are containers because tools, fixtures, and links can have
rigid attachments. The spatial projection renders their colliders; component
registration deliberately emits no default 2D rectangle.

## Intent and Application

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

## M0 Proof Gate

Before expanding to M1 interaction, prove normal Core creation, one Undo per
intent, property/hierarchy restoration, rejected invalid writes, failed-action
rollback, and Core save/load roundtrip. This proof does not complete the UI,
persistence acknowledgements, or the public-release workflow.
