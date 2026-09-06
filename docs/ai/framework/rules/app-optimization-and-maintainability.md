# Rule: App Optimization and Maintainability

## Scope and Principle

This rule applies to new apps and to authorized feature, refactor, and
performance work in existing apps. Apply it from the first implementation
slice, not after a user reports lag or a PR exposes an unmaintainable layout.
It does not authorize repository-wide cleanup or migration of untouched apps;
[bounded task scope](bounded-task-scope-and-closure.md) remains authoritative.

Learn concepts from established apps such as Asyra Design and Asyra Sim:
explicit ownership, localized updates, lifecycle safety, and measured work.
Do not copy their directory trees, providers, 2D/3D assumptions, server layers,
or caches merely because those apps already use them. Choose the smallest
structure that fits the new app's actual product and runtime contracts.

## 1. Design the Boundaries Before Implementation

Before the first relevant slice, identify:

- the canonical owner and the existing Feature/API path for each user action;
- authoritative data versus derived read projections and transient UI state;
- which inputs change frequently and which views or computations depend on them;
- the intended update, transaction, and document/runtime replacement boundaries;
- the formal cases and measurements that will verify those boundaries.

Keep enduring decisions in the app's existing architecture/spec documents.
A short explanation in the bounded task contract is enough for a small change;
do not create extra plans, matrices, or audit ledgers to satisfy this rule.
Preserve applicable Inspector contracts rather than inventing another owner.

## 2. Organize by Responsibility, Not by Another App's Folder Names

- Keep the app entry and workbench shell focused on composition.
- Group related views, controllers, helpers, and tests by product responsibility.
  Split independently changing or independently testable concerns; do not use
  an arbitrary file length or a single-component-per-file quota as the design.
- Keep canonical runtime calls, asynchronous orchestration, persistence, and
  network access in their owning controller or API/adapter module. Keep reusable
  calculations and validation helpers out of large TSX views. Small local input
  handlers may stay beside their controls.
- Create API, feature, or shared folders only when those responsibilities exist.
  Do not add empty scaffolding, one-line forwarding layers, or a catch-all
  utility module merely to make the tree look architectural.
- Controllers dispatch existing Features and approved APIs. They are not a
  second canonical model, transaction manager, or validation authority.
- Reuse an existing shared contract when it is genuinely equivalent. Promote
  app code into Framework or Preset only with demonstrated reusable semantics
  and an authorized ownership change, not speculative future requirements.

## 3. Isolate Actual Updates

Splitting a file does not isolate rendering or computation. Verify the data and
subscription boundary, not just the component tree.

- Establish UI update boundaries through state ownership, fine-grained
  subscriptions, and component composition. Do not wrap app UI components in
  `React.memo`, `memo`, `PureComponent`, or equivalent props-comparison wrappers
  to manage these boundaries. Do not build `useMemo`/`useCallback` chains merely
  to keep such component wrappers effective.
- Subscribe where the value is consumed. Filter notifications by the relevant
  property, entity, or semantic projection before scheduling consumer updates,
  rather than broadcasting a whole-document change and comparing child props
  afterward. Keep unchanged projections stable under the owner's contract;
  do not clone or retain a second editable model for this purpose.
- Keep composition above frequently changing local state when siblings do not
  depend on that state. A component can still render when its own inputs change;
  the goal is to prevent unrelated work at its source, not to suppress React
  rendering indiscriminately.
- Pass only the fields a child consumes. Do not pass an entire runtime snapshot,
  controller result, or changing context object to every child for convenience.
- Keep high-frequency presentation state, such as camera movement or playback,
  in the smallest owning subtree. Do not make unrelated panels, canonical reads,
  geometry preparation, or retained-result indexing follow every frame.
- Subscribe or project according to the authoritative change contract. A panel
  toggle or unfinished form draft must not recapture an unchanged document just
  because its parent rendered. Refresh on every relevant revision, identity,
  selection, or configuration change; never skip necessary invalidation.
- Keep unfinished input text and explicitly authored experiment drafts separate
  from canonical state. Do not create an editable document copy to reduce renders.
- Retained callbacks must use current committed inputs. Changing one field must
  not overwrite a newer edit in another field; Undo/Redo and replacement must
  still project the authoritative state.
- Use the existing runtime/render scheduler. Coalescing presentation work must
  preserve required input deltas and action semantics, not silently drop edits.
- Clean up subscriptions, observers, animation callbacks, and asynchronous work
  at their owning lifetime boundary. Reject late results from a retired document.

## 4. Optimize Measured Work Without Weakening Correctness

[Computation Ownership and Data Reuse](computation-ownership-and-reuse.md)
owns the project-wide work-lifetime contract: trace actual caller work before
implementation, consume valid completed artifacts, justify retained data, and
test work counts together with correctness and invalidation. Apply it to the
affected app path, not only to its React components.

- Measure the affected normal product path before choosing an optimization.
  Use render/read/allocation counts for deterministic work boundaries and
  profiling for time or memory costs. UI component memoization is not an
  architectural optimization path under this rule.
- Fix broad subscriptions, redundant reads, repeated scans, and unstable inputs
  at their first responsible owner before adding retained state around them.
- Algorithmic and derived-data caches are distinct from component memoization;
  they follow the shared rule's profiling, validity, and lifetime requirements.
- Projection equality must follow its semantic change contract. Do not relocate
  a large props comparator into a subscription helper, or deep-compare/serialize
  an entire document or mesh on every interaction merely to skip a render.
- Localized updates must preserve fresh callbacks, validation, errors, geometry,
  numerical meaning, and transaction behavior. Reduced fidelity, hidden failures,
  stale results, or fixture-specific shortcuts are not performance fixes.
- For Inspector-governed caches, follow
  [Inspector step execution](inspector-step-execution.md#performance-and-cache-work):
  profiling and exact equivalence evidence are required; this rule grants no
  new cache owner or dimensions.

## 5. Keep Styling and Source Readable

- Use Tailwind utilities for new or refactored web-app component styling.
  Native/non-web UI follows its platform's styling system instead.
- Keep CSS limited to shared base/native-control defaults, theme tokens, or a
  concrete integration requirement that utilities cannot reasonably express.
  Document that requirement locally; do not recreate a parallel component CSS
  system or hide it in large component-level `@apply` blocks.
- Keep dynamic values such as calculated coordinates in explicit style values
  or CSS custom properties when needed; avoid unresolvable dynamic utility names.
- Keep theme choices centralized and preserve supported light/dark modes,
  focus visibility, overflow handling, and responsive layout contracts.
- Separate logical TSX sections, conditional siblings, and statement groups with
  blank lines. Wrap long prop lists and utility strings. Extract meaningful
  sections or helpers instead of compressing multiple concerns onto a few lines.
- Follow repository formatting rather than introducing a competing formatter.
  Tailwind adoption does not waive dependency-installation approval rules.

## 6. Prove the Boundary Before Calling the Slice Complete

- For an existing bug or performance regression, first prove that a formal test
  detects it, strengthening the test before implementation when necessary.
  Follow [bugfix test-first](bugfix-test-first.md).
- For new interactive work, include permanent, owner-scoped tests for the
  relevant update boundary. For example: changing one row refreshes that row,
  unrelated controls retain their view, relevant inputs still refresh, and a
  retained callback preserves the latest values in other fields.
- Test the relevant subscription notifications, reads, and computations as well
  as rendering. A passing render count must not merely show that a memo wrapper
  hid an unchanged broad notification or document-recapture problem.
- For recurring computation and shared results, satisfy the
  [work-and-correctness gate](computation-ownership-and-reuse.md#4-prove-work-and-correctness-together),
  including the normal caller's construction lifetime when helper tests alone
  could conceal repeated preparation.
- Verify the affected lifecycle cases: invalid input, sequential edits,
  Undo/Redo, cancellation, and document/runtime replacement as applicable.
- Exercise representative workloads, not just an empty screen. Keep heavy tests
  bounded, preserve resource guards, and run them at the defined slice milestone.
- For layout/style changes, run the relevant real-app browser tests and inspect
  the resulting screenshots in the supported modes and viewport sizes.
- Report before/after evidence and its environment. Fewer renders, green tests,
  or software-rendered screenshots do not by themselves prove a hardware FPS
  guarantee. Do not rely on the user to discover missing update boundaries.

The completion gate is the scoped behavior and evidence, not the number of
folders, extracted components, memo hooks, or passing screenshots.
