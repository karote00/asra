# Stroke Engine Manual QA Checklist

This checklist defines what manual product testing may cover during the current
uniform-width stroke rollout.

Do not treat blocked/future scenarios as product regressions unless the support
matrix says they are supported.

## Setup

Use a fresh app session after preset runtime changes.

If app behavior looks stale:

- run `yarn workspace @asyra/preset build:preset`
- restart the app/dev server
- rerun the matching E2E before manual retest

## Center Solid

### Rectangle

Test:

- create rectangle
- set stroke style `solid`
- set position `center`
- vary width
- switch join: `miter`, `bevel`, `round`

Expected:

- stroke remains visible
- width changes visible thickness
- miter fills sharp corner
- bevel cuts corner
- round curves corner without miter spike

### Open Vector

Test:

- create open vector line
- set stroke style `solid`
- set position `center`
- switch cap: `butt`, `square`, `round`

Expected:

- butt ends at endpoint
- square extends past endpoint with square terminal
- round extends past endpoint with rounded terminal

## Center Dashed

### Rectangle / Closed Vector

Test:

- create rectangle or simple closed vector
- set stroke style `dashed`
- set position `center`
- set dash/gap
- change dash offset
- switch join: `miter`, `bevel`, `round`

Expected:

- dash/gap alternates along the path
- dash offset moves visible/gap regions
- miter/bevel/round corner differences are visible when a dash spans a corner
- switching join must not make stroke disappear

### Open Vector

Test:

- create open vector line
- set stroke style `dashed`
- set position `center`
- switch cap: `butt`, `square`, `round`

Expected:

- dash pattern remains visible
- butt/square/round terminals differ
- round cap produces rounded dash terminals

## Inside / Outside Dashed

### Closed Rectangle

Test:

- create rectangle
- set stroke style `dashed`
- start from position `center`
- switch to `inside`
- switch to `outside`
- switch back to `center`

Expected:

- stroke does not disappear
- inside is constrained to the inner band
- outside is constrained to the outer band
- center returns to center placement

### Simple Closed Vector

Test:

- create a simple closed vector
- set stroke style `dashed`
- use dash/gap with repeated intervals
- switch position `center` -> `inside` -> `outside`

Expected:

- valid closed single-network vectors remain visible
- supported constrained placement appears for promoted topology families
- unsupported topology should fail visibly only if support matrix marks it
  supported

## Do Not Use As Completion Evidence Yet

These are not completion evidence in the current rollout:

- open vector exact inside/outside placement
- self-intersecting constrained vector semantics
- multi-network constrained vector semantics
- variable width
- gradient stroke paint correctness
- shadow behavior

## Bug Report Template

When reporting a manual failure, include:

- element type
- open/closed topology
- stroke style
- stroke position
- width
- dash/gap/offset
- join type
- cap type
- whether it disappears, renders in wrong place, or renders with wrong shape
- whether a restart after `build:preset` changed the result
