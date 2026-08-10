# Extend Asyra with an AI coding agent

Asyra is designed so a product owner and an AI coding agent can work together:
you define the domain outcome and boundaries; the agent follows public
Framework contracts, existing app patterns, and executable proof.

AI assistance does not make ownership optional. An agent should never invent a
second state store, mutate a package owner directly, bypass a Feature or
transaction, expose a server credential, or treat a future roadmap API as if
it already exists.

## Give the agent a bounded task contract

Include these facts in each request:

1. **Outcome** — one observable product behavior, stated in app-domain terms.
2. **Owner** — the app module, Feature, schema, or adapter allowed to change.
3. **Canonical route** — the public Core/common API and transaction boundary
   that owns the write.
4. **Composition** — which optional Preset, Render, Collaboration, or AI
   capabilities are active and which are absent.
5. **Proof** — the exact unit, integration, type, build, or E2E behavior that
   must pass.
6. **Exclusions** — private imports, duplicate state, UI-only fixes, fallback
   output, secrets, and unrelated refactors.

A useful request is concrete: “Add an app-owned review status to the generated
Asyra Design app. Reuse the existing common API and one transaction, add a
formal test, keep collaboration and AI optional, and do not change Framework
packages.”

## Start from maintained evidence

For a generated app extension, use the verified
[`generated-design-app-extension`](../../../apps/asyra-design/examples/review-queue-extension.mjs)
example as the implementation shape. For Framework composition, choose the
closest entry in the [executable example inventory](../../examples/README.md)
and tell the agent to link or extend that evidence rather than copying an
untested variant into documentation.

The agent should inspect current public entrypoints and declarations before
naming an API. Package-private imports such as `@asyra/package/src/...` and
cross-package relative paths are not supported consumer contracts.

## Keep AI-created content canonical

When AI creates or edits product information at runtime, register bounded
actions through `@asyra/ai-agent-runtime`, check app-owned permission or
confirmation, enter the same Feature/common-API route a person uses, and commit
one intended transaction. That keeps the result editable, reversible,
collaborative, and persistable through the ordinary owner model.

See [Build registered AI actions](../build/ai-actions.md) and
[Build app-owned retrieval and action](../build/app-retrieval-action.md). Do not
send provider keys to the browser or let generated code call an unregistered
mutation surface.

## Review the result

Before accepting an AI-authored change, verify:

- the app-domain outcome is represented in a schema or product contract;
- public package imports are used;
- one intended action produces one intended undo commit;
- failure rolls back or returns the declared error;
- disabled optional systems remain genuinely absent;
- load, collaboration, and AI routes do not create alternate canonical owners;
  and
- focused tests, typecheck, lint, and the relevant build pass.

## Canonical sources

- [Framework workflow](../../ai/framework/WORKFLOW.md)
- [Asyra Design golden paths](../../ai/apps/asyra-design/golden-paths/README.md)
- [Verified generated-app extension](../../../apps/asyra-design/examples/review-queue-extension.mjs)

## Next

- [Learn canonical state ownership](../learn/canonical-state.md)
- [Build a transaction-safe Feature](../build/feature-session.md)
