# Local Project Storage v0

The storage owner retains detached project snapshots in origin-local IndexedDB.
The App lifecycle owner replaces a project runtime; the editing owner applies
canonical data through Core. A database operation never opens or extends a
canonical transaction.

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
passes through the App replacement boundary. Check that the document has not
changed since the open request before accepting replacement; otherwise
reject and ask the user to retry. Confirm replacement when current edits are not
saved. Opening uses the complete runtime reset below, not load plus an isolated
history clear. The user approved this lifecycle extension; production Open is
not complete until its integration gates pass. Closing the App aborts owned
database work and ignores late responses.

## Complete Runtime Reset

Replacing project A with B ends A's entire active runtime. The App owns user
acceptance, target envelope validation, storage, Workers, camera/playback/UI state,
and detached recovery data. Core coordinates Framework owners: Feature work,
input, observers, renderer resources, canonical state, selection/system/UI state,
transaction history, and composition registrations. The App must not enumerate
or clear private Framework state. Ordinary canonical load remains validation and
apply, not reset, and ordinary destroy retains its compatibility contract.

The handoff stops admission first. Cancel owned tasks and sessions, reject work
still waiting in the interaction queue, and await already-started work before
clearing state or starting B. Session termination discards its provisional
transaction, regardless of ordinary user-interruption cancel policy. A timeout
is not proof of termination: even a handler whose timed wait already rejected
must settle before reset is quiescent. JavaScript cannot forcibly stop such a
Promise. An uncooperative handler or cleanup error leaves the runtime closed to
new work; it must not be reported as a successful reset or automatically resumed.

Feature quiescence owns only interaction/task/session work and its transport
bindings. It does not clear canonical state, history, DOM/GPU resources, storage,
or App workers. Its closed state persists until the Core lifecycle explicitly
begins a successor after all owner cleanup. A retained old SessionManager or
queued callback cannot become work in that successor. Repeated disposal joins
the same operation. Normal cancel/unregister semantics remain unchanged outside
this explicit lifecycle.

After quiescence, Input reset detaches every owned browser listener, invalidates
old browser callbacks and clears timers, transient state and input mappings.
It attempts every listener removal before reporting failure, without clearing
another Input instance. Normal reset/dispose retain their attachment semantics.

Render instance reset requires initialization and frame evaluation to be idle.
It invalidates old frame/engine/pointer callbacks, stops scheduling, attempts all
teardown, interaction, resource-binding and engine cleanup, and retires the old
viewport, layers, frame subscribers and provider selection. It reports cleanup
failure and cannot activate a successor. Ordinary dispose retains its existing
retry semantics. Shared projection/interaction/strategy registrations remain
separate owners and must also be retired by the complete lifecycle; resetting
one independently constructed Render does not clear those shared registrations.

After quiescence, Core requests Factory runtime reset only when its transaction,
replay and delivery settlement are idle. Busy reset rejects before changing any
history or registration. Factory clears its journal, Undo/Redo, staged delivery,
pending publication evidence, custom validators/inverters/replay handlers,
owned shared-channel observers and subscriptions. Its default transaction-owner
bridge remains connected for the successor; another Factory instance is
unaffected. This is Factory's part of complete reset, not a document-load helper.
Attempt every owned channel cleanup even when one disposer fails, invalidate late
observer callbacks, and report failure so Core cannot activate a successor.
Channel objects and arbitrary direct subscriptions remain their creator's
responsibility; Factory releases only resources acquired through its boundary.

Scene Tree reset clears active and replay-retained elements, hierarchy, pending
changes and relation indexes, invalidates previously issued load/restore/mutation
artifacts, and releases every retained computed lifecycle hook. It emits no
canonical mutation or replay. Component definitions and Props remain separate
owners; another Scene Tree instance is unaffected. Attempt all computed cleanup
hooks and report failure after retiring state, so Core cannot treat partial
cleanup as a successful App reset.

Props Manager reset releases live/deleted property instances, changes, batches,
relationship indexes and all old prepared artifacts. Active canonical batch
application rejects reset before mutation. Attempt every component cleanup hook,
then retire state and report the first failure. Schema/constructor definitions,
Scene Tree and other Props Manager instances are not disposed by this step.
Owner cleanup hooks release resources synchronously; they must not create new
canonical work during termination.

Selection reset removes the old registered channels and attempts every channel
cleanup without publishing selection changes or creating history. Fresh
composition can register the same channel names with new instances. Cleanup
failure is reported after retiring registrations, and another manager remains
untouched. Normal clear/unregister behavior is unchanged.

System Context reset removes all managed-property registrations, invalidates old
validated load artifacts and completes every old observable. Another instance
with independent state is untouched. Cleanup failure is reported after all
completion attempts and blocks reconstruction. Normal load/set/unregister
validation semantics are unchanged.

UI Context reset removes derived registrations and filters, unsubscribes owned
source bindings and completes managed UI observables. It does not complete
caller-owned source observables or mutate canonical data. Every cleanup is
attempted before reporting failure; old sources cannot update new subjects.
Legacy clear/unregister behavior is unchanged.

After successful termination, composition creates fresh runtime objects with
the same trusted modules; it does not unlock and reuse retired objects. B starts
with its own document, empty Undo/Redo, reset camera/selection/playback, and only
its own subscriptions and jobs. Invalid target input must reject before A is
retired. Failure after retirement exposes an error and recoverable detached A
data; it must not pretend that A remains a live, editable runtime.

Formal cases for Feature quiescence: empty and repeated disposal; reject queued
and new operations; await a running command; abort and await tasks; force active
session rollback; await timed-out handlers; detach input and late renderer-event
subscriptions; reject premature restart and old-manager use after restart.
Cleanup failure remains closed. The full App gate additionally requires A/B/A
open, no A history or late writes in B, invalid-target preservation, failure
recovery, one canvas/input surface, and resource cleanup in the real browser.

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
