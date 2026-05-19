# Stroke Engine Final Source Of Truth

## Role

This file defines the only active documentation authority for the stroke engine
after the final spec-package reset.

If any earlier stroke document conflicts with this package, this package wins.

## Active Authority

| Need | Read |
| --- | --- |
| Entry point | `README.md` |
| Final architecture | `target-architecture.md` |
| Canonical stage flow | `geometry-pipeline.md` |
| Correct one-sided constrained geometry | `inside-outside-one-sided-geometry.md` |
| Exact-correct path algorithm | `exact-correct-path-algorithm.md` |
| Runtime representations and batching | `runtime-data-representation.md` |
| External reference research | `reference-research-findings.md` |
| Current support contract versus roadmap | `active-support-scope.md` |
| Product semantics and topology decisions | `topology-and-product-semantics.md` |
| Helper and packet contracts | `function-contracts.md` |
| Parameter impact and geometry trace | `parameter-impact-matrix.md` |
| Performance and dirty graph | `performance-and-dirty-graph.md` |
| Test and benchmark requirements | `testing-and-benchmark-spec.md` |
| Failure review and self-audit loop | `failure-triage-and-self-review-loop.md` |
| Phase rollout (migration only) | `phase-execution-plan.md` |
| Legacy deletion and history rules | `migration-and-archive-plan.md` |
| Baseline analysis | `../../reports/stroke-engine-final-analysis-report.md` |

## Mandatory Reading Rule

Before changing stroke runtime or stroke docs:

1. read this file
2. read `target-architecture.md`
3. read `geometry-pipeline.md`
4. read `inside-outside-one-sided-geometry.md`
5. read `exact-correct-path-algorithm.md`
6. read `runtime-data-representation.md`
7. read `reference-research-findings.md`
8. read `active-support-scope.md`
9. read `function-contracts.md`
10. read `parameter-impact-matrix.md`
11. read `performance-and-dirty-graph.md`
12. read the relevant testing section in `testing-and-benchmark-spec.md`

## Source-Of-Truth Constraints

- no stroke implementation work may treat earlier rollout files as active
  authority
- no new stroke plan may be added outside this folder unless this file is
  updated in the same change
- no helper, packet, or support decision may be documented only in a test
  comment or issue thread
- no reviewer should need to infer active semantics from legacy files
- no legacy stroke planning file may remain outside this folder as an archived
  plan, shadow authority, or searchable secondary reference
- no reviewer should need to read the phase plan to determine current support
- no exact family may be implemented before its exact-correct algorithm branch
  is defined

## External Reference Priority

When a product-visible stroke behavior is not fully defined in this package,
the decision order is:

1. Figma public product behavior or official Figma developer documentation
2. observable Figma fixtures captured from the current product when official
   docs are missing or incomplete
3. other established design-software or design-tool references, prioritizing
   large or widely adopted product sources such as Adobe Illustrator,
   Adobe After Effects, Framer, Sketch, Lottie/Bodymovin behavior, and other
   design-authoring tools
4. other large-company graphics or runtime references only after design-tool
   references are missing, incomplete, or contradictory, such as Apple/Core
   Graphics, Skia, Flutter, Android, SVG, Canvas, and browser behavior
5. mature geometry libraries or algorithm references, such as Bezier.js,
   Paper.js, Clipper, CGAL, robust planar arrangement, straight skeleton, or
   polygon offsetting literature
6. Asyra-defined deterministic semantics, recorded as a documented divergence

Rules:

- no implementation may guess unresolved stroke behavior
- miter joins that exceed the configured miter threshold are bevel joins, not
  unsupported substitute paths
- if Figma is used as the product reference, tests must capture the visible
  behavior that is being matched
- if official Figma docs do not exist, captured Figma behavior still outranks
  every other external source
- if Figma cannot answer the question, design-software research must be
  completed before checking general large-company graphics/runtime behavior
- general large-company graphics/runtime behavior must be checked before
  falling back to algorithm-only references
- algorithm-only references may define construction mechanics, but they may not
  override product-visible semantics from Figma, an approved design tool, or an
  approved large-company runtime reference
- if research is inconclusive, the family remains `research-gated` or `blocked`
- Asyra-defined semantics are allowed only when all higher-priority references
  are absent, contradictory, or unusable for the target interaction model

## Legacy Document Rule

Earlier stroke rollout plans, support matrices, scenario matrices, support
ledgers, manual QA checklists, handoff notes, and failure-triage documents must
not remain as separate files in `docs/ai/apps/asyra-design/plans/`.

Allowed historical locations:

- `docs/ai/apps/asyra-design/decisions/releases/unreleased.md`
- `docs/ai/apps/asyra-design/reports/stroke-engine-final-analysis-report.md`

Rules:

- do not recreate deleted legacy stroke planning files
- do not add a new archive folder for deleted legacy stroke plans
- do not link reviewers to deleted legacy files for active semantics
- if a historical decision is still important, summarize it in decision history
  and ensure the active rule exists in this package

## Change Rule

If a stroke decision changes:

- update the relevant file in this folder first
- update `testing-and-benchmark-spec.md` if expected behavior changes
- update `migration-and-archive-plan.md` if file routing changes
- append rationale in app decision history if the change affects architecture,
  support semantics, ownership semantics, or product-visible behavior
