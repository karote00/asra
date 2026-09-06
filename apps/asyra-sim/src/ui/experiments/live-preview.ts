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

export interface LiveSampleOptions {
  discontinuity: boolean
  onCollision: (time: number) => boolean
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
  private onCollision: (time: number) => boolean = () => false
  private lastSample: LiveState['sample'] = null
  completion: Promise<void>

  constructor(
    private readonly workcell: Workcell,
    private readonly trajectory: Trajectory,
    private readonly interval: readonly [number, number],
    private readonly createSnapshot: () => ExperimentSnapshot,
    private readonly api: SimRuntime['features']['live'],
    private readonly publish: (view: PlaybackView) => void,
    previous: Promise<void> = Promise.resolve()
  ) {
    this.completion = previous
  }

  sample(time: number, options: LiveSampleOptions) {
    if (!this.alive) return

    this.time = time
    this.onCollision = options.onCollision

    if (options.discontinuity) {
      this.feedback = checkingFeedback()
      this.lastSample = null
      this.anchorTime = time
    }

    this.anchorTime ??= time
    this.queryTime = this.nextTime()

    if (!this.abort) this.start()
    else if (this.opened) this.api.sample(this.queryTime, options.discontinuity)

    this.project()
  }

  private nextTime() {
    return nextPlaybackSample(
      this.trajectory,
      this.interval,
      this.time,
      this.lastSample?.time ?? null,
      this.anchorTime ?? this.time
    )
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
            state.status === 'ready' &&
            state.sample &&
            state.sample !== this.lastSample
          ) {
            this.lastSample = state.sample
            this.feedback = playbackFeedback(this.snapshot, state.sample)

            if (
              this.feedback.kind === 'collision' &&
              this.onCollision(state.sample.time)
            ) {
              this.time = state.sample.time
              this.stopWork()
            }

            if (this.opened && this.nextTime() > state.sample.time) {
              // Continue after dropped display frames, without recursive cache delivery.
              queueMicrotask(() => {
                if (!this.alive || abort.signal.aborted || !this.opened) return

                this.queryTime = this.nextTime()
                this.api.sample(this.queryTime)
              })
            }
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
