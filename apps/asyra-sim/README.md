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
Attached visual assets, extension delivery, and independent validation remain under development. Do not use this
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
column has an explicit angle or length unit. Save the draft before preflight
or formal analysis. A GLB decode preview currently reports restricted visual
asset metadata; attaching it to the workcell is a separate unfinished step.

The sampled pose slider changes only the view. Formal analysis freezes inputs,
runs in an owned Worker, and separates execution, coverage, findings, bounds,
and the rule verdict. Partial or cancelled results retain their unknowns.
Replay consumes the run's frozen model and trajectory, including after edits.
New results are temporary until **Retain result** is chosen. Retaining adds one
Undo action; the immutable evidence remains available for Redo during the document
lifetime. Save the project separately for durable local storage. Unretained results
are excluded from project saves/exports and are lost on document replacement or
page close; the UI warns before replacement and navigation.

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
