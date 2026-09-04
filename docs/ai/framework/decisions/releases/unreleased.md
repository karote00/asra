## 2026-09-04 — Explicit Feature Runtime Quiescence

- Add an opt-in lifecycle boundary to close Feature admission, abort owned work,
  force provisional session rollback, drain actual handler promises and release
  Feature bindings/registrations. Timed-out promises remain drain obligations.
- A successor Feature generation requires successful disposal plus completion
  of other runtime owners by Core. Ordinary load, destroy, cancel and unregister
  retain their contracts. This is the first owner slice for the separately
  approved Asyra Sim App reset, not a standalone history-clear API.
