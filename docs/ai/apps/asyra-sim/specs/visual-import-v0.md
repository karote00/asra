# Restricted GLB Visual Import

## Purpose and ownership

Import a self-contained static GLB as a visual reference. The App-owned asset
decoder is isolated under `src/engine/glb/`; it creates detached triangle data
without starting a renderer, fetching resources, or editing a workcell. SDK
types do not escape. The `asset` Inspector step owns decoding, not robot poses.

An accepted visual is **not an analysis collider**. Users must separately define
proxies. Preview discloses the source digest, dimensions, mesh/triangle counts,
units, baked asset transforms, and appearance limitations. Decoding failure,
cancellation, or rejected preview creates no canonical body or asset reference.
Storage and Feature acceptance remain separate owners; this decoder does not
claim that a result has been saved.

## Supported profile

- GLB container version 2 and glTF asset version 2.0, with exactly one JSON chunk
  and one binary chunk, one embedded buffer, and one scene.
- A static tree of nodes with rigid or positive-scale TRS/matrix transforms.
  Asset-local transforms are baked into decoded vertices. They are not robot
  joints and do not change the workcell kinematics contract.
- Triangle primitives, optional unsigned indices, finite float32 positions.
  Optional float32 normals, tangents, and UV coordinates are validated but not
  retained; display normals are recomputed from triangles. No texture loading.
- Constant material base color only. Other supported scalar PBR values do not
  affect formal geometry and the current renderer uses its own fixed shading.
  Appearance is a reference, not a photometric match.
- Right-handed Y-up coordinates in meters, according to the source format.
  A vendor file authored with incorrect units still needs user correction.

Reject external/data URIs, images, textures, extensions, compression, sparse
accessors, skinning, morph targets, animations, cameras, negative/singular
transforms, non-triangle primitives, invalid ranges/references, cycles, multiple
parents, and unsupported attributes. Do not silently drop unsupported content
or fall back to a different decoder. Metadata such as names is inert text.

Initial hard limits: 16 MiB GLB, 2 MiB JSON, 128 nodes, 64 meshes/materials,
256 expanded primitives, 200,000 expanded vertices, 600,000 indices, and finite
baked coordinates within ±1,000 m. JSON nesting is limited to 24 levels and
50,000 visited values. Limits apply before large geometry allocations and
account for instanced nodes. These are initial resource guards, not measured
release capacity. The first decoder proof is synchronous and bounded; ordinary
file-import orchestration must move it to owned worker execution before M2
claims responsive import cancellation.

## Verification and done

Permanent cases cover a valid embedded triangle, indexed/interleaved geometry,
node transforms, explicit source units and digest, malformed headers/chunks,
unsafe resource references, out-of-bounds accessors, cycles, negative scale,
unsupported features, and amplified resource limits. A network trap verifies
that successful and failing decodes never fetch. Independent vertex coordinates
and byte-level fixtures are the oracles; a second invocation of the decoder is
not the expected-value source.

M0 decoder feasibility requires these cases plus App typecheck/lint. M2 still
requires preview, explicit acceptance, worker cancellation, canonical binding,
and persistence. No decoder-only test satisfies the full import user journey.

Format reference: <a href="https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html" target="_blank" rel="noopener noreferrer">Khronos glTF 2.0 specification</a>.
