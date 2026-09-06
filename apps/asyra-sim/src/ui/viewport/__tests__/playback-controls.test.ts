// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { PlaybackControls } from '../playback-controls'

it('checks the exact user-paused frame and resets sampling when Play restarts from the endpoint', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(performance, 'now').mockReturnValue(0)

  let frame: FrameRequestCallback = () => undefined

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frame = callback
    return 1
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

  const host = document.createElement('div')
  const root = createRoot(host)
  const onSample = vi.fn()
  const click = async (name: string) => {
    const button = host.querySelector<HTMLButtonElement>(
      `[aria-label="${name} trajectory"]`
    )

    if (!button) throw new Error(`Missing ${name} control`)

    await act(() => button.click())
  }

  try {
    await act(() =>
      root.render(
        createElement(PlaybackControls, {
          interval: [0, 8],
          active: true,
          onReset: () => undefined,
          onSample
        })
      )
    )
    await click('Play')
    await act(() => frame(3377))
    await click('Pause')

    expect(onSample).toHaveBeenLastCalledWith(3.377, { discontinuity: true })
    expect(host.querySelector('.preview-time')?.textContent).toBe('3.3770 s')

    await click('Play')
    await act(() => frame(8000))
    await click('Play')

    expect(onSample).toHaveBeenLastCalledWith(0, { discontinuity: true })
  } finally {
    await act(() => root.unmount())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})

it('keeps Play running and exposes no automatic collision pause control', async () => {
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
            // Probe the retired control contract: evidence must not stop the clock.
            if (
              'onCollision' in options &&
              typeof options.onCollision === 'function'
            )
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

    const pause = host.querySelector<HTMLButtonElement>(
      '[aria-label="Pause trajectory"]'
    )

    expect(pause).not.toBeNull()
    expect(request).toHaveBeenCalledOnce()
    expect(host.textContent).not.toContain('Pause on collision')

    await act(() => pause?.click())

    expect(host.querySelector('[aria-label="Pause trajectory"]')).toBeNull()
  } finally {
    await act(() => root.unmount())

    host.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})
