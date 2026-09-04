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
claim that a result has been saved. Worker orchestration rejects oversized byte
arrays before copying or allocating a Worker and enforces a five-second deadline
through response validation. Success, failure, cancellation, and expiry all
terminate the owned Worker and release its timer; a late response cannot become
an accepted preview.

## Supported profile

### Canonical binding

A body may carry optional `visuals`, an array of version-1 bindings with exact
fields `version`, `id`, `assetId`, `pose`, and `scale`. `id` is unique within the
body; `assetId` is the lowercase SHA-256 of the immutable original GLB bytes.
The binding contains no decoded vertices or renderer objects. An absent array
or an empty array means no visual reference, preserving existing workcells.

`pose` follows the shared domain's body-local meters/quaternion contract.
`scale` is an explicit positive three-axis multiplier in [0.000001, 1000].
Scale is applied to baked asset vertices first, then the binding's local pose,
then the shared body world pose. It never scales joints, children, or colliders.
Initial limits are 16 bindings per body and 256 per selected workcell, in
addition to the source-byte limits and each GLB's expanded geometry limits. Identity,
pose, scale, and aggregate validation belong to the domain; existence, digest
verification, and decoded source ownership belong to the asset/storage flow.
These are admission bounds, not a measured rendering-capacity claim.

The editing Feature passes visual-resource admission to common APIs. Creating,
replacing, duplicating, or updating a workcell with visual references requires
that admission; an unconfigured service cannot silently accept unresolved
sources. Editing only visual bindings preserves every collider and body/joint
pose. An explicit prepared-source acceptance and the resulting binding update
produce one canonical Undo action. Rejection produces no partial binding;
immutable source retention may outlive a rejected write and remains unsaved.
Undo removes/reverts the binding, while Redo can resolve the retained source.
Detached capture derives visual binding groups from canonical candidate
ancestry. It does not merge independent candidates into one workcell budget or
invent ownership for orphan/cyclic references. This grouping is read-only and
does not create a second editable hierarchy.

### Retained source ownership

The local archive retains version-1 records with exact fields `version`,
`assetId`, `filename`, `byteLength`, and `base64`. Base64 must be canonical;
length and digest must match the decoded original bytes. Filenames are bounded
inert display metadata, never paths or URLs to load. Decoded triangle arrays
are runtime resources, not the persisted authority or canonical editable data.

Preparation detaches bytes before awaiting the owned decoder, validates the
digest, and returns an immutable archive-scoped preview receipt. Preparation
alone does not retain a source or create a binding. Acceptance rejects a
fabricated, copied, foreign, cancelled, or retired receipt. Reusing accepted
identical bytes shares the original immutable source, not editable placement.
Hydration validates every source and decodes the supported profile before
publishing an archive; it cannot return a partially hydrated archive on error.

The archive retains undo-reachable orphan sources until its lifetime ends.
Both a project source collection and the lifetime archive are bounded to
256 unique sources and 64 MiB of raw bytes, with 16 MiB per source. Exhaustion
is explicit. A portable capture includes the union of current and retained-run
references, excluding unrelated orphan blobs; missing references are errors.
Reopening that capture in a new lifetime can release unreferenced undo data.
The native 64 MiB JSON limit also applies, including Base64 expansion.

The version-1 native project snapshot carries these records in optional
`visualSources`. No field is required for older projects without references.
Encoding and decoding require the union of current canonical body references
and immutable retained-run references to be present in that collection. They
validate source envelopes, not the full GLB semantics: asynchronous hydration
still verifies every digest and decodes every source before runtime acceptance.
Missing or malformed sources reject native replacement; they do not destroy the
current document or rewrite independently exported historical reports. Missing
private method binaries remain a separate read-only-history condition.

Programmatic `PREPARE_VISUAL` work uses a noncanonical Feature task at priority
90, exclusive, with one active invocation per Feature and a Feature-owned abort
signal. The owned decoder enforces its deadline. `RETAIN_VISUAL` at priority 100,
exclusive, retains the original receipt and invokes the editing Feature for one
binding transaction. No transaction spans decoding. After task completion,
discarding a preview explicitly revokes its receipt; it is not implemented by
trying to cancel an already-settled task. Runtime cleanup disposes the archive
and invalidates all receipts. A failed canonical binding remains retryable but
does not claim persistence or create a partial reference.

Decoded resources are additionally bounded to 1,000,000 vertices and 3,000,000
indices per lifetime archive. Resolving a workcell applies the same aggregate
limits to all binding instances, including hidden bodies and repeated sources.
Source-byte caps alone cannot bound geometry amplified by instancing. Resolution
returns only available decoded artifacts; missing references or excess geometry
fail explicitly before projection or formal snapshot admission. A valid pending
preview receipt may participate in a read-only admission check without retention.

Project preparation captures the current candidate binding groups and every
retained run's bindings before asynchronous source hydration. Each group has
its own expanded-workcell budget; shared source retention still has one
archive-wide budget. Any missing source, digest/profile error, excessive group,
or abort releases the prepared archive instead of returning partial resources.

Document replacement prepares all target resources before pausing the current
runtime. Currentness is checked again after preparation; only then may the
controller capture recovery and retire the old runtime. Closing aborts pending
preparation and disposes any late, untransferred archive. Successful bootstrap
owns the transferred archive without decoding it again. Initial saved startup
without prepared resources uses the same complete preparation service.
Composition connects visual-resource admission to editing and formal snapshot
creation, exposes live current/historical resource readers, and captures only
the referenced source union. Failed startup and terminal teardown release the
archive even when Feature installation did not finish. Retired facades cannot
prepare, accept, or resolve references in a successor's lifetime.

Projection uses the existing Core-registered spatial layer at z-index 0 and
the same demand-driven update/teardown path as proxy display. Decoded arrays
become engine-neutral triangle descriptors; no SDK object leaves the engine.
Visual and proxy visibility controls are transient. Proxies on a body with a
displayed visual are drawn as wireframes, without changing their formal shape.
Every mesh preserves the owning body identity for picking. Missing references
remain errors even when the body or visual display is hidden. Source arrays,
canonical data, and immutable replay snapshots are never modified by projection.

### Supported GLB content

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
