// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { PlaybackControls } from '../playback-controls'

it('stays paused when a reused collision is available synchronously at Play start', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  const host = document.createElement('div')
  const root = createRoot(host)
  const request = vi.spyOn(window, 'requestAnimationFrame')

  document.body.append(host)

  try {
    await act(() =>
      root.render(
        createElement(PlaybackControls, {
          interval: [0, 8],
          active: true,
          onReset: () => undefined,
          onSample: (time, options) => {
            options.onCollision(time)
          }
        })
      )
    )

    const play = host.querySelector<HTMLButtonElement>(
      '[aria-label="Play trajectory"]'
    )

    if (!play) throw new Error('Missing Play control')

    await act(() => play.click())

    expect(host.querySelector('[aria-label="Pause trajectory"]')).toBeNull()
    expect(request).not.toHaveBeenCalled()
  } finally {
    await act(() => root.unmount())

    host.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})
