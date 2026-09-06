import type { ExperimentSnapshot } from '../../analysis/contracts'
import type { LiveSample } from '../../analysis/live/protocol'

export type PlaybackFindingKind = 'collision' | 'clearance' | 'unresolved'

export interface PlaybackFeedback {
  origin?: 'live' | 'recorded'
  kind: PlaybackFindingKind | 'checking' | 'clear' | 'error'
  checkedTime: number | null
  bodyIds: readonly string[]
  pairNames: readonly string[]
  complete: boolean
  totalPairCount: number
  message: string
}

export const checkingFeedback = (): PlaybackFeedback => ({
  kind: 'checking',
  checkedTime: null,
  bodyIds: [],
  pairNames: [],
  complete: false,
  totalPairCount: 0,
  message: 'Checking live geometry…'
})

/** Present validated method states only; no geometry or user-verdict evaluation. */
export function playbackFeedback(
  snapshot: ExperimentSnapshot,
  sample: LiveSample
): PlaybackFeedback {
  const collisions = sample.pairs.filter((pair) =>
    pair.evidence.leaves.some(
      (leaf) => leaf.state === 'finding' && leaf.penetration
    )
  )
  const findings = sample.pairs.filter((pair) =>
    pair.evidence.leaves.some((leaf) => leaf.state === 'finding')
  )
  const unknowns = sample.pairs.filter(
    (pair) => pair.evidence.coverage === 'partial'
  )
  let kind: PlaybackFeedback['kind'] = 'clear'
  let relevant = collisions

  if (!sample.complete) kind = 'unresolved'
  if (findings.length) {
    kind = 'clearance'
    relevant = findings
  }
  if (collisions.length) {
    kind = 'collision'
    relevant = collisions
  }

  if (kind === 'unresolved') relevant = unknowns

  const bodies = new Map(
    snapshot.workcell.bodies.map((body) => [body.id, body])
  )
  const sources = new Map(snapshot.pairs.map((pair) => [pair.id, pair]))
  const bodyIds = new Set<string>()
  const pairNames = new Set<string>()

  for (const pair of relevant) {
    const source = sources.get(pair.pairId)

    if (!source) throw new Error('Live evidence is missing its source pair')

    const a = bodies.get(source.a.bodyId)
    const b = bodies.get(source.b.bodyId)

    if (!a || !b) throw new Error('Live evidence is missing its source body')

    bodyIds.add(a.id)
    bodyIds.add(b.id)
    pairNames.add(`${a.name} - ${b.name}`)
  }

  return {
    kind,
    checkedTime: sample.time,
    bodyIds: [...bodyIds],
    pairNames: [...pairNames],
    complete: sample.complete,
    totalPairCount: sample.totalPairCount,
    message: sample.error ?? 'Sampled check only - not a full-path report.'
  }
}
