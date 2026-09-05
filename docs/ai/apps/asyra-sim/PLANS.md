# Asyra Sim Plans

## Current Status

- Product planning baseline: approved for implementation.
- App implementation: authorized through the first local candidate; not complete.
- M0 technical feasibility: established; initial environment/resource choices
  are frozen in the runtime profile. This is not a full workflow or release gate.
- M1 workcell foundations: complete through local save/reopen and complete App
  runtime replacement, including owner cleanup and empty successor history.
- Local review refresh (2026-09-05): original mechanical main-body GLB sources,
  explicit sample naming and compound gripper proxies, concise responsive UI,
  transient Play/Pause/Restart, persistent light/dark themes, pose-stable GPU
  resource ownership and bounded studio shadows are implemented. Source checks
  pass 367 unit tests, 45 browser tests, typecheck, lint and production build.
  Live review uses `http://127.0.0.1:3020/`; overview, three trajectory times,
  closer views, narrow layouts and theme screenshots were inspected. The
  software-rendered 1600x1000 playback check recorded 50 ms median / 66.7 ms
  p95 with shadows, not a hardware-GPU or release performance guarantee.
  This refresh has not rebuilt or revalidated the older packaged candidate.
- M2-M4 implementation: in progress. Experiment authoring, mapped trajectory
  import, preflight, Worker execution, immutable run retention/comparison,
  reports, portable project reopening, and independent candidate duplication with
  lineage-aware comparison are implemented. Restricted visual attachment and trusted
  pre-start method extensions, including an independent analytical example and
  retained method provenance, are implemented. Typed acceptance groups preserve
  raw findings and unknowns across the same result/report/history path. Run-linked
  field observations, bounded opaque attachments, independent feedback export,
  and integrity-checked reopening are implemented. Full resource gates remain. Admission,
  retained-evidence caps, Worker deadlines/cancellation, and bounded visible
  progress now have focused regressions and ordinary browser coverage.
- M5 delivery checkpoint: `125a09c0e` passes the clean exact-source producer:
  19 rebuilt/validated Framework tarballs, 348 unchanged registry inputs, 360 App
  tests, type and main/Worker input isolation, and versioned local candidate
  assembly with original notices, source SDK, guides and checksums. The launcher
  and packaging guards pass 18 permanent tests; normal startup/editing passes
  three browser tests. This is assembly evidence, not packaged offline or R0
  acceptance. Candidate artifacts are retained under the App's
  `.artifacts/consumers/125a09c0e3a2-qGNQsL/`.
- R0 first public release: not ready; no gate is claimed to have passed.

This index is a concise checkpoint, not a replacement for the roadmap or product contract.

## Active Work

1. [Asyra Sim first-release roadmap](plans/asyra-sim-roadmap.md)
   - Order: M0 contracts and feasibility -> M1 workbench -> M2 experiments and
     trajectories -> M3 formal geometric methods -> M4 comparison and
     extensions -> M5 quality and delivery -> M6 independent pilot and R0
     release review.
   - The first release requires M0-M6. It does not wait for M7 domain expansion.
   - Next bounded work: production-package offline browser workflows and inspected
     screenshots; the permanent six-axis / 30-fixed-shape / 200-keyframe /
     three-candidate resource benchmark; then the remaining local candidate
     closeout gates. Work is paused at the validated delivery checkpoint, not
     marked complete. Reference M1/8 GB hardware, two independent pilots and
     public reporting/maintenance policy still require external evidence or
     user decisions; do not substitute this development host or self-review.
     The approved reset scope and owner sequence are recorded in the roadmap.
     The user approved Three.js, its types and necessary dependencies, and the
     necessary Framework lifecycle extensions.
   - Keep the engine App-owned for now. Future extraction of generic defaults
     into Preset is a separate task; do not enable the official 3D profile here.

## Unscheduled Directions

Choose based on pilot needs: additional geometry and importers, more complex
mechanisms, additional analysis methods, batch experiments, and field-data
alignment. TCAD, whole-factory scheduling, AI, and cloud services are not a
committed implementation backlog.

## Related Authorities

- User value: [PRODUCT.md](PRODUCT.md).
- Sole source of first-release gates:
  [FIRST_RELEASE.md](release/FIRST_RELEASE.md).
- Planning assumptions and open decisions are centralized in the
  [roadmap](plans/asyra-sim-roadmap.md), not separate readiness matrices, audit
  ledgers, or parallel plans.
