import { useEffect, useRef, useState } from 'react'
import { PlaybackClock } from './playback-clock'

export function PlaybackControls({
  interval,
  active,
  onSample,
  onReset
}: {
  interval: readonly [number, number]
  active: boolean
  onSample: (time: number) => void
  onReset: () => void
}) {
  const [time, setTime] = useState(interval[0])
  const [playing, setPlaying] = useState(false)
  const clock = useRef<PlaybackClock | null>(null)
  const current = useRef({ onSample, active })
  current.current = { onSample, active }
  const sample = (value: number) => {
    setTime(value)
    current.current.onSample(value)
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
      if (document.hidden) pause()
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
    sample(from)
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
    <section className="playback-card" aria-label="Trajectory preview">
      <div className="section-heading">
        <h3>Motion preview</h3>
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
          sample(Number(event.target.value))
        }}
      />
      <div className="playback-actions">
        <button
          className="primary"
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
            sample(interval[0])
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
      <p className="hint">
        1× speed. Visual preview only, not a collision test.
      </p>
    </section>
  )
}
