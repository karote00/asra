# Rule: Geometry Clipping Regression Contract

This rule defines the required execution contract for geometry/clipping fixes in Asyra Design, especially for dashed stroke geometry and ownership/cutting work.

## Non-Negotiable Rules

- Do not use workaround logic.
- Do not use sample-specific or screenshot-specific special cases.
- Do not route all geometry through a helper just because it is the latest phase.
- Do not stop after writing tests if the main runtime path is not fully wired.
- Do not create or use temp files outside the repository.

## Required Workflow

Every geometry/clipping fix must follow this order:

1. Analyze the first corrupted stage.
2. Write tests that define success/completion.
3. Narrow helper scope with explicit entry conditions.
4. Wire the fix back into the main runtime path.
5. Run visual validation.
6. If visual validation fails, automatically loop back to step 1.

Do not stop in the middle and report partial progress as if the fix is complete.

## Required Test Matrix

Before implementation lands, the change must have all applicable test layers:

1. Visible behavior test
- Target the actual user-visible regression hotspot.
- Prefer direct phase/output behavior over helper snapshots.

2. Helper entry-condition test
- Define when the helper must run.
- Define when the helper must not run.
- If a helper changes geometry, its entry condition must be explicit and tested.

3. Nearest non-regression test
- Add the closest known hotspot that must remain unchanged.
- This must be chosen from the same geometry family when possible:
  - sharp corner
  - seam
  - segment transition
  - smooth high-curvature

4. Performance guard
- If the change adds geometry solving, clipping, union, or local cleanup work, add or update a performance guard.
- A fix that restores correctness but causes broad runtime slowdown is not complete.

5. Render/visual validation
- Run render-level tests for the affected sample.
- If the issue is visual and unit tests are indirect, a render-level oracle is required.

## Helper Design Contract

Every helper in the clipping path must satisfy all of these:

1. Explicit entry conditions
- The helper must state what geometry is eligible.
- If the helper is not eligible, it must no-op and return control immediately.

2. Narrow geometry ownership
- `phase2` source/candidate helpers should only mutate candidate/source geometry.
- `phase6` helpers should only process geometry that truly requires final assembly/cutting.
- `passthrough` geometry must not be processed by clipping helpers unless a tested rule explicitly requires it.

3. No blanket phase passes
- It is invalid to send all closed paths, all inside strokes, all phase6 polygons, or all passthrough candidates through a helper without a narrower tested condition.

4. No identity-by-position assumptions
- Do not key behavior off “first dash”, “last dash”, “top hotspot”, or similar positional shortcuts.
- Rules must be derived from geometry/state contracts, not from visual location assumptions.

5. Stage correctness first
- Fix the earliest stage that actually corrupts geometry.
- Do not add a later repair layer when the corruption already exists earlier in the pipeline.

## Benchmark Definition Rule

A benchmark is only valid if it defines all three:

1. the exact preserved behavior
2. the exact scope where the rule is allowed to act
3. the exact nearby behavior that must remain unchanged

If any of these are missing, the benchmark is incomplete.

## Completion Criteria

A geometry/clipping fix is complete only when all of the following are true:

- the visible regression test passes
- the helper entry-condition test passes
- the nearest non-regression test passes
- render/visual validation passes
- performance guards pass
- the fix is wired into the real runtime path

If one hotspot is fixed but another nearby hotspot regresses, the fix is not complete.
