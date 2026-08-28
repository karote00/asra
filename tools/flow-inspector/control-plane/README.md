# Flow Inspector Control Plane

Reserved future implementation root for the dynamic Flow Inspector workflow
control plane.

Implementation must follow:

- `docs/ai/tools/flow-inspector/PLANS.md`
- `docs/ai/tools/flow-inspector/plans/flow-inspector-workflow-control-plane-roadmap.md`

This tool is not an Asyra Framework runtime package. It must remain outside
`packages/`, outside the Framework Changesets publication allowlist, and
optional for Framework and App consumers.

The first static workspace preview is separately owned by
`tools/flow-inspector/workspace/`. Do not add static sidebar or routing work to
this directory merely because a future Control Plane will consume the same
stable target ids.
