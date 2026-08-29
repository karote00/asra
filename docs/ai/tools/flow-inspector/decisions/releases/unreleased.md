# Unreleased Flow Inspector Decision History

Append-only decision log for Flow Inspector work not yet published as a tagged
tool release.

## 2026-08-29 - Version 0.2.0 clarifies workspace navigation and contract reading

- Context:
  - The integrated workspace needed flow-focused panel controls and a clearer
    distinction between ownership metadata and future runtime success states.
- Decision:
  - Set `@asyra/flow-inspector` to version `0.2.0`.
  - Keep the three panel toggles fixed inside the scrollable and scalable flow
    viewport while allowing Catalog, Header, and Details to open and close.
  - Label step ownership as `Owner: ...` with neutral blue-gray styling, and
    reserve green styling for future passed or healthy runtime states.
  - Present concise step details by default and place execution rules,
    ownership boundaries, and related contract data in a collapsed
    `Full contract` section with explicit visual category boundaries.
- Consequences:
  - Human readers can focus on the flow and scan the selected step without
    losing access to the complete Inspector contract.
  - Static ownership metadata no longer implies execution success.

## 2026-08-29 - Static workspace preview uses a React shell with isolated targets

- Context:
  - Current-project Inspectors were distributed across Framework, App, Release,
    and Tool documentation and needed one convenient static navigation surface.
- Decision:
  - Ship the optional `v0.1.0-preview` workspace under
    `tools/flow-inspector/workspace/` as a React/Vite shell with a checked-in
    classic-script build, stable hash routes, and keyed iframe isolation.
  - Classify 34 discovered candidates as 32 included current-project entries
    and two explicit historical exclusions while preserving existing
    standalone HTML entries.
  - Keep runtime evidence, CI enforcement, CLI/API, and command/action buttons
    outside this preview and owned by the future Control Plane.
- Consequences:
  - The workspace opens directly through `file:` URLs without a server while
    providing sidebar search, grouping, deep links, and target switching.
  - Framework packages and App runtimes do not depend on the tool, and the
    preview cannot block Framework publication.
- Related Plan:
  - `docs/ai/tools/flow-inspector/plans/completed/flow-inspector-static-workspace-0.2.0-closure-plan.md`
- Related Commit(s):
  - `818f1800a` through `209caa540` (catalog, routing, isolation, rendering,
    standalone coverage, and inventory correction)
  - `3e48adfaf` (React/Vite workspace shell)

## 2026-08-29 - Static workspace P2 closes at version 0.2.0

- Context:
  - Direct product review expanded the original preview contract with flow
    viewport zoom, scrolling, panel toggles, compact ownership metadata, and a
    clearer step-detail hierarchy.
- Decision:
  - Close P2 after validating all 32 current-project Inspectors, standalone
    renderer synchronization, the React workspace, desktop and narrow viewport
    behavior, and the complete package test entrypoints.
  - Keep execution status, CI enforcement, commands, actions, and integrations
    deferred to the Control Plane plans.
- Consequences:
  - `@asyra/flow-inspector` `0.2.0` is ready to accompany the current Framework
    release as an optional static tool without becoming a Framework/App runtime
    dependency or publication blocker.
- Related Plan:
  - `docs/ai/tools/flow-inspector/plans/completed/flow-inspector-static-workspace-0.2.0-closure-plan.md`
