import type { Workcell } from '../../domain/workcell'
import { jointValuesAt } from '../../domain/workcell'
import type { PresentedRun } from '../results/run-freshness'
import type { PlaybackView } from './playback-view'
import type { LiveSampleOptions } from './live-preview'
import type { PlaybackFeedback } from './playback-feedback'

/** Replay accepted witnesses, never reinterpret a finding interval as continuous contact. */
export class RecordedPreview {
  readonly completion = Promise.resolve()
  private alive = true
  private previous: number | null = null
  private readonly cues = new Map<number, PlaybackFeedback>()
  private readonly times: number[]
  private readonly between: PlaybackFeedback

  constructor(
    private readonly workcell: Workcell,
    private readonly run: PresentedRun,
    private readonly publish: (view: PlaybackView) => void
  ) {
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
          complete:
            run.result.coverage === 'complete' &&
            run.result.execution === 'completed',
          message: 'Recorded witness - no new geometry calculation.'
        })
      }
    }

    this.times = [...this.cues.keys()].sort((a, b) => a - b)
    this.between = {
      origin: 'recorded',
      kind:
        run.result.summary === 'no-issue-within-scope' ? 'clear' : 'unresolved',
      checkedTime: null,
      bodyIds: [],
      pairNames: [],
      totalPairCount: run.result.totalPairCount,
      complete:
        run.result.coverage === 'complete' &&
        run.result.execution === 'completed',
      message: this.times.length
        ? `${run.result.findingPairCount} issue pairs in this analysis. Playback pauses at established collision witnesses.`
        : 'Reusing recorded interval evidence - no new geometry calculation.'
    }
  }

  sample(time: number, options: LiveSampleOptions) {
    if (!this.alive) return

    let shown = time
    let cue = this.cues.get(time)
    const previousTime = this.previous

    if (
      !options.discontinuity &&
      previousTime !== null &&
      time > previousTime
    ) {
      const crossed = this.times.find(
        (value) =>
          value > previousTime &&
          value <= time &&
          this.cues.get(value)?.kind === 'collision'
      )

      if (crossed !== undefined) cue = this.cues.get(crossed)
    }

    if (
      cue?.kind === 'collision' &&
      cue.checkedTime !== null &&
      (this.previous !== cue.checkedTime || options.discontinuity) &&
      options.onCollision(cue.checkedTime)
    )
      shown = cue.checkedTime

    this.previous = shown
    this.publish({
      workcell: this.workcell,
      joints: jointValuesAt(this.run.snapshot.trajectory, shown),
      time: shown,
      historical: false,
      bodyIds: [],
      feedback: cue ?? this.between
    })
  }

  dispose() {
    this.alive = false
  }
}
