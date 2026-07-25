# Supported Examples

This directory contains examples that are linked from current framework
contracts and backed by executable checks:

- `app-owned-versioned-load-migration.mjs` demonstrates app-owned load
  migration; its `.test.cjs` and `.type-test.ts` companions validate the
  supported contract.
- `network-collaboration-transport.mjs` demonstrates the public optional
  collaboration composition and is exercised by the Collaboration package
  documentation test.
- `ai-agent-runtime.mjs` demonstrates registered schema-backed action
  execution through a deterministic replaceable provider, with no endpoint or
  API key; the AI Agent Runtime package documentation test executes it.

Research sketches and obsolete pseudo-code belong under `../internal/`, not in
this supported-example surface.
