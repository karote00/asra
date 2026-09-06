import { describe, expect, it, vi } from 'vitest'
import type { VisualAsset } from '../decode'
import { RestrictedGlbPreviewWorker } from '../preview-worker'
import { GLB_LIMITS } from '../schema'

const asset: VisualAsset = {
  format: 'restricted-glb-v0',
  source: { sha256: 'a'.repeat(64), byteLength: 3, lengthUnit: 'm' },
  meshes: [
    {
      name: 'Triangle',
      sourceNode: 0,
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
      color: 0xffffff,
      opacity: 1
    }
  ],
  bounds: { min: [0, 0, 0], max: [1, 1, 0] }
}

class WorkerStub {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
}

describe('M2 restricted GLB preview worker ownership', () => {
  it('rejects oversized input before copying or allocating a worker', async () => {
    const worker = new WorkerStub(),
      create = vi.fn(() => worker as unknown as Worker),
      preview = new RestrictedGlbPreviewWorker(create)
    const pending = preview
      .decode(new Uint8Array(GLB_LIMITS.bytes + 1))
      .catch((error: unknown) => error)
    try {
      expect(create).not.toHaveBeenCalled()
      expect(await pending).toMatchObject({
        message: expect.stringContaining('limit')
      })
    } finally {
      preview.dispose()
      await pending
    }
  })

  it('enforces the five-second import deadline and releases the owned worker and timer', async () => {
    vi.useFakeTimers()
    const worker = new WorkerStub(),
      preview = new RestrictedGlbPreviewWorker(
        () => worker as unknown as Worker
      )
    const pending = preview
      .decode(new Uint8Array([1, 2, 3]))
      .catch((error: unknown) => error)
    try {
      vi.advanceTimersByTime(4999)
      expect(worker.terminate).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(worker.terminate).toHaveBeenCalledOnce()
      expect(await pending).toMatchObject({
        message: expect.stringContaining('deadline')
      })
      expect(worker.onmessage).toBeNull()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      preview.dispose()
      await pending
      vi.useRealTimers()
    }
  })

  it('fails explicitly on an unreadable worker response', async () => {
    const worker = new WorkerStub(),
      preview = new RestrictedGlbPreviewWorker(
        () => worker as unknown as Worker
      )
    const pending = preview
      .decode(new Uint8Array([1, 2, 3]))
      .catch((error: unknown) => error)
    try {
      expect(worker.onmessageerror).toBeTypeOf('function')
      worker.onmessageerror?.(new MessageEvent('messageerror'))
      expect(await pending).toMatchObject({
        message: expect.stringContaining('deserialize')
      })
      expect(worker.terminate).toHaveBeenCalledOnce()
    } finally {
      preview.dispose()
      await pending
    }
  })

  it('rejects an otherwise valid response when validation crosses the deadline', async () => {
    vi.useFakeTimers()
    const worker = new WorkerStub(),
      preview = new RestrictedGlbPreviewWorker(
        () => worker as unknown as Worker
      ),
      clone = globalThis.structuredClone
    const cloneSpy = vi
      .spyOn(globalThis, 'structuredClone')
      .mockImplementation((value) => {
        const result = clone(value)
        vi.setSystemTime(Date.now() + GLB_LIMITS.deadlineMs)
        return result
      })
    const pending = preview
      .decode(new Uint8Array([1, 2, 3]))
      .catch((error: unknown) => error)
    try {
      const message = worker.postMessage.mock.calls[0]?.[0] as { id: number }
      worker.onmessage?.(
        new MessageEvent('message', {
          data: { id: message.id, ok: true, asset }
        })
      )
      expect(await pending).toMatchObject({
        message: expect.stringContaining('deadline')
      })
      expect(worker.terminate).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      preview.dispose()
      await pending
      cloneSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('transfers detached copied bytes and terminates after a validated response', async () => {
    const worker = new WorkerStub()
    const preview = new RestrictedGlbPreviewWorker(
      () => worker as unknown as Worker
    )
    const source = new Uint8Array([1, 2, 3])
    const pending = preview.decode(source)
    source.fill(9)
    const [message, transfer] = worker.postMessage.mock.calls[0] as [
      { id: number; bytes: ArrayBuffer },
      Transferable[]
    ]
    expect(Array.from(new Uint8Array(message.bytes))).toEqual([1, 2, 3])
    expect(transfer).toEqual([message.bytes])
    worker.onmessage?.(
      new MessageEvent('message', {
        data: { id: message.id, ok: true, asset }
      })
    )
    const result = await pending
    expect(result).toEqual(asset)
    expect(Object.isFrozen(result.meshes[0]?.positions)).toBe(true)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('terminates promptly on abort and discards a late response', async () => {
    const worker = new WorkerStub(),
      controller = new AbortController(),
      preview = new RestrictedGlbPreviewWorker(
        () => worker as unknown as Worker
      )
    const pending = preview.decode(new Uint8Array([1, 2, 3]), controller.signal)
    const message = worker.postMessage.mock.calls[0]?.[0] as { id: number }
    controller.abort()
    worker.onmessage?.(
      new MessageEvent('message', {
        data: { id: message.id, ok: true, asset }
      })
    )
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('terminates and exposes decoder or worker failures without fallback output', async () => {
    const decoderWorker = new WorkerStub(),
      decoder = new RestrictedGlbPreviewWorker(
        () => decoderWorker as unknown as Worker
      ),
      decoderPending = decoder.decode(new Uint8Array([1]))
    const message = decoderWorker.postMessage.mock.calls[0]?.[0] as {
      id: number
    }
    decoderWorker.onmessage?.(
      new MessageEvent('message', {
        data: { id: message.id, ok: false, error: 'Unsupported GLB feature' }
      })
    )
    await expect(decoderPending).rejects.toThrow('Unsupported GLB feature')
    expect(decoderWorker.terminate).toHaveBeenCalledOnce()

    const crashedWorker = new WorkerStub(),
      crashed = new RestrictedGlbPreviewWorker(
        () => crashedWorker as unknown as Worker
      ),
      crashedPending = crashed.decode(new Uint8Array([1]))
    crashedWorker.onerror?.({ message: 'Worker crashed' } as ErrorEvent)
    await expect(crashedPending).rejects.toThrow('Worker crashed')
    expect(crashedWorker.terminate).toHaveBeenCalledOnce()
  })
})
