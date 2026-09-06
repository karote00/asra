export interface FrameScheduler {
  request: (callback: (time: number) => void) => number
  cancel: (handle: number) => void
  now: () => number
}

/** Transient wall-clock playback; never owns geometry, analysis or history. */
export class PlaybackClock {
  private handle: number | null = null
  private generation = 0

  constructor(private readonly scheduler: FrameScheduler) {}

  pause() {
    this.generation++

    if (this.handle !== null) this.scheduler.cancel(this.handle)

    this.handle = null
  }

  play(
    from: number,
    end: number,
    sample: (time: number) => void,
    stopped: () => void
  ) {
    this.pause()

    if (!Number.isFinite(from) || !Number.isFinite(end) || from >= end) return

    const generation = this.generation

    const start = this.scheduler.now()

    const tick = (now: number) => {
      if (generation !== this.generation) return

      this.handle = null

      const time = Math.min(end, from + Math.max(0, now - start) / 1000)

      sample(time)

      if (generation !== this.generation) return

      if (time === end) stopped()
      else this.handle = this.scheduler.request(tick)
    }

    this.handle = this.scheduler.request(tick)
  }
}
