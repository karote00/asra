---
name: app-visual-review-sync
description: Run synchronized app visual-review tests, generate screenshots from the same live app state the user sees, and inspect those screenshots before completion claims.
---

# Skill: app-visual-review-sync

## Trigger Signals

Use this skill when requests include:
- "app visual review"
- "final visual check"
- "screenshot passed"
- "product visual parity"
- "looks correct in the app"
- canvas/vector/rendering/geometry/stroke visual completion claims
- user-provided computed data that must be visually reviewed in an app

## Do Not Use When

- The task is pure documentation, data modeling, or non-visual backend logic.
- The requested validation is a unit-level geometry assertion with no final app rendering claim.
- The user explicitly asks to avoid running or inspecting the app.

## Required Inputs

- App name and target route.
- Live app base URL from the project-owned visual review env file.
- Review scenario and expected visual behavior.
- Visual test scope, when the user wants a subset instead of the default inferred scope.
- Any required runtime state, fixture, or computed data.
- Expected viewport, zoom, selection/editing state, and overlay visibility when relevant.

For Asyra Design:
- Use `ASYRA_DESIGN_APP_URL` as the single app and visual-review URL variable.
- Read it from `apps/asyra-design/.env` or an explicit shell override.
- Vite and Playwright resolve it through `apps/asyra-design/app-environment.mjs`.
- Do not introduce a parallel visual-review or Playwright base URL.

For future apps:
- Prefer one app-owned URL contract reused by the app server and its browser
  test/visual-review configurations.

## Preflight

1. Read the project-owned `.env` file for the target app.
2. Resolve the live app base URL from the app-specific app URL variable.
3. If the app-specific app URL variable is missing, stop and tell the user which variable/file is missing.
4. Confirm the URL is reachable before collecting screenshots.
5. Select the visual test scope before screenshots.
6. Record the selected scope, exact command, URL, and artifact directory.
7. Confirm whether screenshots include selection outlines, path-edit handles, rulers, panels, or other overlays.

## Visual Test Scope

When this skill is used, run the relevant app visual-review tests before screenshot inspection unless the user explicitly requests a narrower scope or no automated tests.

Supported scope levels:
- `all`: run all visual-review-related tests for the target app and scenario.
- `domain:<name>`: run a domain-specific visual suite, such as `domain:stroke`, `domain:stroke-canonical`, or `domain:drag-render`.
- `files:<patterns>`: run only explicit Playwright spec files or regex patterns.
- `screenshot-only`: skip automated E2E execution and only perform synchronized live-app screenshot capture plus agent screenshot inspection. Use this only when the user explicitly asks to avoid automated visual tests.

Default scope:
- If no scope is provided, infer the smallest complete visual-review suite that covers the completion claim.
- If the claim is broad baseline stroke correctness, run the full canonical stroke matrix.
- If the claim is a narrow regression fix, run the affected visual spec(s), the affected canonical case spec(s), and then inspect the generated screenshots/crops.
- If the task has no maintained visual E2E suite yet, create or update a formal project test before claiming completion; do not rely on a temporary screenshot-only check.

## Asyra Design Visual Test Commands

Always resolve `ASYRA_DESIGN_APP_URL` from `apps/asyra-design/.env` or an explicit shell override first.

Playwright reads that same value directly:

```bash
ASYRA_DESIGN_APP_URL="$ASYRA_DESIGN_APP_URL" \
yarn workspace @asyra/asyra-design test:e2e <scope> --reporter=line
```

Canonical stroke baseline scope:

```bash
ASYRA_DESIGN_APP_URL="$ASYRA_DESIGN_APP_URL" \
yarn workspace @asyra/asyra-design test:e2e e2e/stroke-canonical --reporter=line
```

This runs the 18 canonical stroke visual specs:
- Solid: `inside | center | outside` x `miter | bevel | round`
- Dashed: `inside | center | outside` x `butt | square | round`

Do not collapse these canonical cases into one long E2E test. Each canonical case should remain an independently runnable spec file.

## Deterministic Procedure

1. Run the selected visual test scope and record pass/fail output.
2. Confirm the tests produced deterministic screenshots/crops/metadata when the suite is expected to emit artifacts.
3. Load the real app route in a browser-driven app session.
4. Recreate or load the exact state under review.
5. If computed data was supplied, assert app runtime computed data matches it before taking screenshots.
   - Compare stable fields required for the review, including geometry, fills, strokes, stroke position, width, join, cap, opacity, and visible flags.
   - A screenshot from a nearby fixture is not evidence for the supplied computed data.
6. Capture screenshots from the live rendered app.
   - Use browser/app screenshots, not a standalone canvas/demo renderer, for final app review evidence.
   - Keep crop and viewport deterministic.
7. Save or report metadata:
   - base URL
   - selected visual test scope
   - test command
   - automated pass/fail result
   - artifact directory
   - viewport
   - zoom and selection/editing state
   - runtime object id or selected element id
   - computed data snapshot or hash
   - screenshot paths
8. Inspect the generated screenshots/crops before claiming completion.
9. Separate status labels:
   - `E2E passed` means automated assertions passed.
   - `agent screenshot review passed` means generated screenshots/crops were inspected and matched the expected visual behavior.

## Validation Matrix

- Base URL resolves from the app-specific variable and matches the user's live app target.
- Runtime state under screenshot matches the supplied scenario.
- Selected visual test scope covers the completion claim.
- Automated visual tests pass, unless `screenshot-only` was explicitly requested.
- Screenshots come from the real app rendering path.
- Metadata is sufficient to reproduce the review.
- Final answer distinguishes automated checks from agent screenshot inspection.

## Required Output Format

1. `Base URL`
2. `Visual Test Scope`
3. `Command`
4. `Runtime State`
5. `Screenshots`
6. `Screenshot Review`
7. `Remaining Differences`

## Guardrails

- Do not claim visual completion from Playwright pass/fail output alone.
- Do not claim app visual review from generated geometry data alone.
- Do not skip maintained visual-review E2E suites unless the user explicitly chooses `screenshot-only` or a narrower scope.
- Do not substitute a test renderer, helper canvas, or isolated packet renderer for the app.
- Do not invent a fallback base URL when the app-specific visual review variable is missing.
- Do not continue if the user's live app view and captured screenshot disagree; reconcile URL, build, viewport, zoom, runtime data, and overlay state first.
- Do not place transient review screenshots in durable plan artifacts unless the active plan or user explicitly requires durable evidence.

## Failure Policy

If review output does not match the user's live view:
- stop completion claims
- report the mismatch as a review-environment failure
- verify base URL, rebuild state, app route, viewport, zoom, selected element, and computed-data parity
- rerun screenshots only after the environment is synchronized

If runtime data cannot be asserted:
- label screenshots as visual-only evidence
- do not use them to prove computed-data parity
