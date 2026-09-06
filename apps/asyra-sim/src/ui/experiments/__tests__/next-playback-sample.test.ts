import { expect, it } from 'vitest'
import { liveFixture } from '../../../analysis/live/__tests__/fixtures'
import { nextPlaybackSample } from '../next-playback-sample'

it('protects crossed keyframes and endpoints while coalescing ordinary samples without a pending-frame list', () => {
  const { trajectory, interval } = liveFixture()

  expect(nextPlaybackSample(trajectory, interval, 8, null, 0)).toBe(0)
  expect(nextPlaybackSample(trajectory, interval, 8, 0, 0)).toBe(4)
  expect(nextPlaybackSample(trajectory, interval, 8, 4, 0)).toBe(8)
  expect(nextPlaybackSample(trajectory, interval, 3.9, 3, 0)).toBeCloseTo(3.8)
  expect(nextPlaybackSample(trajectory, interval, 5.1, null, 5.1)).toBe(5.1)
  expect(nextPlaybackSample(trajectory, interval, 5.11, 5.1, 5.1)).toBe(5.1)
})
