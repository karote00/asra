# App Contexts

This folder contains app-level implementation contexts.

Current apps:

- `asyra-design/`

- [Asyra Sim](asyra-sim/README.md) - free, pluggable simulation and experiment
  workbench; first product slice: local robot-workcell collision and clearance
  experiments. Implementation is active; no R0 product release is available yet.

Each app folder documents:

- app-specific architecture and workflows
- app interaction contracts
- app rules/golden paths for implementation
- app plans and app-scoped decision history (`decisions/releases/*`)

Framework-level contracts remain in `docs/ai/framework/*`.
Project-owned development-tool contracts remain in `docs/ai/tools/*`.

## Project-wide Rules Inherited By All Apps

All apps, including future app folders under `docs/ai/apps/*`, inherit the
framework hard rules in `docs/ai/framework/rules/*`.

In particular, app bug fixes must follow
`docs/ai/framework/rules/bugfix-test-first.md`: before implementation, verify
whether existing formal tests detect the bug. If they do not, add or strengthen
the formal regression test/oracle first.

In particular, app code must follow
`docs/ai/framework/rules/no-patch-fixes.md`: app implementations must not add
patch UI, patch render output, patch export output, or app-specific fallback
paths to hide a framework or app pipeline defect. Fix the canonical owner step
and verify the normal product path instead.

Global decision-history rules are defined in `docs/ai/decisions/README.md`.
