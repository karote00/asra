import type { Trajectory } from '../../domain/workcell'
import { LIVE_LIMITS } from '../../analysis/live/protocol'

/** Protect crossed canonical keyframes; coalesce optional intermediate poses. */
export function nextPlaybackSample(
  trajectory: Trajectory,
  interval: readonly [number, number],
  displayedTime: number,
  checkedTime: number | null,
  anchorTime: number
): number {
  if (checkedTime === null) return anchorTime

  let low = 0
  let high = trajectory.keyframes.length

  while (low < high) {
    const middle = Math.floor((low + high) / 2)

    if (trajectory.keyframes[middle].time <= checkedTime) low = middle + 1
    else high = middle
  }

  const next = trajectory.keyframes[low]

  if (next && next.time <= displayedTime) return next.time

  if (displayedTime === interval[1]) return displayedTime

  const step = LIVE_LIMITS.samplePeriodMs
  const gridTime =
    interval[0] +
    (Math.floor(((displayedTime - interval[0]) * 1000) / step) * step) / 1000

  return Math.max(checkedTime, Math.min(displayedTime, gridTime))
}
