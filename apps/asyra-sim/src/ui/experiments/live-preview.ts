import type { ExperimentSnapshot } from '../../analysis/contracts'
import type { LiveState } from '../../analysis/live/protocol'
import type { SimRuntime } from '../../init/bootstrap'
import {
  jointValuesAt,
  type Trajectory,
  type Workcell
} from '../../domain/workcell'
import type { PlaybackView } from './playback-view'
import {
  checkingFeedback,
  playbackFeedback,
  type PlaybackFeedback
} from './playback-feedback'
import { nextPlaybackSample } from './next-playback-sample'
import type { RecordedPlaybackEvidence } from './recorded-playback-evidence'

export interface LiveSampleOptions {
  discontinuity: boolean
}

/** Owns one transient UI playback lifetime; method results never become model state. */
export class LivePreview {
  private alive = true
  private time = 0
  private queryTime = 0
  private anchorTime: number | null = null
  private snapshot: ExperimentSnapshot | null = null
  private abort: AbortController | null = null
  private unsubscribe: (() => void) | null = null
  private opened = false
  private feedback: PlaybackFeedback = checkingFeedback()
  private lastSample: LiveState['sample'] = null
  private checkedTime: number | null = null
  private generation = 0
  completion: Promise<void>

  constructor(
    private readonly workcell: Workcell,
    private readonly trajectory: Trajectory,
    private readonly interval: readonly [number, number],
    private readonly createSnapshot: () => ExperimentSnapshot,
    private readonly api: SimRuntime['features']['live'],
    private readonly publish: (view: PlaybackView) => void,
    previous: Promise<void> = Promise.resolve(),
    private readonly recorded?: RecordedPlaybackEvidence
  ) {
    this.completion = previous
  }

  sample(time: number, options: LiveSampleOptions) {
    if (!this.alive) return

    this.time = time

    if (options.discontinuity) {
      this.feedback = checkingFeedback()
      this.lastSample = null
      this.checkedTime = null
      this.anchorTime = time
      this.generation++
    }

    this.anchorTime ??= time
    this.request(this.nextTime(), options.discontinuity)

    this.project()
  }

  private nextTime() {
    const next = nextPlaybackSample(
      this.trajectory,
      this.interval,
      this.time,
      this.checkedTime,
      this.anchorTime ?? this.time
    )
    const witness = this.recorded?.nextWitness(this.checkedTime, this.time)

    return witness === undefined ? next : Math.min(next, witness)
  }

  private request(time: number, discontinuity = false) {
    if (time === this.checkedTime && !discontinuity) return

    this.queryTime = time

    const recorded = this.recorded?.at(time)

    if (recorded) {
      this.stopWork()
      this.lastSample = null
      this.accept(recorded)
      return
    }

    if (!this.abort) this.start()
    else if (this.opened) this.api.sample(time, discontinuity)
  }

  private accept(feedback: PlaybackFeedback) {
    this.feedback = feedback
    this.checkedTime = feedback.checkedTime
    this.project()

    if (this.checkedTime !== null && this.nextTime() > this.checkedTime) {
      const generation = this.generation

      // Catch up after dropped frames without a queue or recursive cache delivery.
      queueMicrotask(() => {
        if (!this.alive || generation !== this.generation) return

        this.request(this.nextTime())
      })
    }
  }

  private project() {
    if (!this.alive) return

    this.publish({
      workcell: this.workcell,
      joints: jointValuesAt(this.trajectory, this.time),
      time: this.time,
      historical: false,
      bodyIds: [],
      feedback: this.feedback
    })
  }

  private start() {
    const abort = new AbortController()

    this.abort = abort

    this.completion = this.completion
      .then(async () => {
        if (!this.alive || abort.signal.aborted) return

        this.snapshot ??= this.createSnapshot()
        this.unsubscribe = this.api.subscribe(() => {
          if (!this.alive || abort.signal.aborted || !this.snapshot) return

          const state = this.api.getState()

          if (state.status === 'error') {
            this.feedback = {
              ...checkingFeedback(),
              kind: 'error',
              message: state.error ?? 'Live check unavailable'
            }
          } else if (
            (state.status === 'ready' || state.status === 'checking') &&
            state.sample &&
            state.sample !== this.lastSample
          ) {
            this.lastSample = state.sample
            const feedback = playbackFeedback(this.snapshot, state.sample)

            if (state.status === 'ready') {
              this.accept(feedback)
              return
            }

            // Show admitted findings now; only terminal evidence advances sampling.
            this.feedback = feedback
          }

          this.project()
        })

        this.opened = true

        await this.api.open(this.snapshot, this.queryTime, {
          signal: abort.signal
        })
      })
      .catch((error: unknown) => {
        if (!this.alive || abort.signal.aborted) return

        this.feedback = {
          ...checkingFeedback(),
          kind: 'error',
          message:
            error instanceof Error ? error.message : 'Live check unavailable'
        }
        this.project()
      })
  }

  private stopWork() {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.opened = false
    this.abort?.abort()
    this.abort = null
  }

  dispose() {
    this.alive = false
    this.stopWork()
  }
}
