import { afterEach, describe, expect, it, vi } from 'vitest'
import { subscribeToBrowserDragPhases } from '@asyra/utils'
import { clonePublication } from '../cloning'
import { createSharedPublicationFixture } from './shared-publication-fixture'

const disposers: (() => void)[] = []

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose())
})

describe('collaboration clone profiling', () => {
  it('reports detached clone timing without changing publication data', () => {
    const sink = vi.fn()
    disposers.push(subscribeToBrowserDragPhases(sink))
    const publication = createSharedPublicationFixture({
      mode: 'progressive',
      publicationId: 'publication-a',
      transactionId: 1,
      delivery: {
        deliveryId: 'delivery-a',
        channel: 'sceneTree',
        eventName: 'addElement',
        orderedIds: ['element-a'],
        payload: { id: 'element-a' }
      }
    })

    const cloned = clonePublication(publication)

    expect(cloned).toEqual(publication)
    expect(cloned).not.toBe(publication)
    expect(cloned.slices).not.toBe(publication.slices)
    expect(cloned.slices[0]?.batches).not.toBe(publication.slices[0]?.batches)
    expect(cloned.slices[0]?.batches[0]?.deliveries[0]?.payload).not.toBe(
      publication.slices[0]?.batches[0]?.deliveries[0]?.payload
    )
    expect(sink).toHaveBeenCalledOnce()
    expect(sink).toHaveBeenCalledWith(
      'collaboration:clone-publication',
      expect.any(Number)
    )
  })
})
