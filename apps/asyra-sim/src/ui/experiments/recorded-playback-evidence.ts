import type { PresentedRun } from '../results/run-freshness'
import type { PlaybackFeedback } from './playback-feedback'
import type { IntervalEvidence } from '../../analysis/methods/continuous-query'

/** Query accepted proofs only; missing times must go to the live sampling owner. */
export class RecordedPlaybackEvidence {
  private readonly cues = new Map<number, PlaybackFeedback>()
  private readonly times: number[]

  constructor(private readonly run: PresentedRun) {
    const bodies = new Map(
      run.snapshot.workcell.bodies.map((body) => [body.id, body])
    )
    const pairs = new Map(run.snapshot.pairs.map((pair) => [pair.id, pair]))

    for (const pair of run.result.pairEvidence) {
      const source = pairs.get(pair.pairId)

      if (!source) throw new Error('Recorded evidence is missing its pair')

      const a = bodies.get(source.a.bodyId)
      const b = bodies.get(source.b.bodyId)

      if (!a || !b) throw new Error('Recorded evidence is missing its body')

      for (const leaf of pair.evidence.leaves) {
        if (leaf.state !== 'finding' || leaf.witnessTime === null) continue

        const previous = this.cues.get(leaf.witnessTime)

        if (previous?.kind === 'collision' && !leaf.penetration) continue

        const matching =
          previous?.kind === 'collision' || !leaf.penetration
            ? previous
            : undefined
        const kind =
          leaf.penetration || previous?.kind === 'collision'
            ? 'collision'
            : 'clearance'

        this.cues.set(leaf.witnessTime, {
          origin: 'recorded',
          kind,
          checkedTime: leaf.witnessTime,
          bodyIds: [...new Set([...(matching?.bodyIds ?? []), a.id, b.id])],
          pairNames: [
            ...new Set([
              ...(matching?.pairNames ?? []),
              `${a.name} - ${b.name}`
            ])
          ],
          totalPairCount: run.result.totalPairCount,
          complete: false,
          message: 'Recorded witness - no new geometry calculation.'
        })
      }
    }

    this.times = [...this.cues.keys()].sort((a, b) => a - b)
  }

  at(time: number): PlaybackFeedback | undefined {
    if (
      time < this.run.snapshot.interval[0] ||
      time > this.run.snapshot.interval[1]
    )
      return

    const cue = this.cues.get(time)

    if (cue) return { ...cue, complete: this.covers(time, true) }
    if (!this.covers(time, false)) return

    return {
      origin: 'recorded',
      kind: 'clear',
      checkedTime: time,
      bodyIds: [],
      pairNames: [],
      totalPairCount: this.run.result.totalPairCount,
      complete: true,
      message:
        'Recorded clear interval certificates - no new geometry calculation.'
    }
  }

  nextWitness(after: number | null, before: number) {
    if (after === null) return

    let low = 0
    let high = this.times.length

    while (low < high) {
      const middle = Math.floor((low + high) / 2)

      if (this.times[middle] <= after) low = middle + 1
      else high = middle
    }

    const time = this.times[low]

    if (time !== undefined && time <= before) return time
  }

  private covers(time: number, allowWitness: boolean) {
    const pairs = this.run.result.pairEvidence

    return (
      pairs.length === this.run.snapshot.pairs.length &&
      pairs.every((pair) =>
        coversTime(pair.evidence.leaves, time, allowWitness)
      )
    )
  }
}

/** Validated leaves are ordered; inspect only intervals adjacent to the queried time. */
function coversTime(
  leaves: readonly IntervalEvidence[],
  time: number,
  allowWitness: boolean
) {
  let low = 0
  let high = leaves.length

  while (low < high) {
    const middle = Math.floor((low + high) / 2)

    if (leaves[middle].end < time) low = middle + 1
    else high = middle
  }

  return [leaves[low], leaves[low + 1]].some(
    (leaf) =>
      leaf &&
      leaf.start <= time &&
      time <= leaf.end &&
      (leaf.state === 'clear' ||
        (allowWitness && leaf.state === 'finding' && leaf.witnessTime === time))
  )
}
