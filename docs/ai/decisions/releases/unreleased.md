# Unreleased Cross-Cutting Decision History

Decision log for repo-wide decisions not yet captured in a release snapshot.

Append-only rule: do not edit/delete prior entries; add a superseding entry when decisions change.

## 2026-02-28 - Adopt global decision-history standard across framework and apps

- Context:
  - Decision history started in framework docs and needs to scale to app repos/modules consistently.
- Decision:
  - Define one global history standard in `docs/ai/decisions/*`.
  - Keep scope logs in:
    - framework: `docs/ai/framework/decisions/releases/*`
    - app: `docs/ai/apps/<app>/decisions/releases/*`
    - cross-cutting: `docs/ai/decisions/releases/*`
  - Use append-only history contract across all scopes.
- Consequences:
  - New contributors can trace rationale at framework and app levels with one consistent model.
  - Cross-scope architectural/governance decisions have a dedicated home.
- Related Scope Docs:
  - `docs/ai/decisions/README.md`
  - `docs/ai/framework/decisions/README.md`
  - `docs/ai/apps/asyra-design/decisions/README.md`
- Related Commit(s):
  - pending

## 2026-03-03 - Selection ownership converged on multi-channel SelectionManager contracts

- Context:
  - Framework and Asyra Design app had mixed selection ownership between SelectionManager and app-owned vector point state.
  - Delete/path-editing feature work required deterministic cross-package selection contracts.
- Decision:
  - Converge on channel-first selection ownership for `ELEMENT`, `VECTOR_POINT`, and `VECTOR_SEGMENT`.
  - Keep app `selectedVectorPoint` as a compatibility mirror during migration, not source-of-truth.
  - Remove legacy `VERTEX` selection naming/contracts.
- Consequences:
  - Framework/app boundaries are clearer: selection state ownership is unified in SelectionManager channels.
  - Feature/UI/render state propagation now follows one subscription model across packages.
