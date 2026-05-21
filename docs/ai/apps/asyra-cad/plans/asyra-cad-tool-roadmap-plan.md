# Asyra CAD Tool Roadmap Plan

## Context

Asyra CAD is a future CAD-like canvas tool built on the Asyra framework. It is
not currently an active implementation, so this app context records roadmap-level
planning until the product has source code, app essentials, architecture,
workflow, and decision-history documents.

The tool target discussed here is a mechanical authoring and animation editor:
- draw or create 3D parts
- combine parts into assemblies
- configure simple mechanical motion
- play animations
- optionally detect part collisions during motion
- optionally use an AI agent layer to create or modify models through structured
  app actions

Asyra should provide the application framework skeleton:
- deterministic state flow
- feature/session execution
- component and property registration
- schema validation
- transaction boundaries
- undo/redo
- persistence hooks
- render-engine abstraction
- collaboration-compatible mutation paths

Asyra should not try to become a full 3D renderer, physics engine, or industrial
CAD kernel. Those capabilities should be app-owned modules or external engines
connected through framework-safe boundaries.

## Product Goal

Build a credible CAD-like 3D tool that can prove Asyra supports professional
canvas-tool domains beyond 2D design editing.

The first credible product result is not a SolidWorks/Fusion 360 replacement. It
is a focused mechanical animation editor where users can:
- place basic 3D parts
- select and transform parts
- build parent/child assemblies
- configure simple motion
- play the motion in a 3D viewport
- save/load the scene
- undo/redo authoring operations
- later enable collision detection and inspection

The roadmap should keep the tool modular enough that physics, AI, mesh import,
advanced CAD geometry, and collaboration hardening can be added without
rewriting the non-physics MVP.

## Scope Boundaries

In scope for the roadmap:
- 3D renderer adapter integration
- 3D viewport controls
- basic primitives and imported mesh parts
- assembly tree and transform hierarchy
- selection and transform gizmos
- keyframe animation and playback
- simple constraints/joints
- collision detection and collision reporting
- optional AI-assisted action planning
- undo/redo and persistence integration
- basic collaborative mutation compatibility

Out of scope for the early MVPs:
- full parametric CAD modeling
- B-rep/NURBS kernel ownership inside Asyra core
- industrial boolean/fillet/chamfer feature parity
- finite element analysis or stress simulation
- material damage simulation
- manufacturing tolerance analysis
- full swept-volume safety certification
- AI model-provider ownership inside the CAD app

These advanced areas may become later app modules or integrations, but they must
not block the first product proof.

## Architecture Principles

1. Keep Asyra core app-agnostic.
- CAD behavior belongs in the app or app-owned packages.
- Framework packages should expose reusable extension points only when a CAD
  use case reveals a general framework gap.

2. Treat rendering as derived output.
- Three.js or another 3D engine should render state.
- The renderer must not become authoritative model state.
- Renderer-specific types should stay behind render/app adapter boundaries.

3. Treat physics as an app-owned simulation service.
- Physics engines should not directly mutate scene state every frame.
- Simulation output should be converted into validated app events, reports, or
  transaction-safe state updates.
- Deterministic playback and inspection are more important than uncontrolled
  real-time mutation.

4. Preserve transaction semantics.
- One intended user authoring action should map to one intended undo commit.
- Drag previews and animation playback should avoid spamming undo history.
- Committed edits, keyframes, constraints, and collision annotations should be
  undoable when they represent user-authored state.

5. Keep the CAD app extensible.
- Primitives, parts, joints, constraints, animation tracks, and analysis reports
  should enter through registration-style surfaces where practical.
- The app should be able to add new part types without changing core runtime
  ownership.

## Phase 0: Framework Preconditions

Purpose: confirm the framework has the minimum boundaries required for a 3D CAD
tool without starting product-specific implementation too early.

Required before a serious CAD MVP:
- render-engine boundary is stable enough to swap Pixi-first assumptions for a
  3D renderer adapter
- 3D init/profile direction is clear enough that a CAD app can boot without
  bending 2D design-tool defaults
- transaction and undo behavior is reliable for app/common API writes
- component/property registration can express app-owned 3D part data
- persistence can save/load CAD app data without hardcoded 2D assumptions

Deliverables:
- a framework readiness note inside the CAD plan or future app context
- a short list of required framework gaps, if any
- no product-specific CAD code in framework packages unless the capability is
  genuinely reusable

Dependencies:
- Must happen before Phase 1 if the current render abstraction cannot support a
  3D viewport.
- Can happen in parallel with product UX sketches and domain schema planning.

## Phase 1: 3D Vertical Slice

Purpose: prove the end-to-end Asyra flow with the smallest possible 3D canvas
tool.

Target result:
- one app shell with a 3D viewport
- camera orbit/pan/zoom
- create a few primitive parts, such as box, cylinder, sphere, and gear-like
  placeholder
- select a part through ray picking
- move/rotate/scale a selected part with a transform gizmo
- commit transforms through Asyra transaction-safe app APIs
- undo/redo part creation and transform commits
- save/load the scene

Core work:
- create the CAD app bootstrap path
- implement a Three.js renderer adapter or equivalent 3D renderer adapter
- define CAD part component/property schemas
- define transform data model:
  - position
  - rotation
  - scale
  - parent id
  - local/world transform derivation
- add primitive registration and creation actions
- add raycast-based selection bridge
- add basic transform gizmo feature sessions
- add persistence tests for created parts and transforms

Acceptance criteria:
- user can create at least three part types
- user can select a part in the 3D viewport
- user can transform a part and undo/redo the committed transform
- save/load restores parts, transforms, and selection-safe scene state
- render output derives from Asyra state, not a separate renderer-owned scene
  source of truth

Estimated duration:
- focused vertical slice: 2 to 3 weeks
- polished demo slice: 3 to 5 weeks

Dependency ordering:
- Must come before assembly, animation, physics, or AI CAD actions.
- Can be built before final UI polish.
- Can run in parallel with Phase 2 schema design after the first renderer
  adapter spike is working.

## Phase 2: Non-Physics MVP

Purpose: build a useful mechanical authoring and animation MVP without collision
or physics simulation.

Target result:
- users can build small assemblies
- users can define simple relationships between parts
- users can configure keyframe animation
- users can play the animation
- all authoring changes remain undoable and persistent

Core work:
- assembly tree:
  - parent/child grouping
  - local transform inheritance
  - reorder and rename parts
  - lock/visibility metadata if needed
- part library:
  - primitive shapes
  - simple gear primitive or procedural gear-like mesh
  - shaft/axle placeholder
  - chain-link placeholder if needed for animation demos
- transform and hierarchy editing:
  - world/local transform display
  - transform reset
  - parent reassignment while preserving world transform
- simple joints/constraints:
  - hinge axis
  - fixed joint
  - optional slider axis
  - optional driven rotation relationship
- animation:
  - timeline state model
  - keyframe tracks for transform and joint values
  - loop playback
  - scrubber
  - play/pause
  - deterministic interpolation
- UI:
  - viewport toolbar
  - object tree
  - properties panel
  - timeline panel
  - basic command feedback
- persistence:
  - assembly data
  - part schemas
  - joint/constraint definitions
  - animation tracks and keyframes
- tests:
  - schema validation
  - hierarchy transform behavior
  - undo/redo grouping
  - save/load roundtrip
  - animation interpolation behavior

Acceptance criteria:
- user can create a two-part or three-part mechanical assembly
- user can attach parts through a simple relationship, such as a hinge or fixed
  parent/child relation
- user can keyframe motion and play it back
- user can undo/redo creation, transform, hierarchy, joint, and keyframe edits
- save/load restores the assembly and animation
- playback does not create undo history spam

Estimated duration:
- lean MVP: 4 to 6 weeks after Phase 1
- stronger alpha: 6 to 10 weeks after Phase 1

Dependency ordering:
- Requires Phase 1.
- Assembly tree and animation schema should be designed before timeline UI.
- Part library and timeline UI can be developed in parallel after schemas are
  stable.
- UI polish can proceed in parallel with tests once core flows are working.

## Phase 3: AI-Assisted Authoring MVP

Purpose: optionally connect `@asyra/ai-agent-runtime` to the CAD app so users can
create or modify assemblies through natural-language requests.

This phase is not required before physics. It can run after the non-physics MVP
has stable app actions, or it can begin earlier with a smaller action set.

Target result:
- user can describe a simple object or mechanism
- AI returns a structured action plan
- user can preview or confirm the plan
- the accepted plan executes through CAD app actions
- the full AI-created change can be undone as one user action

Core work:
- define CAD AI context provider:
  - current selected parts
  - available part primitives
  - scene units
  - current assembly tree summary
  - available animation actions
- define CAD AI action registry:
  - create part
  - set transform
  - create assembly group
  - create fixed relation
  - create hinge relation
  - create keyframe
  - set material/label metadata
- define safety policy:
  - preview required for multi-action plans
  - block destructive actions in first version
  - require explicit confirmation before clearing or replacing a scene
- define provider integration:
  - local developer-owned API key through environment configuration
  - no committed secrets
  - no hard dependency on one model provider in CAD domain code
- test AI executor without real provider calls by using deterministic fake
  providers

Acceptance criteria:
- a prompt such as "create two gears and animate the smaller one rotating around
  the larger one" can produce a valid structured plan
- invalid plans fail before mutation
- accepted plans execute through app/common APIs
- undo reverts the full accepted AI action batch
- provider absence disables AI without breaking the CAD app

Estimated duration:
- basic authoring assistant: 2 to 4 weeks after stable CAD app actions
- product-feeling assistant with preview/repair/explanation: 6 to 10 weeks

Dependency ordering:
- Requires at least a stable subset of Phase 1 actions.
- Works best after Phase 2 defines assembly and animation APIs.
- Can run before physics.
- Physics-specific AI actions should wait until Phase 4 or Phase 5 exposes
  stable collision/analysis actions.

## Phase 4: Physics and Collision MVP

Purpose: detect collisions during mechanical motion without attempting full
industrial simulation or material damage analysis.

Target result:
- users can assign simple collider shapes to parts
- animation playback can run collision detection
- collision events are recorded with time, involved parts, and approximate
  contact information
- users can inspect and replay collision moments

Core work:
- physics adapter boundary:
  - engine wrapper for Rapier, Cannon, Ammo, or another chosen engine
  - fixed timestep simulation mode
  - app-owned collider serialization
  - deterministic simulation settings where practical
- collider model:
  - box collider
  - sphere collider
  - cylinder or capsule collider
  - optional convex hull or mesh collider later
  - local transform relative to part
- animation-to-simulation bridge:
  - convert keyframe playback into physics body transforms
  - distinguish kinematic animation playback from dynamic simulation
  - run collision detection without committing frame-by-frame simulation state
    into undo history
- collision report model:
  - collision id
  - time/frame
  - part ids
  - contact point or approximate contact region
  - severity placeholder
  - status metadata
- collision inspection UI:
  - report list
  - jump to collision time
  - highlight involved parts
  - replay around collision
- persistence:
  - collider definitions
  - collision analysis settings
  - optionally saved collision reports when user commits analysis results

Acceptance criteria:
- user can assign basic colliders to at least two animated parts
- playback or analysis detects when those colliders intersect
- collision report shows involved parts and time
- user can jump to the collision moment
- collision analysis does not mutate authoring state every frame
- committed report annotations are undoable if stored in scene state

Estimated duration:
- basic collision MVP: 4 to 8 weeks after Phase 2
- stronger collision inspection alpha: 8 to 12 weeks after Phase 2

Dependency ordering:
- Requires Phase 1.
- Strongly benefits from Phase 2 animation.
- Does not require Phase 3 AI.
- Collider model and physics adapter can be prototyped in parallel with
  animation UI, but real collision playback depends on stable animation state.

## Phase 5: Mechanical Analysis Alpha

Purpose: improve collision detection from "does it touch" to "is this likely a
mechanical risk worth inspecting."

Target result:
- users can run a repeatable analysis pass over an animation
- the tool reports collision windows, clearances, and risk labels
- users can adjust clearance thresholds
- the tool can export or summarize inspection results

Core work:
- analysis runner:
  - deterministic analysis settings
  - sample rate controls
  - frame/time range controls
  - repeatable result generation
- clearance detection:
  - minimum distance threshold
  - near-miss report
  - collision vs clearance warning distinction
- severity heuristics:
  - relative speed estimate
  - repeated contact count
  - contact duration
  - user-defined risk thresholds
- report persistence:
  - analysis runs
  - report snapshots
  - stale report invalidation when source geometry/animation changes
- visual overlays:
  - collision markers
  - contact path
  - clearance warning markers
- export:
  - JSON report
  - optional screenshot or simple HTML/PDF report later

Acceptance criteria:
- analysis can be repeated with stable results for unchanged inputs
- users can distinguish collision, near-miss, and clear states
- report invalidates or warns when input scene/animation changes
- exported result references part ids/names and animation times

Estimated duration:
- 6 to 10 weeks after Phase 4

Dependency ordering:
- Requires Phase 4.
- Can run in parallel with CAD UI polish after collision report data contracts
  are stable.
- Does not require advanced CAD geometry.

## Phase 6: Advanced CAD Geometry and Import

Purpose: move beyond primitive mechanical demos toward useful CAD-like content.

Target result:
- users can import common mesh formats
- users can manage reusable parts
- app can optionally integrate external CAD/geometry kernels for advanced shape
  operations

Core work:
- mesh import:
  - glTF/GLB first
  - optional OBJ/STL later
  - import scaling and unit handling
  - mesh asset persistence strategy
- reusable part library:
  - saved part definitions
  - instancing or reference model if needed
  - metadata and thumbnails
- procedural parts:
  - better gear generation
  - chain links
  - shafts
  - brackets
- geometry-kernel exploration:
  - identify external CAD kernel candidates
  - define app-owned adapter boundary
  - avoid coupling Asyra core to kernel-specific types
- asset and performance strategy:
  - geometry caching
  - bounding volumes
  - level-of-detail if needed

Acceptance criteria:
- imported parts behave like native parts for transform, selection, save/load,
  and animation
- reusable parts can be inserted into assemblies
- advanced geometry remains app-owned and does not leak into framework core

Estimated duration:
- import and reusable library: 4 to 8 weeks
- serious CAD kernel integration: 3 to 6 months or more, depending on kernel and
  target feature depth

Dependency ordering:
- Mesh import can start after Phase 1.
- Reusable part library can start after Phase 2 schema stabilizes.
- Geometry kernel integration should wait until product direction is validated.
- This phase does not require physics, but physics quality improves with better
  geometry/collider generation.

## Phase 7: Collaboration and Product Hardening

Purpose: make the CAD tool credible for real users, not just demos.

Target result:
- common workflows are stable
- collaboration behavior is predictable
- performance is acceptable for medium assemblies
- docs and tests guide future contributors

Core work:
- collaborative editing policy:
  - shared mutation path for authoring edits
  - conflict policy for simultaneous transform/keyframe edits
  - stale analysis report invalidation in collaborative sessions
- performance:
  - render update batching
  - transform hierarchy caching
  - raycast acceleration
  - collider broadphase strategy
  - large assembly profiling
- reliability:
  - load validation and fallback
  - schema migration strategy
  - corrupted asset handling
  - deterministic test fixtures
- documentation:
  - app architecture context
  - action/golden-path docs
  - feature authoring guide
  - AI action guide if Phase 3 exists
- release quality:
  - smoke tests
  - e2e workflows
  - example scenes
  - contributor setup instructions

Acceptance criteria:
- app can handle a medium demo assembly without interaction collapse
- common workflows are covered by tests
- collaboration-compatible state changes use the shared path intentionally
- future app contributors have app-level docs comparable to `asyra-design`

Estimated duration:
- continuous after Phase 2
- first serious hardening pass: 4 to 8 weeks after MVP scope stabilizes

Dependency ordering:
- Can begin incrementally after Phase 1.
- Full collaboration policy depends on stable app data contracts.
- Performance work should follow measured bottlenecks, not guesses.

## Dependency Map

Must happen in order:

```txt
Phase 0 Framework Preconditions
  -> Phase 1 3D Vertical Slice
  -> Phase 2 Non-Physics MVP
  -> Phase 4 Physics and Collision MVP
  -> Phase 5 Mechanical Analysis Alpha
```

Can run in parallel:
- Phase 2 part library and Phase 2 timeline UI after core schemas are stable
- Phase 3 AI-assisted authoring after a stable subset of app actions exists
- Phase 4 collider/physics adapter spike while Phase 2 animation UI matures
- Phase 6 mesh import after Phase 1, independent of physics
- Phase 7 documentation and test scaffolding throughout the project

Should wait:
- physics-specific AI actions should wait for Phase 4 contracts
- serious geometry-kernel integration should wait for Phase 1/2 validation
- industrial analysis features should wait for Phase 4 collision reports
- large collaboration conflict policies should wait for stable app data contracts

## Suggested Delivery Tracks

Track A: Core product path
1. 3D vertical slice
2. non-physics MVP
3. physics/collision MVP
4. mechanical analysis alpha

Track B: Optional acceleration path
1. AI-assisted authoring after stable create/transform/animation actions
2. mesh import after the 3D renderer and persistence path work
3. reusable parts after assembly schemas settle

Track C: Quality path
1. transaction and undo tests from the first slice
2. save/load tests from the first slice
3. visual and e2e tests after viewport interactions stabilize
4. performance profiling after real scene sizes exist

## Schedule Guidance

Solo or small-team estimates, assuming the framework gaps are manageable:
- 3D vertical slice: 2 to 5 weeks
- non-physics MVP: 4 to 10 additional weeks
- AI-assisted authoring MVP: 2 to 10 weeks depending on preview/repair depth
- physics/collision MVP: 4 to 12 additional weeks
- mechanical analysis alpha: 6 to 10 additional weeks
- product hardening: continuous, with a 4 to 8 week focused pass after MVP

Practical targets:
- demo-quality non-physics MVP: about 6 to 12 weeks total after framework
  readiness is confirmed
- stronger non-physics alpha: about 3 to 4 months
- physics/collision alpha: about 4 to 6 months
- commercial-quality mechanical CAD-like product: 9 to 18 months or more,
  depending on geometry and analysis ambition

## Risk Register

1. Render abstraction may still be too 2D.
- Mitigation: start with Phase 1 renderer adapter spike before deeper CAD app
  work.

2. Transform hierarchy can become inconsistent across render, selection, and
   persistence.
- Mitigation: define local/world transform derivation early and test it heavily.

3. Animation playback can pollute undo history.
- Mitigation: separate transient playback state from committed animation edits.

4. Physics can introduce nondeterministic behavior.
- Mitigation: use fixed timestep analysis mode and avoid committing every
  simulation frame as state.

5. Collision reports can become stale after edits.
- Mitigation: include source revision metadata and invalidation rules.

6. AI-generated actions can bypass app safety if too permissive.
- Mitigation: use `@asyra/ai-agent-runtime` action registration, schema
  validation, permission policy, preview, and transaction runner boundaries.

7. Advanced CAD expectations can overwhelm the MVP.
- Mitigation: keep early goals focused on mechanical animation and inspection,
  not full industrial CAD parity.

## Future Implementation Test Plan

Phase 1 tests:
- create/select/transform primitive parts
- undo/redo part creation and transform commit
- save/load primitive scene
- renderer output follows state after load

Phase 2 tests:
- parent/child transform inheritance
- parent reassignment preserves expected transform
- keyframe creation/edit/delete
- animation interpolation
- playback does not create undo commits
- save/load assembly and animation

Phase 3 tests:
- deterministic fake provider returns valid action plan
- invalid AI action plan fails before mutation
- accepted AI plan executes through app actions
- undo reverts full AI plan

Phase 4 tests:
- collider schema validation
- collision detection for two simple moving parts
- no collision report for separated parts
- jump to collision time
- collision analysis does not mutate frame-by-frame authoring state

Phase 5 tests:
- repeatable analysis report for unchanged inputs
- stale report detection after source edit
- clearance warning threshold behavior
- export includes part ids/names and animation times

Phase 6 tests:
- imported mesh transforms and persists
- imported mesh participates in selection
- reusable part insertion preserves expected data
- asset load fallback is deterministic

Phase 7 tests:
- collaborative mutation path receives authored changes when enabled
- simultaneous edit policy is documented and tested for supported cases
- medium assembly performance smoke test
- app-level docs cover current architecture and golden paths

## Assumptions

- `asyra-cad` does not exist as an app context yet.
- This roadmap is a future planning record, not an implementation commitment.
- The first CAD target is a mechanical animation and collision inspection tool,
  not a full industrial CAD replacement.
- The non-physics MVP should ship before physics/collision work becomes the main
  focus.
- AI-assisted authoring is optional and should use the future
  `@asyra/ai-agent-runtime` package rather than CAD-specific model plumbing.
- External 3D, physics, and CAD geometry engines should remain replaceable.
