# CUSTOM Spatial Engine Contract

## Scope

The first engine is an App-owned Three.js adapter using the ordinary
`Core -> Render -> RenderEngine` boundary. Preset composition uses `CUSTOM` and
explicitly selected defaults. Official `3D` and `HYBRID` profiles remain
unavailable. This is not a public Framework 3D guarantee.

The engine owns SDK objects, camera projection, rasterization, visual ray
selection, GPU resources, and normalized pointer events. It imports only public
`@asyra/render-engine` contracts and its own engine-neutral spatial descriptor;
it cannot import Core, Render, workcells, trajectories, solvers, or UI.

## Spatial Projection

The App registers one custom layer through `core.registerRenderLayer`. Its
RenderContainer/RenderMesh wrappers project explicit versioned spatial data
through the existing public object-properties command surface. They never
extract or invoke the engine runtime from Core.

Spatial descriptors are typed, validated data: perspective camera configuration,
rigid pose, primitive dimensions or indexed triangle geometry, appearance, and
selectability. Coordinates are right-handed, Y-up, and measured in meters.
Quaternions use `[x, y, z, w]`; rotations and poses are computed by the App domain,
not inferred from robot data by the engine. Nonuniform scale is not a pose.

Each body projection has its own opaque engine handle. Camera and mesh updates
travel through Render commands; camera is a spatial container descriptor, not a
fake mesh or a second canvas. The descriptor is a CUSTOM capability contract
owned by this App; generic `Record<string, unknown>` typing alone is not evidence
that arbitrary engines support it. Unknown versions and malformed descriptors
fail explicitly before changing an accepted object.

Framework 2D containers and graphics remain an independent screen-space bridge.
Spatial nodes receive complete domain world poses and do not reinterpret the
Framework's 2D affine `worldTransform` as 3D. They may be grouped for resource
ownership, but the engine must not recompute the canonical robot hierarchy.
Screen queries retain the public 2D query semantics; visual spatial hit testing
casts a camera ray and returns the nearest selectable visible handle. No visual
query is collision evidence.

This App does not claim full interoperability with the Design renderer. Its
small screen bridge supports translation/rotation/scale, visibility, solid
fills and one-device-pixel lines. It rejects screen skew, non-unit container
alpha, thick lines, unknown property keys, and meshes without spatial
descriptors. These limitations do not reduce the supported 3D primitives or
their explicit opacity. Unsupported requests fail before replacing accepted
content; silently ignoring a requested effect is not conformance. General 2D
rendering parity is outside R0 and must be revisited before generic extraction.

The runtime's App-facing `pick(x, y)` accepts DOM client coordinates. Composition
converts them using the actual canvas bounds and current logical surface size
before calling Core's `getElementIdAtClientPos` facade. Despite that legacy
facade name, its current engine query forwards surface-local coordinates without
DOM conversion. The CUSTOM query keeps those existing semantics. Outside or
zero-sized surfaces return no hit. CSS scaling and device-pixel ratio do not
change model coordinates.

## Lifecycle

Composition stores the provider without constructing an engine. Startup creates
one owned surface. Rendering occurs only on an explicit Framework `flush`.
`requestFrame` owns one cancellable, one-shot callback; it does not draw or start
a permanent engine animation loop. Resize updates surface and camera aspect.

The App observes its host's CSS dimensions and calls the public
`core.resizeRenderer(width, height)` facade. Core validates finite positive
dimensions and forwards to the active `IRenderer`; Render retains surface-command
ownership. This minimal facade supports both 2D canvases and CUSTOM 3D surfaces.
It adds no 3D semantics or Preset enablement. Hidden zero-size hosts defer their
request at the App boundary; invalid public requests throw before forwarding.

Destroy is idempotent and releases geometry, materials, renderer, pointer
listeners, resources, and pending callbacks. Destroyed or foreign handles fail;
no late callback may draw a destroyed engine. Initialization failures clean up
their partial resources and remain errors, without a Pixi or no-canvas fallback.

## Product Cases and Done

Permanent tests cover provider/startup isolation, shared engine contract
conformance, perspective projection, depth-aware selection, quaternion poses,
primitive dimensions, camera/resize updates, explicit flush scheduling,
invalid/foreign handles, hierarchy operations, and repeated resource cleanup.
A normal Core/custom-layer integration case proves the handoff rather than
testing only direct SDK calls. Browser evidence must exercise the real WebGL
surface; a stubbed graphics driver is unit-test evidence only.

M0 succeeds only after the normal pipeline and numerical feasibility proofs
pass. This contract does not turn a rotating cube into a completed R0 product.

## Future Extraction

Keep engine-neutral descriptors and concrete SDK code separate. A later task
may move the generic adapter/contracts to dedicated packages and install the
default provider through Preset. Preset would own default composition, not SDK
execution, robot semantics, or collision decisions. No extraction is performed
in this task.
