---
name: app-visual-review-sync
description: Verify final app visual review against the same live app state the user sees, including base URL synchronization, runtime computed-data parity, screenshots, and manual inspection before completion claims.
---

# Skill: app-visual-review-sync

## Trigger Signals

Use this skill when requests include:
- "app visual review"
- "final visual check"
- "screenshot passed"
- "Figma parity"
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
- Any required runtime state, fixture, or computed data.
- Expected viewport, zoom, selection/editing state, and overlay visibility when relevant.

For Asyra Design:
- Use `ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL` as the app-specific base URL variable.
- Read it from `apps/asyra-design/.env` or an explicit shell override.
- Do not use the older non-app-specific visual review base URL variable.

For future apps:
- Use the pattern `ASYRA_<APP_NAME>_VISUAL_REVIEW_BASE_URL`.
- The app name segment must identify the product, for example `DESIGN`.

## Preflight

1. Read the project-owned `.env` file for the target app.
2. Resolve the live app base URL from the app-specific visual review variable.
3. If the app-specific visual review variable is missing, stop and tell the user which variable/file is missing.
4. Confirm the URL is reachable before collecting screenshots.
5. If Playwright still requires a generic base URL, set it from the same value:
   - `PLAYWRIGHT_TEST_BASE_URL="$ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL"`
6. Record the exact command and URL used.
7. Confirm whether screenshots include selection outlines, path-edit handles, rulers, panels, or other overlays.

## Deterministic Procedure

1. Load the real app route in a browser-driven app session.
2. Recreate or load the exact state under review.
3. If computed data was supplied, assert app runtime computed data matches it before taking screenshots.
   - Compare stable fields required for the review, including geometry, fills, strokes, stroke position, width, join, cap, opacity, and visible flags.
   - A screenshot from a nearby fixture is not evidence for the supplied computed data.
4. Capture screenshots from the live rendered app.
   - Use browser/app screenshots, not a standalone canvas/demo renderer, for final app review evidence.
   - Keep crop and viewport deterministic.
5. Save or report metadata:
   - base URL
   - test command
   - viewport
   - zoom and selection/editing state
   - runtime object id or selected element id
   - computed data snapshot or hash
   - screenshot paths
6. Inspect the screenshots manually before claiming completion.
7. Separate status labels:
   - `E2E passed` means automated assertions passed.
   - `manual app visual review passed` means screenshots were inspected and matched the expected visual behavior.

## Validation Matrix

- Base URL resolves from the app-specific variable and matches the user's live app target.
- Runtime state under screenshot matches the supplied scenario.
- Screenshots come from the real app rendering path.
- Metadata is sufficient to reproduce the review.
- Final answer distinguishes automated checks from manual visual inspection.

## Required Output Format

1. `Base URL`
2. `Command`
3. `Runtime State`
4. `Screenshots`
5. `Manual Visual Review`
6. `Remaining Differences`

## Guardrails

- Do not claim visual completion from Playwright pass/fail output alone.
- Do not claim app visual review from generated geometry data alone.
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
