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
asset count bounded. Each body receives an ordinary digest-addressed visual
binding; export/reopen preserves the source bytes through the standard archive.
There is no robot-specific rendering path.

`synthetic-workcell.ts` owns the independent joint model and analysis proxies.
Capsule cylinder length excludes its two hemispherical caps. The gripper uses
a palm and two separate finger boxes with an open workpiece gap. These remain
approximate analysis shapes: decorative shells, fasteners, fixture legs and
other visual details are not certified enclosed by the proxies. The proxy
overlay and preflight remain available; a visual fit is not collision evidence.
Explicit adjacent mounting exclusions remain visible and are not safety claims.

Existing saved documents and historical runs are never upgraded to this sample
or renamed automatically. Only a newly initialized example receives version 2.
