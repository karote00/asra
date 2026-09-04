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

## 2026-09-04 — Retire Scene State and Prepared Artifacts Together

- Complete runtime reset invalidates Scene Tree's old prepared artifacts as
  well as clearing live/deleted elements and relations. Every retained computed
  lifecycle hook receives cleanup, and failures block successful reconstruction.
- Props, component definitions and other Scene Tree instances remain separate
  owners. Ordinary load and legacy disposal keep their existing contracts.

## 2026-09-04 — Retire Property Instances and Prepared Artifacts Together

- Complete runtime reset rejects active canonical batches, attempts every
  component cleanup and invalidates all prepared artifacts while clearing the
  property graph. Cleanup failure retires state but blocks reconstruction.
- Property type definitions remain composition-owned. Ordinary load and legacy
  disposal keep their contracts; this handoff is not an App-side reset shortcut.

## 2026-09-04 — Retire Selection Channels at Complete Runtime Reset

- Selection Manager owns disposal and removal of old channel instances without
  publishing selection mutations. New composition registers new instances;
  cleanup errors block successful reconstruction rather than hiding partial
  termination. Ordinary clear/unregister semantics are unchanged.

## 2026-09-04 — Retire Managed State and Observable Lifetimes

- Complete System Context reset invalidates old validated loads, removes
  managed-property registrations and completes every observable. It reports
  completion failures after attempting all resources, preserving Core's
  fail-closed reconstruction rule. Ordinary validation is unchanged.

## 2026-09-04 — Retire Derived UI State Without Destroying Sources

- UI Context reset owns managed UI observables and acquired source bindings,
  not caller-owned sources or canonical state. It retires registrations and
  attempts all unsubscribe/completion hooks before reporting failure.

## 2026-09-04 — Retire Input Attachments and Callback Generations

- Complete Input reset invalidates old browser/timer callbacks, attempts all
  listener removals and clears runtime mappings/transient state. This prevents
  retained A callbacks from dispatching B commands after reconstruction.
  Ordinary reset/dispose attachment behavior remains unchanged.

## 2026-09-04 — Retire Render Instance Resources and Callback Generations

- Complete Render reset is separate from ordinary retryable disposal. It
  requires idle initialization/frame work, attempts all owned cleanup and
  retires viewport/layer/provider state while fencing old frame, engine and
  pointer callbacks. Failure blocks Core reconstruction.
- Shared projection/interaction/strategy registrations remain separate owners;
  this instance API is not a global renderer reset or App reset by itself.

## 2026-09-04 — Explicit Shared Projection Runtime Handoff

- Shared projection/selection/interaction state retires only after visual
  ownership is released. Pending microtasks and retained layer callbacks are
  generation-bound; Core explicitly reinstalls projection wiring after every
  old runtime owner finishes. Strategy definitions remain composition-owned.

## 2026-09-04 — Terminal Registration Cleanup Without Reopening Composition

- The coordinating owner may retire a registration graph after canonical state
  cleanup. This releases remaining resources without relation rewrites or
  unlocking ordinary mutations. All cleanup is attempted; failures and success
  are terminal, and completed resources are never repeated.
- New composition uses a new graph. Ordinary unregister keeps its active-use,
  composition-lock and retry contracts.

## 2026-09-04 — Explicit Core Runtime Handoff

- App replacement now has a terminal Core lifecycle, distinct from ordinary
  load and destroy. Core waits for real work, coordinates public owner cleanup,
  retires its subscriptions and composition resources, and returns a fresh
  unstarted Core only on success. Default export handoff is a live binding.
- Core/Feature execution and cleanup handles are lifetime-scoped. Delivery keeps
  original payload/batch identity and order; internal callback wrappers are not
  a public identity guarantee. Composition cleanup is retained through a
  neutral Core API, without a Core dependency on Preset or App internals.

## 2026-09-05 — Retain Successful Preset Installation Cleanup

- Preset hands successful installation cleanup to the neutral Core lifecycle.
  Complete reset releases its remaining subscriptions and resources after
  canonical/graph retirement, without unlocking old composition or changing the
  frozen apply result. A fresh Core may apply again.
- Failed-apply rollback/retry and legacy adapter behavior remain unchanged.
  Missing lifecycle support is not a complete-replacement guarantee.

## 2026-09-05 — Preflight Canonical Load Before Runtime Retirement

- Core exposes the existing load preparation checks without package apply or
  load notifications. App replacement can reject an invalid target before
  terminating the current document, without duplicating canonical validation.
- The preflight result is detached diagnostic data, not an artifact for another
  Core. Schema recovery and ordinary load semantics remain unchanged; trusted
  migration hooks must be pure and successor load validates again.
