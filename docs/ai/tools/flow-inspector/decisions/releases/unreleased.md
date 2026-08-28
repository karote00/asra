# Unreleased Flow Inspector Decision History

Append-only decision log for Flow Inspector work not yet published as a tagged
tool release.

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
  - `docs/ai/tools/flow-inspector/plans/completed/flow-inspector-static-workspace-preview-plan.md`
- Related Commit(s):
  - `818f1800a` through `209caa540` (catalog, routing, isolation, rendering,
    standalone coverage, and inventory correction)
  - `3e48adfaf` (React/Vite workspace shell)
