# Asyra Sim Plans

## Current Status

- Product planning baseline: approved for implementation.
- App implementation: authorized through the first local candidate; not complete.
- M0 technical feasibility: established; initial environment/resource choices
  are frozen in the runtime profile. This is not a full workflow or release gate.
- M1 workcell foundations: complete through local save/reopen and complete App
  runtime replacement, including owner cleanup and empty successor history.
- M2-M4 implementation: in progress. Experiment authoring, mapped trajectory
  import, preflight, Worker execution, immutable run retention/comparison,
  reports, portable project reopening, and independent candidate duplication with
  lineage-aware comparison are implemented. Visual-asset attachment, private
  extensions, field observations, and full resource gates remain.
- R0 first public release: not ready; no gate is claimed to have passed.

This index does not record completed implementation or replace the roadmap and
product contract.

## Active Work

1. [Asyra Sim first-release roadmap](plans/asyra-sim-roadmap.md)
   - Order: M0 contracts and feasibility -> M1 workbench -> M2 experiments and
     trajectories -> M3 formal geometric methods -> M4 comparison and
     extensions -> M5 quality and delivery -> M6 independent pilot and R0
     release review.
   - The first release requires M0-M6. It does not wait for M7 domain expansion.
   - Current work: remaining M2-M4 visual-asset, extension, feedback and resource flows.
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
