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
save/open operations reject. Save failures and pre-retirement open failures
retain the editable model and support retry. Post-retirement failure instead
retains detached recovery with no editable runtime. Persistence status and
project identity are not a second editable workcell or Undo stack.

The user selects a saved summary and explicitly accepts replacement. Opening
reads and validates a detached envelope before the App replacement boundary.
Check that the document has not changed since the open request before accepting
replacement; otherwise
reject and ask the user to retry. Confirm replacement when current edits are not
saved. Opening uses the complete runtime reset below, not load plus an isolated
history clear. The user approved this lifecycle extension; normal Open requires
the integration gates below. Closing the App aborts owned database work and
ignores late responses.

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

After successful Render instance retirement, the shared Render owner clears
projection/selection mirrors and interaction target/handler registrations.
Projection reset rejects unreleased visual ownership or an active flush.
Old queued microtasks and retained pending-layer callbacks are invalidated.
Only after all runtime owners finish does Core explicitly begin shared projection
wiring for the successor. Strategy definitions remain composition-owned, and
canonical data is never changed by this derived-state lifecycle.

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

After canonical state retires, Core terminates its registration graph. This
explicit terminal operation works while composition is locked, releases remaining
owned resources in reverse registration order without structural relation
rewrites, and clears graph metadata. It attempts every pending resource, skips
already-completed cleanup and reports structured failures. A retired graph never
reopens; repeated termination returns the same failure or completed result.
Ordinary unregister remains composition-locked and retryable. Resource callbacks
release their definitions/resources; they do not create new canonical state.

After successful termination, composition creates fresh runtime objects with
the same trusted modules; it does not unlock and reuse retired objects. B starts
with its own document, empty Undo/Redo, reset camera/selection/playback, and only
its own subscriptions and jobs. Invalid target input must reject before A is
retired. Failure after retirement exposes an error and recoverable detached A
data; it must not pretend that A remains a live, editable runtime.

### Core Handoff Boundary

Before accepting retirement, the App calls `Core.preflightLoad(document)` using
the current trusted composition. This runs the same synchronous migration,
normalization, property, hierarchy and relation checks as ordinary load, but
applies no package artifact, changes no history/version, and emits no load or
diagnostic-hook notification. It returns detached readonly diagnostics; these
are not a prepared artifact transferable to another Core. Ordinary load still
validates and applies through the canonical owners. Trusted load hooks must be
pure deterministic migrations; preflight is not a sandbox for their code. The
successor must install the same trusted modules and validate again during load.
Malformed envelopes remain the App format owner's responsibility, and property
recovery remains the existing schema/default contract.

`Core.resetRuntime(): Promise<Core>` coordinates the ordered owner operations
above and returns a fresh, unstarted Core over the exclusive Framework runtime.
It is not support for concurrent Core runtimes. App admission must already be
stopped, and the call must be outside the old Feature interaction queue. An
in-progress `start` rejects reset before retirement. Repeated accepted reset calls
join one operation and preserve its success or failure; the retired Core never
reopens. Resetting the default Core updates its live default export only after
successful cleanup. Consumers must capture the Core for their runtime, not route
old callbacks through that live export.

Core closes Feature admission, terminates collaboration transport and awaits
actual in-flight Core operations before canonical retirement. Settling handlers
can still use Core during quiescence; after quiescence, old facade methods and
retained Feature APIs reject. Old cleanup handles cannot remove successor
registrations. This is a lifecycle boundary, not a sandbox for arbitrary code
that retained deprecated raw package dependencies.

Core retires its data-channel observer definitions/bindings, owned event
subscriptions and event registrations. Observer reset invalidates callbacks,
attempts every acquired cleanup (including partial initialization), and does not
destroy caller-owned channel objects. It rejects during observer acquisition.
After all canonical and graph owners retire, Core awaits composition cleanup
registered through `registerRuntimeCleanup`. These callbacks may inspect retired
registration state and release resources, but cannot create canonical work or
reopen composition. Core then begins Feature/shared Render wiring and constructs
the successor. Any failure records the owner phase and blocks a successor; no
timeout, fallback renderer, implicit reload, or App-owned history reset is used.

Formal Core cases cover ordered cleanup and fresh composition, repeated reset,
startup rejection, active-work settlement, partial observer initialization,
cleanup failure, stale facade/Feature/event/cleanup handles, preserved ordinary
load/destroy semantics, and unchanged independent dependencies.

Preset retains successful installation cleanup through Core's neutral lifecycle
registration. On complete termination, it attempts all retained cleanup in
reverse order and reports pending/completed keys and the first cleanup cause.
It does not reopen the old composition or expose a disposer on its frozen apply
result. Failed-apply rollback/retry remains separate and unchanged. A successor
Core may apply the same profile/defaults once; the old Core remains retired.
Older composition adapters without lifecycle registration keep their existing
apply behavior but do not claim complete runtime replacement support.

### App Composition Lifetime

Each Sim bootstrap captures one composition-open Core and owns its surface
observer, App subscriptions and spatial layer. It can start from the synthetic
example or an already validated saved snapshot. Saved startup loads only that
snapshot and its retained recovery diagnostics; it does not create an extra
example or an Undo entry. Storage and confirmation remain outside bootstrap.

The runtime can pause new App editing calls while retaining the old view and
queued capture capability. It exposes Core preflight and a consistent queued
snapshot, not another editable document. A pause can resume only before
disposal; old release/resume handles cannot enable a retired runtime. Complete
disposal closes App admission, attempts every owned observer/subscription/layer
cleanup, awaits Core reset and preserves its shared terminal result. Failure is
reported rather than activating another App runtime. Startup failure follows the
same cleanup boundary. A second bootstrap must not take ownership of an already
started Core. Old callbacks retain the old Core and cannot operate on the new
default export.

### App Replacement Coordinator

The App runtime controller owns exactly one bootstrap lifetime. It accepts an
already decoded target and a storage-session currentness guard; it does not own
database metadata, canonical writes, or a second command queue. Replacement is
exclusive: preflight B, pause new A editing, capture A through the existing
Feature queue, and recheck acceptance/currentness before retirement. The target
and recovery snapshot are detached from caller-owned objects.

Before retirement, the captured recovery must pass the same native serialization
and 64 MiB limit used by recovery download. An unexportable capture rejects and
resumes A; recovery validation does not perform database I/O or acknowledge a save.

Before disposal begins, publish no active runtime so the UI cannot present A as
editable. Await complete disposal before bootstrapping B. Only successful startup
publishes B and advances the UI lifetime generation. A rejected target, capture,
or stale acceptance before retirement resumes A unchanged. Failure after
retirement publishes no editable runtime and exposes a downloadable detached A
snapshot; it never automatically restores A or starts another runtime. Recovery
data is cleared only after successful replacement or explicit controller close.

Closing the controller closes admission immediately, waits for pending startup
or replacement, disposes any acquired runtime, and preserves the same terminal
promise. It cannot publish a late successor. Formal cases cover ordering,
concurrent rejection, invalid/stale target preservation, capture/cleanup/startup
failure, recovery isolation, and close during asynchronous boundaries.

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

The workbench presents explicit Save, Save copy, and Open controls in a local
project dialog. It displays persistence acknowledgement independently from model
editing, lists saved names/times, discloses the 100-item limit, and confirms
replacement (including an unsaved-change warning). No project opens automatically.
Model editing remains available during save or storage unavailability. Editing
controls stop accepting input while the runtime controller is replacing a
document. A new lifetime resets candidate selection, object selection, camera,
grid, and inspector drafts; late old-runtime actions cannot update these fields.

The UI owns one storage session outside individual runtime lifetimes, detaches old
model subscriptions before retirement, and marks edits only for the current
runtime. Browser close warns when edits are unsaved or an operation is running.
Post-retirement failure displays the lifecycle error and offers the detached A
snapshot as an explicit native JSON recovery download. It does not claim a save,
hide failure behind a synthetic workcell, or enable further edits. Reloading
remains a user decision. IndexedDB remains origin-local and browser-managed, not
a guaranteed backup.

Retained load-review diagnostics remain visible in the workbench and survive
saving and reopening. Display at most 20 expanded entries with the full count;
all diagnostics remain in the snapshot. This slice does not silently acknowledge
or clear them, and they remain blockers for later formal analysis.

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
