# Local Runtime and Resource Profile v0

Status: initial M0 choices, not a measured release-capacity claim. M5 must
verify the complete journey and resource gates on the reference hardware.
Limits below are implementation targets until their owning guards and tests
exist. Configuration must never silently reduce numerical precision.

## Environment and Delivery

The initial target is macOS on Apple Silicon, an installed Google Chrome,
WebGL 2, module Workers, IndexedDB, and the binary64/BigInt operations required
by the numerical contract. Exact OS/browser versions belong to each test
report. Windows, Linux, other browsers, and mobile devices remain unverified;
using web technologies does not establish their support.

The ordinary reference machine is a Mac mini (M1, 2020), 8 GB unified memory,
8-core CPU and integrated 8-core GPU; see the
<a href="https://support.apple.com/en-asia/111894" target="_blank" rel="noopener noreferrer">manufacturer specifications</a>.
This is a reproducible validation target, not a purchasing recommendation or
minimum-system-requirements claim. Its OS/browser versions must be recorded
when actual validation runs. It is not available in the current development
environment, so its M5/G4 gate remains unverified. CPU throttling on a faster
machine does not substitute for that gate.

The M0 development evidence uses an Apple M3 Max, 48 GiB memory, 16 logical
CPUs, macOS 26.6.2, Chrome 152.0.7977.82, Node.js 24.13.0, and Yarn 4.3.1.
Automated WebGL checks use SwiftShader; they prove the normal App path, not
native-GPU performance. Numerical browser tests exercise the same pure domain
and method modules. Restricted GLB decoding also runs in an isolated module
Worker without Core, GPU initialization, or external requests.

The first distribution will contain a self-contained static production build,
examples, documentation, notices, and a small Node.js 24 loopback-only server.
Users will need an existing compatible Node.js and Chrome installation, but
not the Asyra monorepo, Yarn, an account, or an Internet connection after
obtaining the distribution. Do not distribute a browser/runtime binary or
install tools automatically. A stable local origin is necessary for IndexedDB;
changing its port or clearing browser site data does not migrate saved data.
Portable backups remain required. `file://` is not the supported launch route.
M5 must prove offline startup and the clean-consumer artifact, including its
exact source commit, dependency notices, and checksums.

## Initial Admission and Execution Limits

The numerical envelope and GLB structural limits remain owned by their
respective specifications. The following aggregate limits apply in addition:

| Resource                       | Initial limit or behavior                                     |
| ------------------------------ | ------------------------------------------------------------- |
| Analysis geometry              | 16 colliders per body, 256 per selected workcell              |
| Expanded shape pairs           | 4,096 per run, after explicit pair policy                     |
| Pair/keyframe-segment workload | 500,000 before adaptive subdivision                           |
| Concurrent formal jobs         | One; candidates execute sequentially                          |
| Formal wall-clock budget       | Default 30 s; user range 0.1–120 s                            |
| Adaptive node budget           | Default 100,000 total; maximum 1,000,000 per run              |
| Retained interval evidence     | Maximum 200,000 leaves per run                                |
| Cooperative cancellation grace | 250 ms, then terminate the owned Worker                       |
| Progress delivery              | At most 10 updates/s; terminal evidence is not throttled away |
| GLB import deadline            | 5 s, including bounded decoding; terminate on expiry          |
| CSV input                      | 8 MiB before parsing, with the trajectory's 2,000-frame cap   |
| Trajectory JSON input          | 1 MiB before parsing, with the same 2,000-frame cap          |
| Project JSON / portable bundle | 64 MiB before parsing                                         |
| Individual visual source       | 16 MiB, plus the restricted GLB structural caps               |
| Referenced visual source bytes | 64 MiB per project                                            |
| Decoded visual geometry        | 1,000,000 vertices / 3,000,000 indices per archive and expanded workcell |
| Worker output payload          | 64 MiB encoded evidence, plus the leaf-count cap              |

Total-node accounting includes initial interval queries across all pairs; a
per-pair budget alone is insufficient. Preflight rejects workloads above hard
admission limits before allocating a Worker. Runtime exhaustion produces partial
coverage or explicit failure, never omitted pairs presented as complete. Retain
already established findings when possible; otherwise explicitly state that
no evidence could be retained. Wall-clock deadlines include startup and method
execution and are enforced by the Worker owner, not solely by method callbacks.

Trajectory source normalization rejects excessive frame counts before
conversion. CSV parsing stops as soon as it encounters an excessive data row
or column (maximum 256), rather than materializing the full input first.
The file picker checks the format-specific byte cap before reading. Starting
another file read invalidates prior acceptance; late reads cannot overwrite a
newer selection or a manual source edit.

Warn and request explicit acknowledgement above 256 expanded pairs, 10,000
pair/segment combinations, or 8 MiB of visual source data. Display the actual
counts and configured budget. These warnings are workload indicators, not
estimated completion times; state that no reliable time estimate is available
until representative profiling exists. Acknowledgement cannot override a hard
limit or invalid model.

Byte/count caps limit input and retained evidence, not the browser's total
resident memory. M5 records actual measurable memory and its measurement
limitations; it must not claim a memory guarantee from these caps. The normal
six-axis / approximately 30-obstacle / approximately 200-keyframe / three-candidate
benchmark remains mandatory. Failure to produce useful answers within measured
limits requires an owner-level correction or an explicit product decision,
not a narrower undisclosed test fixture.

## Evidence and Advancement

The permanent production-Worker budget baseline uses the unchanged public
six-axis example (11 bodies, 3 keyframes, 46 selected collider pairs). On the
local Chrome validation host, 2,000 evaluations left 23 pairs unresolved in
about 0.7 seconds; the published 100,000 cap allowed complete method coverage
after 5,768 evaluations in about 1.7 seconds. Browser event-loop samples remained
active during both runs. The formal browser test retains the measured counts,
budgets, timing, and completion state in its report. These observations justify
using the already published defaults, not a new accuracy or reference-hardware
claim. They do not replace the larger M5 workload above.

M0 feasibility tests cover normal CUSTOM startup, public picking/resizing,
canonical edits and raw save/load, independent geometric cases, browser
arithmetic, and restricted GLB Worker decoding. They do not prove the production
runner's cancellation, local save UI, full import acceptance, or R0 readiness.

M1 next implements acknowledged local saving and reopening through the storage,
editing, composition, and UI owners, one owner segment at a time. Its gates
include native IndexedDB transaction completion/abort, failure without false
saved state, editing during save, validated reload, and ordinary UI reopening.
No claim of durable backup follows merely from an IndexedDB transaction.
