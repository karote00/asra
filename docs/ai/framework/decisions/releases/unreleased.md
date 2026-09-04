## 2026-09-04 — Explicit Feature Runtime Quiescence

- Add an opt-in lifecycle boundary to close Feature admission, abort owned work,
  force provisional session rollback, drain actual handler promises and release
  Feature bindings/registrations. Timed-out promises remain drain obligations.
- A successor Feature generation requires successful disposal plus completion
  of other runtime owners by Core. Ordinary load, destroy, cancel and unregister
  retain their contracts. This is the first owner slice for the separately
  approved Asyra Sim App reset, not a standalone history-clear API.

## 2026-09-04 — Factory-Owned Complete Runtime Reset

- Add the next reset owner slice: Factory releases its transaction/history,
  custom registrations, owned observers and delivery evidence only while idle.
  It preserves the default transaction bridge and other Factory instances.
- This is one part of Core-orchestrated App reset, not permission to clear
  history during ordinary load. Active settlement rejects before mutation and
  channel cleanup failure cannot be treated as successful App reconstruction.
