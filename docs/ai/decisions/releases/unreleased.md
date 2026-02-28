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
