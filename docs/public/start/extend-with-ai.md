# Extend Asyra with an AI coding agent

Asyra is designed so a product owner and an AI coding agent can work together:
you define the domain outcome and boundaries; the agent follows public
Framework contracts, existing app patterns, and formal product tests.

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

## Where this runs

The collaboration with an AI coding agent happens in your generated app
repository. The agent should edit the app-owned Feature, schema, common API,
adapter, UI, and tests named by your task contract. Framework package source is
outside that boundary unless you are intentionally developing the Framework.

## Implementation

Give the agent an app-owned public boundary before asking it to connect UI or
AI behavior. For example, this Feature exposes one review-domain action:

```ts
import { defineFeature } from '@asyra/core'

type ReviewState = 'pending' | 'approved'
const state = new Map<string, ReviewState>([['review-1', 'pending']])

export const reviewActions = defineFeature('app.reviewActions', undefined, {
  priority: 30,
  exclusive: true,
  api: {
    setStatus(id: string, status: ReviewState) {
      if (!state.has(id)) throw new Error(`Unknown review: ${id}`)
      state.set(id, status)
      return { id, status }
    }
  }
})
```

In a real document-backed feature, the body calls the generated app's common
API so Factory can own the transaction and Undo evidence. Ask the agent to
reuse that route instead of preserving the illustrative local `Map`.

## Flow

1. You state the observable domain outcome and mutation owner.
2. The agent finds the maintained app Feature and common API that already own
   the closest behavior.
3. It adds or extends one typed API, then connects UI or AI intent to it.
4. Formal tests prove success, rejected input, rollback, and disabled optional
   systems.
5. You review the product behavior and ownership boundary before accepting the
   change.

## Expected result

The change reads like an ordinary app feature: the same canonical API serves a
person, an automation, or an AI action; invalid work produces no partial
state; and removing an optional provider does not change the document owner.

## Start from maintained contracts

For a generated app extension, start with
[Create a complete design app](create-design-app.md) and the closest existing
Feature in `src/features`. For Framework composition, choose the closest task
guide in this documentation and ask the agent to preserve its owner, flow,
failure behavior, and public API boundary.

The agent should inspect current public entrypoints and declarations before
naming an API. Package-private source imports and cross-package relative paths
are not supported consumer contracts.

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
- [Generated Feature registry](../../../create-app/asyra-design/template/src/features/index.ts)

## Next

- [Learn canonical state ownership](../learn/canonical-state.md)
- [Build a transaction-safe Feature](../build/feature-session.md)
