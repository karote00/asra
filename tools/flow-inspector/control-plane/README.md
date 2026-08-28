# Flow Inspector Control Plane

Reserved implementation root for the independently versioned Flow Inspector
workflow control plane.

Implementation must follow:

- `docs/ai/tools/flow-inspector/PLANS.md`
- `docs/ai/tools/flow-inspector/plans/flow-inspector-control-plane-core-preview-plan.md`

This tool is not an Asyra Framework runtime package. It must remain outside
`packages/`, outside the Framework Changesets publication allowlist, and
optional for Framework and App consumers.
