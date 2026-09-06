# Synthetic mechanical workcell

Version 2 is an original six-axis industrial main-body study: cast housings,
fork-supported joints, bevelled covers, mounting flanges, socket fasteners and
a two-finger gripper. The arm's axis sequence and dimensions are invented. It
is not manufacturer CAD, a calibrated controller model or certified equipment.

The public <a href="https://www.abb.com/global/en/areas/robotics/products/robots/articulated-robots/small-robots/irb-1100" target="_blank" rel="noopener noreferrer">ABB IRB 1100 product photographs</a>
were an appearance reference for industrial housing and assembly vocabulary,
not a source of copied meshes, textures, branding or dimensions. Internal gears,
motors, cables and hoses are not exposed or simulated in this main-body study.

`mechanical-mesh.ts` authors deterministic metre-space geometry and self-contained
GLB bytes. `mechanical-visuals.ts` defines the original parts. Surfaces of the
same finish share a mesh within each rigid body, keeping draw submissions and
asset count bounded. Each body receives an ordinary digest-addressed original part
binding; export/reopen preserves the source bytes through the standard archive.
There is no robot-specific rendering path.

`synthetic-workcell.ts` also supplies standalone native primitive fixtures for
analytical and historical tests. Normal composition attaches all 11 original
sources, clears those legacy primitives and selects the original-part method.
The current sample contains 23,028 original triangles, including fasteners,
fixture legs and open bores. No proxy overlay or alternative collision shape
is used. Source authoring creates valid pole fans and consistently oriented
closed caps; imported user meshes are never repaired or simplified implicitly.
Wireframe displays these same triangles. A rendered fit is not collision evidence.
Explicit adjacent mounting exclusions remain visible and are not safety claims.

Existing saved documents and historical runs are never upgraded to this sample
or renamed automatically. Only a newly initialized example receives version 2.

## Starter experiments

A fresh workcell contains five independently editable eight-second studies:

| Study | Motion and analysis scope |
| --- | --- |
| Synthetic clearance study | Original base-yaw sweep; complete modeled workcell. |
| Shoulder reach study | J2 reach variation with all other joints fixed. |
| Elbow folding study | J3 folding/extension with all other joints fixed. |
| Wrist orientation study | J4/J5/J6 orientation changes with the first three axes fixed. |
| Tool and table sweep | Combined J1/J2/J3 motion; gripper and workpiece against the table only. |

The first four retain the full workcell scope and the existing explicit mounting
exclusions. The local table study acknowledges every omitted visible body and
retains only its selected mounting exclusion. It cannot establish clearance for
the omitted robot links or post. All trajectories contain every actuated joint
in radians and use ordinary piecewise-linear interpolation. The normal App
selects the original-part method for every study, with the existing 20 mm
clearance threshold and bounded resource defaults. Names describe test intent,
not predicted collision, safety, or controller feasibility. Studies share the
same complete source geometry, not mutable experiment inputs or historical runs.
