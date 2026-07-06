# App Rules

- `app-boundaries.md`
- `artifact-management.md`
- `feature-authoring.md`
- `ui-data-flow.md`
- `testing-contracts.md`
- `geometry-scenario-testing.md`
- `geometry-clipping-regression-contract.md`

App rules inherit all framework hard rules in `docs/ai/framework/rules/*`.
`docs/ai/framework/rules/bugfix-test-first.md` applies directly to Asyra Design:
before implementation, verify whether existing formal tests detect the bug; if
they do not, add or strengthen the formal regression test/oracle first.
`docs/ai/framework/rules/no-patch-fixes.md` applies directly to Asyra Design:
do not add app-specific patch render/UI/export/alternate output to hide a
pipeline defect.
