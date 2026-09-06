import { useEffect, useRef, useState } from 'react'
import { PlaybackClock } from './playback-clock'
import type { LiveSampleOptions } from '../experiments/live-preview'

export function PlaybackControls({
  interval,
  active,
  onSample,
  onReset,
  onSuspend
}: {
  interval: readonly [number, number]
  active: boolean
  onSample: (time: number, options: LiveSampleOptions) => void
  onReset: () => void
  onSuspend?: () => void
}) {
  const [time, setTime] = useState(interval[0])

  const [playing, setPlaying] = useState(false)
  const [pauseOnCollision, setPauseOnCollision] = useState(true)

  const clock = useRef<PlaybackClock | null>(null)

  const current = useRef({ onSample, active, onSuspend, pauseOnCollision })

  current.current = { onSample, active, onSuspend, pauseOnCollision }

  const sample = (value: number, discontinuity = false) => {
    let stopped = false

    setTime(value)

    current.current.onSample(value, {
      discontinuity,
      onCollision: (checkedTime) => {
        if (
          !current.current.active ||
          !current.current.pauseOnCollision ||
          document.hidden
        )
          return false

        pause()
        setTime(checkedTime)
        stopped = true

        return true
      }
    })

    return stopped
  }

  const pause = () => {
    clock.current?.pause()

    setPlaying(false)
  }

  useEffect(() => {
    clock.current = new PlaybackClock({
      request: (callback) => requestAnimationFrame(callback),
      cancel: (handle) => cancelAnimationFrame(handle),
      now: () => performance.now()
    })

    const hidden = () => {
      if (document.hidden) {
        pause()
        current.current.onSuspend?.()
      }
    }

    document.addEventListener('visibilitychange', hidden)

    return () => {
      clock.current?.pause()

      document.removeEventListener('visibilitychange', hidden)
    }
  }, [])

  useEffect(() => {
    if (!active) pause()
  }, [active])

  const play = () => {
    if (!active || document.hidden || interval[0] >= interval[1]) return

    const from = time >= interval[1] ? interval[0] : time

    if (sample(from)) return

    setPlaying(true)

    clock.current?.play(
      from,
      interval[1],
      (value) => {
        if (!current.current.active || document.hidden) {
          pause()

          return
        }

        sample(value)
      },
      () => setPlaying(false)
    )
  }

  return (
    <section
      className="playback-card grid gap-[10px] p-[13px] rounded-[7px] border
        border-sim-border bg-sim-raised [&_input]:p-0 [&_input]:accent-sim-focus
        [&_button]:justify-self-start"
      aria-label="Trajectory preview"
    >
      <div className="section-heading flex items-center justify-between [&_>_span]:text-[10px] [&_>_span]:text-sim-muted">
        <h3>Live playback</h3>

        <span className="preview-time">{time.toFixed(4)} s</span>
      </div>

      <input
        aria-label="Sampled trajectory preview time"
        type="range"
        min={interval[0]}
        max={interval[1]}
        step={Math.max(0.000001, (interval[1] - interval[0]) / 500)}
        value={time}
        onChange={(event) => {
          pause()

          sample(Number(event.target.value), true)
        }}
      />

      <div className="playback-actions flex flex-wrap gap-2 [&_button]:min-w-[70px]">
        <button
          className="primary bg-sim-accent text-[#fff] border-sim-accent [&:hover]:bg-sim-accent-hover"
          aria-label={playing ? 'Pause trajectory' : 'Play trajectory'}
          disabled={!active || interval[0] >= interval[1]}
          onClick={playing ? pause : play}
        >
          {playing ? 'Pause' : 'Play'}
        </button>

        <button
          aria-label="Restart trajectory"
          onClick={() => {
            pause()

            sample(interval[0], true)
          }}
        >
          Restart
        </button>

        <button
          aria-label="Return to editing pose"
          onClick={() => {
            pause()

            setTime(interval[0])

            onReset()
          }}
        >
          Edit pose
        </button>
      </div>

      <label className="flex flex-row items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={pauseOnCollision}
          onChange={(event) => setPauseOnCollision(event.target.checked)}
        />
        Pause on collision
      </label>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        1× speed. Reuses recorded evidence; otherwise checks sampled poses live.
        A full-path report still requires formal analysis.
      </p>
    </section>
  )
}
