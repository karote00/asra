# Asyra Sim: Local Candidate Quick Start

This is a local developer candidate, not the R0 public release. It helps you
compare robot-workcell geometry experiments before performing independent
real-world validation. It does not approve equipment operation, predict forces
or dynamics, calibrate a real robot, or certify industrial safety.

We provide a trustworthy environment for executing experiments, not a guarantee
that users' experimental assumptions hold. Incomplete or unresolved analysis
never means clear. Official provenance is not independent validation.

## Start without the monorepo

The distributed folder contains a production `site/`, a loopback-only launcher,
documentation, examples and an optional source SDK. You need an existing Node.js
24.x and Google Chrome installation. No account, Yarn, paid service or network
connection is needed to run the workbench after obtaining the folder. Tools are
not installed or upgraded automatically.

Open Terminal in the extracted distribution folder:

```sh
node --version
node verify-files.mjs
node server.mjs
```

Open `http://127.0.0.1:3020` in Chrome. Keep Terminal open while using the App;
stop with Ctrl+C. Do not open `site/index.html` directly with `file://`.
Checksum verification detects changed, missing or added files against the
included manifest; it does not authenticate an untrusted publisher.
Included user guides and App contracts link locally. Optional Framework/Inspector
references not shipped here are labeled with their repository path and exact
commit; a local commit is not assumed to have been published online.

The current test environment is Apple Silicon macOS with Chrome; exact tool
versions and source identity are in `BUILD.json`. Windows, Linux, other browsers
and mobile devices are unverified. The reference Mac mini M1 / 8 GB performance
gate, independent pilot users and public maintenance policy are not yet verified.
See the [runtime profile](../specs/runtime-profile-v0.md).

## Your first experiment

1. Wait for **Local runtime ready**. The invented six-axis workcell includes a
   robot, gripper, workpiece, table and post. It is not a vendor CAD model.
2. Use the tree and object properties to inspect the shapes, dimensions and
   joints. **Apply changes** commits an edit; Undo/Redo reverses ordinary edits.
   Visual references are appearance only: explicitly create analysis proxies.
3. Open **Experiments**. Review **Analysis scope**, exclusions, time interval,
   minimum clearance, method limitations and numerical/resource settings.
   Save any changed draft before preflight or execution. Acknowledging workload
   warnings does not override a hard limit or improve precision.
4. Choose **Run formal analysis**. Read execution, coverage, raw findings and
   uncertainty separately. Use **Cancel analysis** when needed. Replay the
   frozen evidence at problem times; the sampled pose slider is not a continuous
   collision proof. **Retain result** explicitly adds the result to the project.
5. **Duplicate candidate** to create B. For example, move the fixture post,
   apply the edit, run and retain again. Duplicate B to C and try another change.
6. Open **Runs & compare**, select the three runs and compare. Differences in
   scope, method, rule or inputs remain visible. There is no automatic winner.
   Export JSON/CSV/HTML reports, then choose what deserves real-world validation.
7. Open **Projects** and save. Also **Export project** to a portable backup.
   Reopen that file through **Choose project file**, inspect the preview and
   explicitly accept replacement. Opening creates an empty Undo/Redo lifetime;
   it does not undo back into the previous document.

For your own study, create a blank project and add bodies/joints/proxies, or
edit an independent copy of the sample. New bodies need explicit scope roles.
One workcell is the supported analysis domain, not a whole-factory simulator.
The [user guide](../../../../../apps/asyra-sim/README.md) covers detailed controls,
visual imports, acceptance rules and separate field observations.

## Trajectory example and data formats

The [synthetic CSV](examples/synthetic-trajectory.csv) reproduces the sample's
three keyframes. In **Load CSV**, map `time` to seconds and every joint column to
its matching joint in radians; inspect the preview before **Accept into draft**
and **Save experiment**. A copied candidate has new IDs, so explicitly remap its
columns. Do not interpret vendor/controller data without checking units,
joint conventions, interpolation and geometry assumptions.

CSV allows up to 8 MiB, JSON 1 MiB, and either format 2,000 keyframes. JSON uses
the strict versioned trajectory envelope; portable projects use the App's own
versioned document format. They are different file types. Unsupported formats
fail explicitly rather than being guessed or partially imported. See the
[workcell/input contract](../specs/robot-workcell-v0.md) and
[numerical method limits](../specs/numerical-method-v0.md).

## Backups, privacy and recovery

Browser IndexedDB is not a backup. Clearing site data removes local saves;
changing the port, hostname, browser profile or browser does not migrate them.
Export portable projects before changes. Keep original backups separate from
candidate experiments. Unretained results are temporary and not included in
saves/exports. A save is acknowledged only after local storage commits.

If storage is unavailable, editing remains usable and portable export is the
fallback. Invalid imports preserve the open document. A failure after retirement
disables editing and offers detached recovery; preserve that download and the
original backup before restarting. Do not manually repair private evidence.

The official local workflows do not upload project data. Project files cannot
install code. Compiled private extensions are trusted code, not a security
sandbox: their author must review services, dependencies and disclosure risks.
Field-observation attachments are opaque, not scanned or certified; download
does not automatically open them. Review exported project/report contents before
sharing. Prefer a minimal synthetic reproduction without factory secrets.

## Optional developer SDK

Non-developers do not need this section. The distribution includes `sdk/app`
with App sources, tests and a consumer manifest, plus `sdk/framework` with the
exact packed Framework inputs. Node 24.x and Yarn 4.3.1 are needed for development;
the first dependency installation may require registry access unless you already
have the matching package cache. No tools are installed automatically.

```sh
cd sdk/app
yarn install --immutable
yarn typecheck
yarn test:local
yarn build
node scripts/run-e2e.mjs e2e/__tests__
```

Follow the [local SDK guide](../specs/extensions-sdk-v0.md). Its repository-root
commands correspond to the local consumer commands above. Register reviewed
modules in `src/extensions/installed-methods.ts` before rebuilding; do not edit
Core or import a plugin through project JSON. Private methods need their own
mathematical and conformance tests. A private rebuild is a new deployment, not
the original verified binary; preserve original artifacts and label it clearly.

## Troubleshooting and candidate limits

- **Node version rejected:** use an existing compatible Node 24 installation.
  This package does not automatically upgrade your environment.
- **Port occupied:** stop the process you own that uses 3020, or explicitly use
  `node server.mjs --port=3021`. A changed origin has separate browser saves.
- **Blank/error viewport:** use Chrome with WebGL 2 enabled; record the browser,
  OS and error. Do not substitute a screenshot for a failed numerical result.
- **Analysis blocked:** review invalid model/scope, missing modules, joint
  units, excluded pairs and hard limits. Reduce the intended scope explicitly;
  do not suppress unknowns or alter precision merely to get a passing label.
- **Unknown/partial result:** inspect unresolved intervals and the actual
  evaluation/time budget. More computation may help, but cannot validate a bad
  model or guarantee convergence.
- **Large download/build warning:** the current main bundle is about 1.9 MB
  uncompressed. Its chunk-size warning is retained, not hidden by a raised limit.

Use `BUILD.json`, `DEPENDENCIES.json`, `THIRD_PARTY_NOTICES.txt` and `SHA256SUMS`
to identify this candidate. Provide version, OS/browser, minimal synthetic input,
expected/actual behavior and reproducible steps to the person coordinating your
local review. A public issue/security channel, maintenance owner and response
policy have not been authorized; do not send secrets to a guessed address.
Free software does not promise an SLA or unlimited immediate support.

The 2026-09-05 Yarn registry audit of the locked independent consumer returned
one moderate deprecation notice for `glob@10.5.0` through `cacache@19.0.1` in the
development dependency tree. It is absent from the actual main/Worker bundle
inputs. No high/critical advisory was returned by that audit. This is a dated
registry result, not proof of vulnerability absence; developer tooling should
only process trusted source and use the bounded isolation workflow. Dependency
upgrades and reassessment remain separate work. Runtime notices retain the
actual shipped license texts; missing publisher text is supplemented only from
the exact registry-declared source revision, never an invented attribution.

Publication, independent pilots and all [first-release gates](FIRST_RELEASE.md)
remain separate decisions. Do not use this candidate as the sole basis for
production, equipment motion or worker safety.
