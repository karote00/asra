# Asyra Sim

A local experiment workbench built on Asyra. The initial domain is a single
robot workcell: geometric interference and clearance, not equipment control or
industrial safety certification.

**Development checkpoint, not R0.** The current workbench can edit a synthetic
six-axis model and geometric proxies, navigate in 3D, and Undo/Redo. Analytical
and continuous-time numerical kernels have owner tests; they are not yet a
complete user-facing experiment workflow. Do not use this checkpoint to approve
production operations. Saving, import, formal execution, comparison, and
distribution are still under development.

## Local development

Use the repository's declared Node.js 24 and Yarn 4.3.1 environment. Set
`APP_URL` in this App's `.env` from `.env.example`, or explicitly export it.
The Vite server and browser tests use the same local origin; there is no
parallel test URL.

From the repository root:

```sh
yarn workspace @asyra/asyra-sim dev
yarn workspace @asyra/asyra-sim test:local
yarn workspace @asyra/asyra-sim typecheck
yarn workspace @asyra/asyra-sim lint
yarn turbo run react:build --filter=@asyra/asyra-sim
yarn workspace @asyra/asyra-sim test:e2e
```

Build the workspace dependencies before starting a clean checkout. Browser
tests use an existing Google Chrome installation and one worker, with browser
temporary files inside this App's `.artifacts/`. They do not install browsers.
The current visual suite uses SwiftShader for reproducible WebGL evidence;
this is not a hardware-GPU performance certification. Screenshots and traces
are written to `test-results/` and are not committed.

## Architecture

The App-owned CUSTOM engine is composed before Core startup and renders through
the ordinary Core/Render/custom-layer path. Scene Tree and Props remain the
editable authority. The renderer and numerical methods share domain poses;
neither owns a second editable robot graph. No generic 3D Preset is enabled.

See the dedicated [App documentation](../../docs/ai/apps/asyra-sim/README.md),
[numerical contract](../../docs/ai/apps/asyra-sim/specs/numerical-method-v0.md),
and [release gates](../../docs/ai/apps/asyra-sim/release/FIRST_RELEASE.md).

We provide a trustworthy environment for executing experiments, not a guarantee
that users' experimental assumptions hold. Independent pilot acceptance and
all first-release gates are required before R0.
