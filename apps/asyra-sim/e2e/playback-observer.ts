import type { Page } from '@playwright/test'

export interface PlaybackObservation {
  playhead: number
  checked: number
  elapsedMs: number
  text: string
}

/** Observe transient ordinary DOM feedback without polling past a short collision. */
export async function observePlaybackFeedback(
  page: Page,
  expected: { kind?: string; time?: number }
) {
  await page.evaluate((expected) => {
    const started = performance.now()
    const observation = new Promise<PlaybackObservation>((resolve) => {
      const read = () => {
        const notice = document.querySelector(
          '[data-testid="playback-feedback"]'
        )
        const checked = notice?.textContent?.match(/Checked ([\d.]+) s/)
        const slider = document.querySelector<HTMLInputElement>(
          'input[aria-label="Sampled trajectory preview time"]'
        )

        if (!notice || !checked || !slider) return
        if (expected.kind && notice.getAttribute('data-kind') !== expected.kind)
          return
        if (expected.time !== undefined && Number(checked[1]) !== expected.time)
          return

        observer.disconnect()
        resolve({
          playhead: Number(slider.value),
          checked: Number(checked[1]),
          elapsedMs: performance.now() - started,
          text: notice.textContent ?? ''
        })
      }
      const observer = new MutationObserver(read)
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['data-kind']
      })
      read()
    })
    Object.assign(window, { playbackFeedbackObservation: observation })
  }, expected)

  return () =>
    page.evaluate(
      () =>
        Reflect.get(
          window,
          'playbackFeedbackObservation'
        ) as Promise<PlaybackObservation>
    )
}
