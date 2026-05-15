# Flow Inspector Dashboard Plan

## Goal

Create a framework-level developer tool that turns complex repo workflows into inspectable flow boards.
The tool should help engineers and non-implementation stakeholders understand where data enters, which helpers transform it, which rules apply, which tests protect each step, and where current failures should be inspected.

## Context

The stroke engine debugging work showed that a static flow board is useful because the failure can move between geometry, fill, stroke, final-face, render, and diagnostics layers.
The same need exists for other framework systems: feature sessions, render layers, data-channel updates, transaction boundaries, computed-data mirrors, and future shadow rendering.

This should be a framework-level devtool, not an `asyra-design` app feature.
It must remain outside product runtime and should be reusable across any framework or app flow.

## Scope

In scope:
- define a reusable flow-inspector data model
- generate standalone HTML flow boards
- attach source references, helper functions, rules, tests, commands, and evidence checklists to each node
- validate node/edge/test/source references
- support sidecar result data for test/profile/screenshot status in later phases
- support a local server mode in later phases for rerun buttons and live refresh

Out of scope:
- product runtime UI
- app-level feature behavior
- first-phase shell execution from `file://` HTML
- mandatory workspace package creation before the data contract stabilizes
- direct imports from product/runtime internals in the server process

## Target Behavior

1. Static generated board
- A board can be opened directly in a browser.
- It contains groups, nodes, edges, rules, related files, related tests, debug commands, and evidence to inspect.
- It does not require external JavaScript, CSS, fonts, or network access.

2. Sidecar results
- A future `flow-inspector.results.json` file can provide node-level test status, duration, failure summary, profile metrics, and screenshot references.
- The static viewer can embed a snapshot of this data.
- Server mode can reload the sidecar file without regenerating the HTML.

3. Local server mode
- A local dev server can serve the same board and expose explicit rerun actions.
- Rerun actions are allowed only for commands declared in the flow-inspector config.
- The server writes result JSON; it does not mutate product code.

4. Repo guards
- A validation command fails when node ids are duplicated, edges point to missing nodes, critical nodes lack tests/evidence, or source/test paths are stale.
- CPU-only profile data must be labeled as such when shown in the dashboard.

5. Reusable targets
- The same tool should support targets such as `stroke-engine`, `render-layer-registration`, `data-channel-flow`, `transaction-boundary`, and `feature-session`.

## Proposed Contract Direction

```ts
defineFlowInspector({
  id,
  title,
  groups,
  nodes,
  edges,
  rules,
  tests,
  commands,
  sourceRefs
});
```

Node shape:
- `id`
- `group`
- `title`
- `summary`
- `helpers`
- `inputs`
- `outputs`
- `decisions`
- `risks`
- `relatedFiles`
- `relatedTests`
- `debugCommands`
- `evidenceToInspect`
- optional `statusSlot`

Result shape:

```json
{
  "targetId": "stroke-engine",
  "generatedAt": "2026-05-15T00:00:00.000Z",
  "nodes": {
    "self-dashed": {
      "status": "failed",
      "durationMs": 842,
      "failureSummary": "Hole-boundary contour has no product coverage.",
      "profileMetrics": {
        "p95Ms": 18.4
      },
      "screenshotRefs": [
        "apps/asyra-design/test-results/stroke-rule-driven-dashed-visual/hole-boundary.png"
      ]
    }
  },
  "commands": {
    "stroke-rule-driven-visual": {
      "status": "failed",
      "durationMs": 24311
    }
  }
}
```

CLI draft:
- `yarn flow:inspect --target stroke-engine --generate`
- `yarn flow:inspect --target stroke-engine --serve`
- `yarn flow:inspect --target stroke-engine --run-tests`

Storage draft:
- `tools/flow-inspector/`
- no new workspace package until the config/result schema is stable
- target configs can live near the owning plan or in a shared devtool directory

## Implementation Slices

1. Current static aid
- enhance the existing stroke flow HTML with reading guidance, legend, debug checklist, related files, related tests, commands, and evidence fields.

2. Config extraction
- move embedded board data into a typed config file.
- keep generated HTML deterministic and standalone.

3. Generator
- add a small generator that validates the config and emits the HTML viewer.
- add snapshot/smoke tests for generated output.

4. Result ingestion
- define and validate `flow-inspector.results.json`.
- allow the HTML viewer to render node-level pass/fail/profile/screenshot state.

5. Local server
- serve the board and sidecar result JSON.
- expose safe rerun buttons for declared commands.
- stream command status back into result JSON.

6. Repository integration
- add CI-safe validation for configs.
- add documentation requiring flow-board updates when a pipeline changes.

## Success Criteria

- the current stroke board explains how to read the flow, what colors mean, and what evidence to inspect next
- each critical/risk node has related tests or evidence fields
- future flow-inspector work has a clear config, result, CLI, and server direction
- no product runtime dependency is introduced
- no external network or browser package is required for the static viewer
- a stakeholder can use the board to identify the likely failing layer without reading the full implementation first

## Risks

1. Stale diagrams
- Mitigation: add validation and require flow-board updates when implementation flow changes.

2. AI-generated incorrect flow
- Mitigation: require source references and test/evidence links per critical node.

3. Unsafe command execution
- Mitigation: static HTML never runs commands; server mode can only run explicitly declared local commands.

4. Overfitting to stroke
- Mitigation: keep the model generic: groups, nodes, edges, rules, tests, commands, source refs, and results.

5. Misreading CPU-only profiles as UX truth
- Mitigation: result data must carry measurement scope and renderer coverage metadata.

## Exit Criteria For First Phase

- `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.html` includes reading guidance, legend, checklist, and node-level references.
- `docs/ai/framework/plans/flow-inspector-dashboard-plan.md` defines the devtool direction.
- No product code changes are required.
