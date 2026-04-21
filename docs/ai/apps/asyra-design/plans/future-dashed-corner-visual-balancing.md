# Future Feature: Dashed Corner Visual Balancing

## Role

This document records future product-semantic options for dashed strokes at
corners when strict arc-length allocation produces visually surprising but
geometrically valid results.

It is not a bugfix plan for the current dashed-center runtime.

## Why This Exists

Some dashed-corner cases are mathematically correct under pure arc-length
semantics, but still look visually incomplete to users.

The canonical example is:

- one visible dash spans a corner
- the post-turn remainder is extremely short
- stroke width is large relative to that remainder

In these cases, the corner can look like it is "missing a piece" even though
the geometry is faithfully following the authored dash interval.

This document records future feature directions for handling that product
problem explicitly, instead of misclassifying it as a geometry bug.

## Product-Semantic Trigger

This future-feature family becomes relevant when:

- the current geometry is correct under the approved dashed semantics
- visual tests and unit tests both confirm the result is semantically valid
- the remaining dissatisfaction is about user-facing appearance rather than
  implementation correctness

## Canonical Problem Shape

The key product tension is:

- `strokeWidth` is larger than, or much larger than, the post-turn visible
  remainder
- the incoming edge produces a large rectangular stroke band
- the post-turn continuation is too short to visually "balance" that incoming
  band

Examples:

- `strokeWidth = 10`, post-turn remainder `= 2.91`
- `strokeWidth = 50`, post-turn remainder `= 5`

The second example makes the tradeoff obvious:

- if nothing is changed, the result may look visually abrupt
- if too much is added, the dash semantics are no longer faithful to the
  authored pattern

## Candidate Product Directions

### Option 1. Corner-Aware Dash Redistribution

#### Meaning

The system is allowed to redistribute dash/gap lengths around corners so the
visible result looks more balanced.

This can mean:

- borrowing some length from the pre-turn portion
- borrowing from a nearby gap
- re-centering the dash around the corner

#### Strengths

- produces the smoothest visual result
- best at avoiding visually awkward short-carryover corners
- can make repeated orthogonal corners feel more intentionally designed

#### Costs

- changes authored dash semantics the most
- complicates seam-wrap, offset, and export parity
- may require redistribution rules across multiple corners, not just one

#### Best Fit

Choose this if the product goal is:

- corner aesthetics first
- exact arc-length fidelity second

### Option 2. Minimum Turn Extension

#### Meaning

The engine keeps normal arc-length allocation in general, but when a dash
crosses a corner and the post-turn remainder is too short, the turn is granted
some minimum extension.

This is a local rule, not full redistribution.

Possible policies include:

- minimum continuation length measured in px
- minimum continuation length measured relative to stroke width
- minimum continuation length measured relative to local corner geometry

#### Strengths

- narrower scope than full redistribution
- easier to describe, benchmark, and test
- directly targets the "short carryover looks broken" problem

#### Costs

- still changes authored dash semantics locally
- needs a clear source for the extra length:
  - steal from the same dash
  - steal from the adjacent gap
  - add local corner-only compensation
- can become ambiguous when `strokeWidth >> remainder`

#### Important Limit

This option covers the case you raised:

- `strokeWidth = 50`
- post-turn remainder `= 5`

But it does not solve the product decision by itself. It only makes the trade
explicit:

- if we extend too little, the corner still looks abrupt
- if we extend too much, the dash stops resembling the authored interval

So yes, your example is inside this option, but it also shows why this option
still requires a product threshold decision.

### Option 3. Visual Balancing Over Pure Arc-Length Fidelity

#### Meaning

This is not a single algorithm. It is the product philosophy that authorizes
Options 1 or 2.

It says:

- when exact arc-length fidelity and visual stability conflict
- the product may choose the more visually balanced result

This philosophy could be realized through:

- corner-aware redistribution
- minimum turn extension
- seam balancing
- local corner compensation

#### Strengths

- gives the clearest product direction
- prevents repeated confusion where correct geometry is mistaken for a bug
- allows future features to share the same appearance philosophy

#### Costs

- requires a formal product decision
- affects testing, export expectations, and parity rules
- needs a clear statement of when visual balancing is allowed and when strict
  fidelity still wins

## Relationship Between The Options

- Option 1 is the most aggressive implementation strategy.
- Option 2 is the most targeted implementation strategy.
- Option 3 is the product philosophy that can justify either Option 1 or
  Option 2.

## Recommended Future Evaluation Order

1. decide whether the product wants visual balancing at all
2. if yes, prototype Minimum Turn Extension first
3. only consider Corner-Aware Dash Redistribution if the simpler extension rule
   still looks inadequate

## Required Future Deliverables Before Implementation

If any of these options are adopted later, the work must start with:

1. a dedicated Scenario Axis Document
2. explicit product semantics for:
   - short carryover
   - large stroke-width vs tiny remainder
   - seam-wrap interaction
   - shape-generated vs vector-generated equivalence
3. unit tests for the new allocation / compensation rules
4. visual benchmarks proving the product improvement

## Current Project Status

These options are not part of the current promoted dashed-center semantics.

The current engine remains:

- arc-length driven
- corner-accurate under the approved scenario families
- product-correct unless a future semantics decision explicitly changes it
