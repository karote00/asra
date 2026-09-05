# Asyra Sim

A local experiment workbench built on Asyra. The initial domain is a single
robot workcell: geometric interference and clearance, not equipment control or
industrial safety certification.

**Development checkpoint, not R0.** The current workbench can edit a synthetic
six-axis model and geometric proxies, navigate in 3D, Undo/Redo, and explicitly
save and reopen local projects. The experiment panel accepts explicitly mapped
trajectories, runs preflight and isolated continuous-time analysis, and replays
frozen evidence. Runs can be explicitly retained, compared, exported, and reopened
with portable projects. Independent A/B/C workcells can be duplicated and compared.
Restricted GLB references can be previewed, attached, edited, and preserved with
historical runs. Run-linked field observations and opaque attachments preserve
real-world feedback separately from immutable evidence. Independent distribution
and validation remain under development. Do not use this
checkpoint to approve production operations.

## Local development

Use the repository's declared Node.js 24 and Yarn 4.3.1 environment. Set
`APP_URL` in this App's `.env` from `.env.example`, or explicitly export it.
The Vite server and browser tests use the same local origin; there is no
parallel test URL.

From the repository root:

```sh
yarn workspace @asyra/asyra-sim dev
yarn workspace @asyra/asyra-sim test:local
yarn workspace @asyra/asyra-sim typecheck
yarn workspace @asyra/asyra-sim lint
yarn turbo run react:build --filter=@asyra/asyra-sim
yarn workspace @asyra/asyra-sim test:e2e
```

Build the workspace dependencies before starting a clean checkout. Browser
tests use an existing Google Chrome installation and one worker, with browser
temporary files inside this App's `.artifacts/`. They do not install browsers.
The current visual suite uses SwiftShader for reproducible WebGL evidence;
this is not a hardware-GPU performance certification. Screenshots and traces
are written to `test-results/` and are not committed. The JSON report at
`.artifacts/browser-report.json` retains successful numerical, Worker, and
visual-state metadata. Browser proofs complement rather than replace complete
product E2E. See the [initial runtime profile](../../docs/ai/apps/asyra-sim/specs/runtime-profile-v0.md)
for the unverified ordinary-hardware target and delivery limits.

## Local projects

Use **Projects** to name and save a project, save a separate copy, or explicitly
open a stored project. Browser-local IndexedDB is not a backup; clearing site
data removes saves. Save acknowledgement is separate from editing, and a failed
save never claims persistence. Opening starts a fresh App/Core lifetime with
empty Undo/Redo and reset selection/camera; it does not clear history inside
ordinary `Core.load()`. Invalid targets leave the current document intact.
Failure after retirement stops editing and offers a detached native JSON
recovery download. Load-review diagnostics remain visible and retained.

Use **Export project** for a portable JSON backup. **Choose project file** validates
and previews a file before explicit replacement acceptance. Imported projects start
unsaved under a new storage identity; importing never overwrites a local saved
project automatically. Portable projects include explicitly retained runs, not
temporary results or private method binaries. Invalid historical evidence is
rejected before the current runtime retires.

## Experiments

Choose **Experiments** to configure a saved study or create a new one. Expand
**Analysis scope** to select primary and influencing bodies and describe any
excluded pairs. Edit clearance thresholds and time ranges, or preview a CSV or
versioned JSON trajectory before accepting it into the draft. Each CSV joint
column has an explicit angle or length unit. CSV accepts up to 8 MiB and JSON
up to 1 MiB; both require 1–2,000 keyframes. CSV parsing stops at 256 columns or
2,000 data rows. Selecting another file invalidates the previous preview
immediately, including when the new file cannot be read. Save the draft before preflight
or formal analysis.

Expand **GLB visual reference**, choose a self-contained static GLB, and verify its
dimensions, source units, digest, and appearance limitations. Select the target
body, set a body-local position/rotation and positive scale, then choose **Preview
placement in 3D**. Only **Accept visual reference** creates an undoable binding.
Cancellation, another source, leaving the import panel, or changed workcell inputs
invalidates the transient preview. Accepted references can be adjusted or removed
under the selected object's **Visual references**; **Apply changes** commits the
draft. The viewport's **Visuals** and **Proxies** switches affect display only.
Imported triangles never become analysis colliders automatically.
Sources above 8 MiB require explicit memory-warning acknowledgement before
placement preview and acceptance. Another source resets that acknowledgement;
hard byte, geometry and instance limits cannot be overridden.

Native projects include original sources referenced by current candidates or
retained runs. Removing today's visual does not remove a historical run's source.
Every source is decoded and its digest verified before document replacement
pauses the current runtime. Missing, corrupted or unsupported sources reject the
replacement; historical-only references still render after a successful reopen.

New studies use the published 100,000-interval / 30-second budget. Existing saved
studies keep their explicit settings; updating the App does not rewrite them.

**Play**, **Pause**, and **Restart** animate the saved trajectory at real-time
speed without editing joint values or adding history. **Edit pose** returns to
the canonical pose. Playback stops at the interval end and on draft/model,
candidate, document, panel or browser-visibility changes. It owns one cancellable
browser frame callback, never an always-on renderer loop. Preview is not analysis.

The sun/moon icon in the header switches between light and dark mode. The first
visit follows the system preference; an explicit choice is remembered locally
when browser storage permits. Theme changes never edit documents or history.

New examples include original detailed mechanical main-body GLB assets. Turn off
**Proxies** to inspect the housings, joint covers, flanges, fasteners and gripper;
turn it back on to compare the separately defined analysis shapes. These are
synthetic, uncalibrated parts, not vendor CAD. See [sample provenance](samples/README.md).

The sampled pose slider changes only the view. Formal analysis freezes inputs,
runs in an owned Worker, and separates execution, coverage, findings, bounds,
and the rule verdict. Partial or cancelled results retain their unknowns.
While a run is active, its progress card shows validated received pair records,
evaluated intervals, retained evidence leaves, and the frozen wall-time budget.
Use **Cancel analysis** directly in that card. These counts are not a safety
conclusion or an estimated time to completion. Worker startup counts against the
deadline; cancellation permits at most 250 ms of cooperative grace before owned
Worker termination. Contradictory terminal evidence fails without replacing
previously validated findings.
Replay consumes the run's frozen model and trajectory, including after edits.
New results are temporary until **Retain result** is chosen. Retaining adds one
Undo action; the immutable evidence remains available for Redo during the document
lifetime. Save the project separately for durable local storage. Unretained results
are excluded from project saves/exports and are lost on document replacement or
page close; the UI warns before replacement and navigation.

Admission enforces 16 colliders per body, 256 per workcell, 4,096 expanded pairs,
and 500,000 pair/segment combinations in the requested interval. Larger scopes
cannot bypass hard limits through acknowledgement. Retained evidence is capped
globally, including partial progress; reaching a resource limit never means clear.
GLB preview rejects files above 16 MiB before reading and terminates decoding
after its five-second deadline. See the runtime profile for remaining validation
targets; these input caps are not a total-memory guarantee.

## Installed methods and trust

The method selector lists the trusted modules compiled into this local deployment.
The built-in continuous proxy method supports boxes, spheres and capsules. The
independent analytical sphere example supports one static keyframe and sphere
pairs only; it is not a replacement for the continuous method. **Method capabilities
and trust** shows origin, units, bounds, limits, declared validation and services.
Registration is not numerical validation or a safety endorsement.

Select a method, review its parameter defaults and edit the draft, then **Save
experiment**. Switching methods resets method-specific parameters, not historical
results. The sphere example's `additionalError` widens its distance bounds; it
does not estimate measurement error or improve accuracy. Numerical uncertainty
and unsupported inputs remain visible. A new empty-workcell draft may still have
an empty scope after bodies are added: explicitly select primary/influencing
roles and the pair policy, or start **New experiment** from the completed model.

Results retain the method declaration used for that snapshot. A missing module
blocks only dependent execution; its existing results remain readable and
exportable. Project files cannot install executable code. Private developers
configure reviewed modules before building/starting the App, using the
[local extension guide](../../docs/ai/apps/asyra-sim/specs/extensions-sdk-v0.md).
No hot swapping, plugin marketplace or untrusted-code sandbox is provided.

## Your acceptance rules

Open **User acceptance rules** in Experiments to add minimum-clearance or
penetration-evidence conditions and combine them with nested AND/OR groups.
Thresholds are shown in millimeters; stored inputs use meters. Groups allow
two to eight children, up to four levels and 31 total nodes. Save the draft
through **Create experiment** or **Save experiment**; the complete edit is one
Undo action. **Use baseline verdict only** removes the optional expression.

The ordinary minimum-clearance field still controls the method's baseline
finding/refinement threshold. Extra conditions do not silently retune the solver.
Insufficient bounds remain unknown. Conditions apply to the full selected pair
scope; use separate experiments for different scopes. Arbitrary scripts, force
metrics and per-condition pair selectors are not provided.

Results show the original method summary, the separate **User** verdict and
each retained condition's truth value and reason. For example, a study deliberately
requiring penetration can meet your condition while still showing **Issue found**.
This never means equipment is safe to operate. Incomplete execution or coverage
prevents a successful user verdict even when an OR branch is true. Changing
conditions creates new rule/run provenance, and comparisons disclose the change.
JSON, CSV and HTML exports preserve the same evaluation without recomputing it.
See the [typed acceptance contract](../../docs/ai/apps/asyra-sim/specs/decision-rules-v0.md).

## Retained evidence and comparison

Use **Duplicate candidate** beneath the candidate selector to copy committed model
and experiment inputs into an independently editable workcell. Enter a name for B
or C. Copies get new canonical identities, remap all references, and preserve
explicit body correspondence for comparison. Historical runs and unsaved drafts
are not copied. Each complete duplication is one Undo action. Numeric property
fields accept a value on Enter or blur before **Apply changes** commits it.

**Runs & compare** lists temporary and retained results across the current project.
Inspect a run, export JSON/CSV/self-contained HTML, replay its frozen geometry, or
select its source candidate. Missing method modules do not prevent reading history;
they do block reruns. The UI pages large evidence collections without truncating
the saved or exported records.

Select two or three run checkboxes to compare their execution, findings, unknowns,
scope, method, rule and input differences. Incompatible settings are disclosed as
not directly comparable. No automatic winner is chosen. Changed current inputs do
not rewrite earlier evidence, including cancelled and partial results.
Comparison uses recorded body origins across A/B/C copies, not name matching;
changes to geometry and parameters still appear. Original identities and lineage
are retained in reports. Pair labels use the frozen model's names, with raw IDs
available in the expanded evidence.

## Field observations

In **Runs & compare**, retain a result and scroll to **Field observations**.
Choose **Add field observation**, describe what was actually measured, include
units and context, and optionally select supporting files. Review the filenames,
declared types, byte lengths and SHA-256 identities before **Save observation**.
The note is a user report, not a validation certificate or automatic calibration.
It never changes the experiment's original findings, uncertainty or verdict.

Each run allows 20 notes (200 per project), with a 120-character title and
8,000-character body. Each note allows four TXT/CSV/JSON/PNG/JPG/JPEG/PDF files,
up to 2 MiB each; the runtime archive allows 64 distinct sources and 16 MiB of
original bytes. Attachments are opaque: the App does not open, parse, render,
execute, scan, align or certify them. Downloads do not automatically open them.
Changing a run, closing the library or replacing a file selection discards the
transient preparation. Unsupported and oversized selections are rejected before
reading. Identical contents cannot appear twice in one note.

**Edit observation** keeps its identity and advances its revision for material
changes. Stale drafts cannot overwrite a changed note. **Remove observation**
requires confirmation. These metadata changes use the ordinary Undo/Redo owner;
accepted source bytes remain available for Undo within the runtime limit. Save
the project separately: an accepted note is not a durable save or a backup.

Native projects carry only currently referenced observation sources. Every
source is integrity-checked before an imported project can replace the current
runtime, and again during startup. **Export field observations** creates a
separate JSON bundle with the run/snapshot identity, current notes and files.
The run's existing JSON/CSV/HTML reports remain unchanged. See the
[field observation contract](../../docs/ai/apps/asyra-sim/specs/field-observations-v0.md).

## Local distribution launcher

The candidate distribution's `node server.mjs` command serves its own `site`
directory at `http://127.0.0.1:3020`. Open that exact address in an installed
Chrome. Stop with Ctrl+C. An occupied port is an error, not an automatic port
change. `node server.mjs --port=3021` is an explicit alternative, but a different
origin has different browser saves. Always export portable backups before
changing origins or clearing browser data. Do not use `file://` or expose this
launcher as a network service. It offers no uploads or remote-control API.

The launcher is tested independently with
`node --test apps/asyra-sim/scripts/__tests__/local-server.test.mjs` from the
repository root. A launcher alone is not a verified distribution; packaging,
clean-consumer and packaged-browser evidence are still required.

From a clean source commit, maintainers can run
`node apps/asyra-sim/scripts/build-consumer.mjs` to rebuild and validate an
independent App against packed Framework packages. This uses only the existing
project-local dependency cache; run the ordinary declared dependency installation
first if the cache is incomplete. It does not install a new runtime or publish
anything. Bounded command logs and the exact consumer, packed dependencies and
source archive remain under `.artifacts/consumers/`. A passing consumer is an
input to distribution assembly, not a replacement for packaged offline testing.
The same successful producer invocation also assembles a versioned local folder
and tarball, its static site and launcher, App documentation, source SDK, original
dependency notices and file/archive checksums. It stages partial output under
`tmp/` and finalizes only after verifying that the source stayed unchanged.
The SDK keeps packed Framework inputs beside its consumer App; neither is served
by the launcher. See the [local candidate quick start](../../docs/ai/apps/asyra-sim/release/LOCAL_CANDIDATE.md).
Assembly does not mark packaged offline use, reference hardware, independent
pilots or public support policy as passed.

## Architecture

The App-owned CUSTOM engine is composed before Core startup and renders through
the ordinary Core/Render/custom-layer path. Scene Tree and Props remain the
editable authority. The renderer and numerical methods share domain poses;
neither owns a second editable robot graph. No generic 3D Preset is enabled.

See the dedicated [App documentation](../../docs/ai/apps/asyra-sim/README.md),
[numerical contract](../../docs/ai/apps/asyra-sim/specs/numerical-method-v0.md),
and [release gates](../../docs/ai/apps/asyra-sim/release/FIRST_RELEASE.md).

We provide a trustworthy environment for executing experiments, not a guarantee
that users' experimental assumptions hold. Independent pilot acceptance and
all first-release gates are required before R0.
