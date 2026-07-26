import type { SharedPublication } from '@asyra/factory'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clonePublication } from '../cloning'

const profilerGlobal = globalThis as typeof globalThis & {
  __asyraBrowserDragPhaseSink?: (
    phaseName: string,
    durationMs: number
  ) => void
}

afterEach(() => {
  delete profilerGlobal.__asyraBrowserDragPhaseSink
})

describe('collaboration clone profiling', () => {
  it('reports detached clone timing without changing publication data', () => {
    const sink = vi.fn()
    profilerGlobal.__asyraBrowserDragPhaseSink = sink
    const publication: SharedPublication = {
      publicationId: 'publication-a',
      transactionId: 1,
      origin: 'action',
      deliveries: [
        {
          deliveryId: 'delivery-a',
          transactionId: 1,
          origin: 'action',
          kind: 'forward',
          channel: 'sceneTree',
          eventName: 'addElement',
          payload: { id: 'element-a' },
          sharedDelivery: 'immediate'
        }
      ]
    }

    const cloned = clonePublication(publication)

    expect(cloned).toEqual(publication)
    expect(cloned).not.toBe(publication)
    expect(cloned.deliveries).not.toBe(publication.deliveries)
    expect(sink).toHaveBeenCalledOnce()
    expect(sink).toHaveBeenCalledWith(
      'collaboration:clone-publication',
      expect.any(Number)
    )
  })
})
