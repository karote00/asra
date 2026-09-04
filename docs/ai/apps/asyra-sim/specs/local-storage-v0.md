# Local Project Storage v0

The storage owner retains detached project snapshots in origin-local IndexedDB.
The editing owner alone applies a validated, explicitly accepted document through
Core. A database operation never opens or extends a canonical transaction.

## Save and Open

An explicit save captures the canonical document and unresolved load diagnostics.
The versioned envelope is JSON data, not executable code. Reject unsupported
format versions, malformed envelopes, nonfinite serialized values, and data above
the 64 MiB project limit. Native Core load validation remains responsible for
property recovery; retained recovery diagnostics must survive saving and reopening.

Project metadata and its document are written in one IndexedDB transaction.
Only its `complete` event acknowledges a save. Request success followed by an
abort, quota failure, blocked database, or unexpected close is an error. Keep the
previous saved project when a replacement transaction fails. Use an expected
revision when replacing a saved project: a conflicting save from another tab
must reject rather than silently overwrite it. New projects receive new IDs.

The presentation states are unsaved, saving, saved, and error; opening is a
separate busy operation. Editing during a save is allowed. Completion acknowledges
only the captured revision, so newer edits remain unsaved. Repeated overlapping
save/open operations reject. A failed operation retains the editable model and
supports retry. Persistence status and project identity are not a second editable
workcell or Undo stack.

Opening first reads and validates a detached envelope. Explicit acceptance then
passes through the editing Feature's normal interaction queue. Check that the
document has not changed since the open request before applying it; otherwise
reject and ask the user to retry. Confirm replacement when current edits are not
saved. Opening replaces the current runtime document and resets its canonical
history through Core's normal load path; it does not create an independent Undo
history. Closing the App aborts owned database work and ignores late responses.

Storage is optional for editing: unavailable IndexedDB must display an actionable
save/open error, not prevent local modeling or substitute volatile memory while
claiming a save. Do not automatically restore or overwrite a project at startup.
List at most the 100 most recently saved project summaries and disclose truncation.
Deleting projects and automatic migration are outside this initial slice.

## Privacy and Recovery

There is no upload, login, synchronization, or automatic code installation. Saved
projects belong to the browser origin/profile; clearing site data or changing the
origin can make them unavailable. Transaction completion is not a backup or a
guarantee against browser eviction or hardware loss. Portable backup/export is a
separate required R0 capability.

Browser semantics follow the
<a href="https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event" target="_blank" rel="noopener noreferrer">IndexedDB transaction-completion contract</a>.
Formal cases cover actual native commit/abort, cross-connection conflicts,
malformed or missing documents, unavailable storage, edit-during-save freshness,
load repair retention, disposal, and normal UI save/reopen. These tests do not
replace the later portable-bundle, assets, run-integrity, or backup gates.
