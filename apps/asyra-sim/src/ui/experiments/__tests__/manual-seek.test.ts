import { expect, it } from 'vitest'
import { jointValuesAt } from '../../../domain/workcell'
import { playbackHighlight } from '../playback-highlight'
import { seekFixture } from './seek-fixture'

it.each(['clearance', 'collision'] as const)(
  'keeps a checked pose and %s paired through cold forward and backward seeks',
  async (kind) => {
    const f = seekFixture()

    try {
      f.preview.sample(3.6, { discontinuity: true })
      await Promise.resolve()
      f.deliver(3.6, kind)
      const first = f.latest()
      const color = playbackHighlight(first)?.color

      for (const target of [3.65, 3.7, 3.75, 3.55]) {
        const previous = f.latest()
        const before = f.publish.mock.calls.length
        f.preview.sample(target, { discontinuity: true })

        expect(f.latest()).toMatchObject({
          time: previous.time,
          pendingTime: target,
          feedback: { kind, checkedTime: previous.time }
        })
        expect(f.latest().joints).toEqual(previous.joints)

        const pendingPublications = f.publish.mock.calls.length
        f.deliver(target, kind, true)
        expect(f.publish).toHaveBeenCalledTimes(pendingPublications)
        expect(f.latest().time).toBe(previous.time)

        f.deliver(target, kind)
        expect(f.latest()).toMatchObject({
          time: target,
          feedback: { kind, checkedTime: target, complete: true }
        })
        expect(f.latest().joints).toEqual(
          jointValuesAt(f.input.trajectory, target)
        )

        for (const [view] of f.publish.mock.calls.slice(before)) {
          expect(view.feedback?.checkedTime).toBe(view.time)
          expect(playbackHighlight(view)?.color).toBe(color)
        }
      }

      expect(f.create).toHaveBeenCalledOnce()
      expect(f.sample).toHaveBeenCalledTimes(5)
    } finally {
      f.preview.dispose()
      await f.preview.completion
    }
  }
)

it('only presents the latest target, then removes the warning on an actually clear result', async () => {
  const f = seekFixture()

  try {
    f.preview.sample(4, { discontinuity: true })
    await Promise.resolve()
    f.deliver(4, 'collision')
    f.preview.sample(4.1, { discontinuity: true })
    f.preview.sample(2, { discontinuity: true })
    f.deliver(4.1, 'collision', true)
    f.deliver(4.1, 'collision')

    expect(f.latest()).toMatchObject({ time: 4, pendingTime: 2 })

    f.deliver(2, 'clear')
    expect(f.latest()).toMatchObject({
      time: 2,
      feedback: { kind: 'clear', checkedTime: 2 }
    })
    expect(playbackHighlight(f.latest())).toBeUndefined()
    expect(f.latest().pendingTime).toBeUndefined()
  } finally {
    f.preview.dispose()
    await f.preview.completion
  }
})

it('preserves the currently displayed state when a manual seek follows forward Play', async () => {
  const f = seekFixture()

  try {
    f.preview.sample(3.6, { discontinuity: false })
    await Promise.resolve()
    f.deliver(3.6, 'collision')
    f.preview.sample(3.7, { discontinuity: false })
    const displayed = f.latest()

    f.preview.sample(2, { discontinuity: true })

    expect(f.latest()).toMatchObject({
      time: displayed.time,
      joints: displayed.joints,
      pendingTime: 2,
      feedback: displayed.feedback
    })
    f.deliver(2, 'clear')
    expect(f.latest()).toMatchObject({ time: 2, feedback: { kind: 'clear' } })
  } finally {
    f.preview.dispose()
    await f.preview.completion
  }
})

it('uses exact cached results without a reset frame or a second input capture', async () => {
  const f = seekFixture()

  try {
    f.preview.sample(4, { discontinuity: true })
    await Promise.resolve()
    f.deliver(4, 'collision')
    f.preview.sample(3.6, { discontinuity: true })
    f.deliver(3.6, 'clearance')
    const before = f.publish.mock.calls.length

    f.preview.sample(4, { discontinuity: true })

    for (const [view] of f.publish.mock.calls.slice(before))
      expect(view).toMatchObject({
        time: 4,
        feedback: { kind: 'collision', checkedTime: 4 }
      })
    expect(f.create).toHaveBeenCalledOnce()
    expect(f.sample).toHaveBeenCalledTimes(3)
  } finally {
    f.preview.dispose()
    await f.preview.completion
  }
})

it('shows an unchecked first target and a failed target explicitly, without retaining a false warning', async () => {
  const f = seekFixture()

  try {
    f.preview.sample(4, { discontinuity: true })
    await Promise.resolve()
    expect(f.latest()).toMatchObject({
      time: 4,
      feedback: { kind: 'checking' }
    })
    f.deliver(4, 'collision')
    f.preview.sample(2, { discontinuity: true })
    f.fail()

    expect(f.latest()).toMatchObject({ time: 2, feedback: { kind: 'error' } })
    expect(f.latest().pendingTime).toBeUndefined()
    expect(playbackHighlight(f.latest())).toBeUndefined()
  } finally {
    f.preview.dispose()
    await f.preview.completion
  }
})
