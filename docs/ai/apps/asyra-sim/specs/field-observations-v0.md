# Run-Linked Field Observations v0

Field observations record what a user reports after an experiment. They do not
validate the method, change its inputs/evidence/verdict, align sensor data, infer
yield, or calibrate a model automatically. An observation is not a certification.

## Records and Ownership

Only an explicitly retained run can receive observations. Each observation
belongs to its canonical run reference, not the immutable `RunRecord` or its
snapshot. The existing editing Feature and common API create, update or remove
one observation in one Core transaction. Undo/Redo restores the complete metadata
change; attachment reading and hashing never hold that transaction open.

The run-reference property may contain an optional `observations` array. Absence
preserves legacy serialization. An observation contains version 1, a unique ID,
positive revision, title, text, created/updated UTC timestamps, and attachment
references. Creation owns its ID/timestamps. Updates preserve ID/creation time,
increment revision only for material content changes, and reject stale expected
revisions. A removal requires an explicit user action and remains undoable.
Removing a run reference or candidate removes its observations from the current
document, not from that runtime's replay-retained attachment storage. Candidate
duplication does not copy historical run references or their field observations.

Limits: title 1–120 characters, observation text 1–8,000 characters, at most
20 observations per run and 200 per project, and at most four attachments per
observation. Reject invalid shapes, duplicate observation IDs, inconsistent
timestamps, stale writes, and unsupported versions. Load recovery of malformed
canonical properties remains visible and never fabricates an observation.

## Opaque Attachments

Initial accepted filename extensions are `.txt`, `.csv`, `.json`, `.png`, `.jpg`,
`.jpeg`, and `.pdf`, case-insensitively. Files are opaque supporting evidence,
not trusted content. The App does not run, parse, align, render, scan for malware,
or claim to validate their internal formats. A filename or declared media type
does not prove a file's format or safety. Downloads use `application/octet-stream`
and do not automatically open the file under the App origin.

Reject empty files and files above 2 MiB before reading; a draft can select at
most four files. A project/runtime attachment archive allows 64 distinct sources
and 16 MiB of original bytes. These limits supplement, not replace, the 64 MiB
portable-project limit or browser quota. They are not a total-memory guarantee.
The archive retains accepted sources needed for Undo until the runtime closes.

Canonical references contain content identity, filename, declared media type and
byte length, not raw file bytes. Filenames are bounded basenames without control
characters or path separators. Identical contents selected twice in one note
are rejected; different notes may reference the same content. Filenames alone
never identify content.

The storage owner prepares detached inputs under a Feature-owned cancellation
signal and returns an archive-scoped receipt with inert attachment metadata.
Preview/discard/cancel writes no canonical data. Late or retired receipts cannot
be retained. An archive allows one active preparation and one completed receipt;
overlapping preparations reject, and a new preparation revokes the old receipt.
WebCrypto digest work is not interruptible, but cancellation prevents its result
from being accepted. Acceptance retains immutable source bytes before the separate
editing transaction; a failed metadata write must remain retryable and cannot
claim a save. Accepted but unreferenced sources may remain until runtime disposal,
within the same archive limits; they are not included in a portable capture.

The attachment archive stores versioned canonical Base64, original byte length,
and SHA-256 content identity. It is independent of the GLB/renderer archive.
Neither Core properties nor Undo entries contain attachment bytes. Decoding,
hashing, count and aggregate-byte checks precede use. No new third-party parser,
binary, Framework API or general-purpose asset framework is required.

## Persistence and History

A portable project may contain an optional `observationSources` collection.
Capture includes sources referenced by its current canonical observations.
Every reference must resolve to matching bytes and length; stored source digests
must verify before project A is paused or retired. Invalid/missing sources reject
B and leave A editable. Startup also validates its own supplied sources; a flag
inside imported JSON is not proof of verification.

The App owns an attachment archive per runtime and releases prepared receipts
and bytes during complete teardown. Reopening starts with empty Undo history,
the target's observations, and only the target's sources. Stale file reads or
callbacks cannot attach data to another run or successor runtime. Saving still
requires IndexedDB transaction acknowledgement; accepting a note is not a backup.

Run reports continue to represent the immutable experiment. The UI separately
exports an observation bundle with run/snapshot identity, current observation
metadata and referenced source bytes. It never merges later feedback into old
evidence or silently alters a previously exported report. Portable project
export/save includes both categories under their separate ownership.

## Ordinary Workflow and Completion

The run library shows a Field observations section for its selected run, with
title/text, bounded attachment selection and metadata review. Users explicitly
add or update a note, remove it with confirmation, download an attachment, or
export the separate observation bundle. Transient file selection is cleared or
discarded when changing the run, closing the library, replacing the project or
starting a new selection. A missing retained reference blocks adding a note,
without making an existing immutable result unreadable.

Required permanent cases: text-only and attached notes; invalid/empty/oversized
files and metadata; duplicate content; independent immutable byte ownership;
digest mismatch; archive/global count limits; cancelled/late preparation;
cross-archive or retired receipts; failed/stale edits without partial canonical
state; material revisions and Undo/Redo; unchanged raw results; source capture
after removal/Undo; corrupt replacement leaves A editable; portable reopen;
download/bundle parity; inert hostile text and no external requests.

Completion requires owner tests, ordinary browser editing/retention/export/open
and inspected live screenshots, App type/lint/build, and Inspector gates. It does
not satisfy independent pilot acceptance or numerical validation release gates.
