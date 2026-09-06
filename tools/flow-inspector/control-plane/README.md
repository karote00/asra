# Flow Inspector Core Proof

This local board verifies two real Factory flows: deferred publication and
cancellation after immediate publication. Six formal obligations map to three
concrete architecture steps shared by both flows. The first bounded Phase 3
checkpoint is defined in [CORE_PROOF.md](../../../docs/ai/tools/flow-inspector/CORE_PROOF.md).

## Run Locally

Use the repository's declared Node.js 24 and Yarn 4.3.1 environment on macOS or
Linux. From the repository or this PR's worktree root, install the existing locked
dependencies if needed:

```bash
yarn install --immutable
FLOW_PROOF_URL=http://127.0.0.1:4318 node tools/flow-inspector/control-plane/cli.cjs serve
```

Open <a href="http://127.0.0.1:4318" target="_blank" rel="noopener noreferrer">the local board</a>.

1. Select **Current source** and click **Run all flows**. Expect both flows and
   all six checks to pass.
2. Select **Inverse regression demo** and run again. Expect the commit flow to
   pass while cancellation fails `cancel.outcome` and `cancel.delivery`.
3. Inspect a failed card and its contract, then select **Current source** and
   run again. All checks should recover. Earlier attempts remain selectable.
4. A card's **Verify linked flow** runs that flow's three obligations. The other
   flow remains unverified for that attempt. Shared responsibility buttons
   highlight the corresponding card in both flows.

The negative demonstration transforms the isolated copy of the real Factory
implementation; it never edits your working source or weakens the assertions.
Each attempt has its own scenario, source digest, Git HEAD, audit, and raw report.
The digest includes uncommitted source and identifies a captured snapshot, not a
continuously watched checkout or deployed environment.

Use **Cancel run** to stop active verification and `Ctrl+C` to stop the server.
Stop the server before running CLI verification: the board and CLI deliberately
require exclusive ownership of the same local attempt store.

## CLI and CI Proof

```bash
# Pass only when all six supported obligations pass.
node tools/flow-inspector/control-plane/cli.cjs verify

# Run the three obligations belonging to one supported flow.
node tools/flow-inspector/control-plane/cli.cjs verify deferred-publication

# Deliberately fail cancellation. An exit code of 1 is expected here.
node tools/flow-inspector/control-plane/cli.cjs negative

# Require baseline pass, the precise regression failure, and baseline recovery.
# This command exits 0 only when the entire negative proof succeeds.
node tools/flow-inspector/control-plane/cli.cjs prove
```

The command exits nonzero for missing or malformed evidence, unknown mappings,
skipped obligations, runner errors, cancellation, and timeout. `prove` does not
accept an arbitrary failure as proof. CLI and board share the same action service.
Completed attempt records and copied inputs remain under `tmp/flow-inspector/runs/`.
They are local artifacts and are not committed or published.

## Formal Tests

```bash
node --test tools/flow-inspector/control-plane/__tests__/{contracts,snapshot,runner,evidence,store,service,server}.test.cjs
FLOW_PROOF_URL=http://127.0.0.1:4318 node --test tools/flow-inspector/control-plane/__tests__/board.test.cjs
```

The browser test uses the repository's existing Playwright harness and installed
Chromium. To use an already installed Chrome locally, add
`FLOW_PROOF_BROWSER_CHANNEL=chrome` to that command. No browser or dependency is
downloaded by the test. Stop any board using its configured port first.
The test starts the actual server, runs real Factory checks, exercises the page,
and records desktop/mobile screenshots plus source identities under
`tmp/flow-inspector/visual-review/`.

CI runs the focused tests and `prove` directly in `validate`, without a wrapper
that masks failing assertions. The E2E job also runs the permanent browser test.
Required-check enforcement itself remains a repository setting.

## Boundaries

This is a trusted local development tool, with one bounded runner process group,
loopback access, per-start mutation capability, explicit cancellation, and durable
attempt identity. It does not sandbox hostile code. It supports these two flows;
arbitrary flow onboarding, accepted-base comparison, remote CI ingestion, agent
execution/token controls, Jira/GitHub actions, and shared team hosting remain in
the later plans.

The static viewer and React workspace remain separately owned by
`tools/flow-inspector/workspace/`. Framework and App runtimes do not depend on this
tool, and this checkpoint does not change their package versions.
