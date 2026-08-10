# Executable Public Examples

This directory is the tested source of truth for Asyra documentation examples.
It demonstrates Framework composition, optional Preset capabilities, and
app-owned domain behavior without treating Asyra as only a canvas or design
tool framework.

## Run an example

```bash
yarn examples:run core-information-model
```

Use any stable ID from the maintained suite:

- `core-information-model`
- `preset-2d-minimal`
- `preset-selective-defaults`
- `custom-component-schema`
- `feature-session-undo`
- `app-versioned-load-migration`
- `custom-render-boundary`
- `collaboration-two-memory-actors`
- `ai-registered-action`
- `app-retrieval-action`
- `generated-design-app-extension`

The first ten sources live here. The generated-app extension is maintained at
`apps/asyra-design/examples/review-queue-extension.mjs` and is copied into the
`create-asyra-design-app` template by the official release generator.

## Verify public artifacts

```bash
yarn examples:verify
```

This builds and packs all 19 public packages, installs them into a clean
consumer without workspace links, type-checks the public migration surface,
and executes all 11 examples. Final release validation repeats the same source
against registry-only packages after publication.

## Documentation and website handoff

`inventory.json` is generated from package manifests and tested source regions:

```bash
yarn examples:inventory
yarn examples:inventory:check
```

Documentation and the website must consume that inventory or link to its
sources. They must not hand-copy snippets, own package versions, or create
untested variants. Headless Core and Core Kernel remain future roadmap work;
these examples use the currently supported browser/Core composition and do not
claim a public headless lifecycle.

Research sketches and obsolete pseudo-code belong under `../internal/`, not in
this supported-example surface.
