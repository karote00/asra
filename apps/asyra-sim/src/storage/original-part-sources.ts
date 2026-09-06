import type { ExperimentSnapshot } from '../analysis/contracts'
import { resolvePartWorkcell } from '../domain/part-geometry'
import type { VisualAssetArchive } from './visual-archive'

/** Source parity is validation, not historical migration or result recomputation. */
export function validateOriginalPartSources(
  snapshot: ExperimentSnapshot,
  archive: VisualAssetArchive
): void {
  if (snapshot.version !== 2) return
  const resolved = resolvePartWorkcell(
    snapshot.workcell,
    archive.resolveWorkcell(snapshot.workcell)
  )
  for (let i = 0; i < resolved.bodies.length; i++) {
    const expected = resolved.bodies[i],
      retained = snapshot.workcell.bodies[i]
    if (!expected.visuals?.length) continue
    const equal = (a: readonly number[], b: readonly number[]) =>
      a.length === b.length && a.every((value, index) => value === b[index])
    if (
      expected.colliders.length !== retained.colliders.length ||
      expected.colliders.some((collider, index) => {
        const other = retained.colliders[index],
          geometry = collider.geometry,
          actual = other.geometry
        return (
          collider.id !== other.id ||
          geometry.kind !== 'mesh' ||
          actual.kind !== 'mesh' ||
          geometry.source.assetId !== actual.source.assetId ||
          !equal(geometry.source.scale, actual.source.scale) ||
          !equal(geometry.positions, actual.positions) ||
          !equal(geometry.indices, actual.indices) ||
          !equal(collider.pose.position, other.pose.position) ||
          !equal(collider.pose.rotation, other.pose.rotation)
        )
      })
    )
      throw new Error(
        `Frozen geometry differs from its original part source: ${retained.id}`
      )
  }
}
