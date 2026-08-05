import type { SharedPublication } from '@asyra/factory'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpDocumentPersistenceClient } from '../document-persistence-client'
import { createDocumentPersistenceQueue } from '../document-persistence-queue'

const publication = (publicationId: string): SharedPublication => ({
  publicationId,
  artifactId: `artifact-${publicationId}`,
  transactionId: 1,
  origin: 'action',
  mode: 'atomic',
  slices: []
})

const entry = (sequence: number, byteLength = 128) => ({
  sequence,
  publication: publication(`publication-${sequence}`),
  byteLength
})

afterEach(() => {
  vi.useRealTimers()
})

describe('document persistence queue', () => {
  it('flushes on the first fixed three-second dirty deadline without debounce', async () => {
    vi.useFakeTimers()
    const sendBatch = vi.fn().mockResolvedValueOnce({ durableSequence: 2 })
    const queue = createDocumentPersistenceQueue({
      documentId: 'document-a',
      sendBatch
    })

    queue.enqueue(entry(1))
    await vi.advanceTimersByTimeAsync(2_500)
    queue.enqueue(entry(2))
    await vi.advanceTimersByTimeAsync(499)
    expect(sendBatch).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(sendBatch).toHaveBeenCalledOnce()
    expect(sendBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'document-a',
        expectedDurableSequence: 0,
        firstSequence: 1,
        lastSequence: 2,
        entries: [
          expect.objectContaining({ documentId: 'document-a', sequence: 1 }),
          expect.objectContaining({ documentId: 'document-a', sequence: 2 })
        ]
      })
    )
    expect(queue.getState()).toMatchObject({
      durableSequence: 2,
      pendingCount: 0
    })
    expect(queue.getState().inFlightBatchId).toBeUndefined()
    queue.dispose()
  })

  it('rejects flush intervals outside the named one-to-three-second policy', () => {
    for (const flushIntervalMs of [999, 3_001]) {
      expect(() =>
        createDocumentPersistenceQueue({
          documentId: 'document-a',
          flushIntervalMs,
          sendBatch: vi.fn()
        })
      ).toThrow(/1000.*3000/)
    }
  })

  it('flushes early at count or serialized-byte policy limits', async () => {
    vi.useFakeTimers()
    const countSend = vi.fn().mockResolvedValue({ durableSequence: 2 })
    const countQueue = createDocumentPersistenceQueue({
      documentId: 'count-document',
      maxPublicationCount: 2,
      maxSerializedBytes: 10_000,
      sendBatch: countSend
    })
    countQueue.enqueue(entry(1))
    countQueue.enqueue(entry(2))
    await vi.runAllTicks()
    expect(countSend).toHaveBeenCalledOnce()

    const byteSend = vi.fn().mockResolvedValue({ durableSequence: 1 })
    const byteQueue = createDocumentPersistenceQueue({
      documentId: 'byte-document',
      maxPublicationCount: 10,
      maxSerializedBytes: 200,
      sendBatch: byteSend
    })
    byteQueue.enqueue(entry(1, 200))
    await vi.runAllTicks()
    expect(byteSend).toHaveBeenCalledOnce()

    countQueue.dispose()
    byteQueue.dispose()
  })

  it('keeps one request in flight and preserves later entries for the next batch', async () => {
    vi.useFakeTimers()
    const first = Promise.withResolvers<Readonly<{ durableSequence: number }>>()
    const sendBatch = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ durableSequence: 2 })
    const queue = createDocumentPersistenceQueue({
      documentId: 'document-a',
      maxPublicationCount: 1,
      sendBatch
    })

    queue.enqueue(entry(1))
    await vi.runAllTicks()
    queue.enqueue(entry(2))
    await vi.advanceTimersByTimeAsync(3_000)
    expect(sendBatch).toHaveBeenCalledOnce()

    first.resolve({ durableSequence: 1 })
    await vi.runAllTicks()

    expect(sendBatch).toHaveBeenCalledTimes(2)
    expect(sendBatch.mock.calls[1]?.[0]).toMatchObject({
      expectedDurableSequence: 1,
      firstSequence: 2,
      lastSequence: 2
    })
    queue.dispose()
  })

  it('retains one complete high-detail create Undo Redo tail behind an in-flight request', async () => {
    vi.useFakeTimers()
    const first = Promise.withResolvers<Readonly<{ durableSequence: number }>>()
    const queue = createDocumentPersistenceQueue({
      documentId: 'high-detail-history-chain',
      sendBatch: vi.fn(() => first.promise)
    })
    const publicationByteLength = 5 * 1024 * 1024

    queue.enqueue(entry(1, publicationByteLength))
    void queue.flushNow()
    await vi.runAllTicks()

    const admission = queue.enqueueBatchWhenAvailable(
      Array.from({ length: 42 }, (_, index) =>
        entry(index + 2, publicationByteLength)
      )
    )
    let admitted = false
    const observedAdmission = admission.then(
      () => {
        admitted = true
      },
      () => undefined
    )

    try {
      await vi.runAllTicks()

      expect(admitted).toBe(true)
      expect(queue.getState()).toMatchObject({
        durableSequence: 0,
        headSequence: 43,
        pendingCount: 42
      })
    } finally {
      queue.dispose()
      first.resolve({ durableSequence: 1 })
      await observedAdmission
    }
  })

  it('drains only one contiguous durable prefix within the request byte limit', async () => {
    vi.useFakeTimers()
    const first = Promise.withResolvers<Readonly<{ durableSequence: number }>>()
    const second =
      Promise.withResolvers<Readonly<{ durableSequence: number }>>()
    const sendBatch = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const queue = createDocumentPersistenceQueue({
      documentId: 'bounded-durable-request',
      maxSerializedBytes: 1_000,
      maxBatchSerializedBytes: 250,
      sendBatch
    })

    queue.enqueue(entry(1, 200))
    void queue.flushNow()
    await vi.runAllTicks()
    queue.enqueueBatch([entry(2, 150), entry(3, 150), entry(4, 150)])

    first.resolve({ durableSequence: 1 })
    await vi.advanceTimersByTimeAsync(3_000)

    expect(sendBatch).toHaveBeenCalledTimes(2)
    expect(sendBatch.mock.calls[1]?.[0]).toMatchObject({
      expectedDurableSequence: 1,
      firstSequence: 2,
      lastSequence: 2
    })
    expect(queue.getState()).toMatchObject({
      durableSequence: 1,
      headSequence: 4,
      pendingCount: 2
    })

    queue.dispose()
    second.resolve({ durableSequence: 2 })
  })

  it('stops admission when the bounded next batch fills behind an in-flight request', async () => {
    vi.useFakeTimers()
    const first = Promise.withResolvers<Readonly<{ durableSequence: number }>>()
    const editability = vi.fn()
    const queue = createDocumentPersistenceQueue({
      documentId: 'bounded-document',
      maxPublicationCount: 2,
      maxSerializedBytes: 10_000,
      onEditabilityChange: editability,
      sendBatch: vi.fn(() => first.promise)
    })

    queue.enqueue(entry(1))
    await vi.advanceTimersByTimeAsync(3_000)
    queue.enqueue(entry(2))
    queue.enqueue(entry(3))

    expect(queue.getState()).toMatchObject({
      editable: false,
      pendingCount: 2
    })
    expect(editability).toHaveBeenCalledWith(false)
    expect(() => queue.enqueue(entry(4))).toThrow(/unavailable|durable/)

    queue.dispose()
    first.resolve({ durableSequence: 1 })
  })

  it('waits to atomically admit a multi-publication batch after durable capacity is released', async () => {
    vi.useFakeTimers()
    const first = Promise.withResolvers<Readonly<{ durableSequence: number }>>()
    const sendBatch = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ durableSequence: 2 })
      .mockResolvedValueOnce({ durableSequence: 4 })
    const queue = createDocumentPersistenceQueue({
      documentId: 'atomic-capacity-document',
      maxPublicationCount: 2,
      maxSerializedBytes: 10_000,
      sendBatch
    })

    queue.enqueue(entry(1))
    await vi.advanceTimersByTimeAsync(3_000)
    queue.enqueue(entry(2))

    const admission = queue.enqueueBatchWhenAvailable([entry(3), entry(4)])
    let admitted = false
    void admission.then(() => {
      admitted = true
    })
    await vi.runAllTicks()

    expect(admitted).toBe(false)
    expect(queue.getState()).toMatchObject({
      editable: true,
      headSequence: 2,
      pendingCount: 1
    })

    first.resolve({ durableSequence: 1 })
    await vi.runAllTicks()
    await admission

    expect(admitted).toBe(true)
    expect(queue.getState()).toMatchObject({
      headSequence: 4,
      pendingCount: 0
    })
    expect(sendBatch.mock.calls[1]?.[0]).toMatchObject({
      expectedDurableSequence: 1,
      firstSequence: 2,
      lastSequence: 4
    })

    queue.dispose()
  })

  it('retains and retries the exact failed batch before making the accepted tail durable', async () => {
    vi.useFakeTimers()
    const editability = vi.fn()
    const durability = vi.fn()
    const first = Promise.withResolvers<Readonly<{ durableSequence: number }>>()
    const sendBatch = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ durableSequence: 1 })
      .mockResolvedValueOnce({ durableSequence: 2 })
    const queue = createDocumentPersistenceQueue({
      documentId: 'document-a',
      maxPublicationCount: 1,
      retryIntervalMs: 1_000,
      onEditabilityChange: editability,
      onDurableSequenceChange: durability,
      sendBatch
    })

    queue.enqueue(entry(1))
    await vi.runAllTicks()
    const failedBatch = sendBatch.mock.calls[0]?.[0]
    queue.enqueue(entry(2))
    first.reject(new Error('backend unavailable'))
    await vi.runAllTicks()

    expect(editability).toHaveBeenCalledWith(false)
    expect(queue.getState()).toMatchObject({
      editable: false,
      durableSequence: 0
    })

    await vi.advanceTimersByTimeAsync(1_000)

    expect(sendBatch.mock.calls[1]?.[0]).toBe(failedBatch)
    expect(sendBatch).toHaveBeenCalledTimes(3)
    expect(sendBatch.mock.calls[2]?.[0]).toMatchObject({
      expectedDurableSequence: 1,
      firstSequence: 2,
      lastSequence: 2
    })
    expect(editability).toHaveBeenLastCalledWith(true)
    expect(durability.mock.calls).toEqual([[1], [2]])
    expect(queue.getState()).toMatchObject({
      editable: true,
      durableSequence: 2,
      pendingCount: 0
    })
    queue.dispose()
  })

  it('does not advance or release a batch on a non-contiguous durable acknowledgement', async () => {
    vi.useFakeTimers()
    const sendBatch = vi
      .fn()
      .mockResolvedValueOnce({ durableSequence: 2 })
      .mockResolvedValueOnce({ durableSequence: 1 })
    const queue = createDocumentPersistenceQueue({
      documentId: 'document-a',
      maxPublicationCount: 1,
      retryIntervalMs: 1_000,
      sendBatch
    })

    queue.enqueue(entry(1))
    await vi.runAllTicks()
    const retainedBatch = sendBatch.mock.calls[0]?.[0]
    expect(queue.getState()).toMatchObject({
      editable: false,
      durableSequence: 0
    })

    await vi.advanceTimersByTimeAsync(1_000)

    expect(sendBatch.mock.calls[1]?.[0]).toBe(retainedBatch)
    expect(queue.getState()).toMatchObject({
      editable: true,
      durableSequence: 1
    })
    queue.dispose()
  })

  it('attempts an immediate stable batch on graceful shutdown', async () => {
    vi.useFakeTimers()
    const sendBatch = vi.fn().mockResolvedValue({ durableSequence: 1 })
    const queue = createDocumentPersistenceQueue({
      documentId: 'document-a',
      sendBatch
    })
    queue.enqueue(entry(1))

    await queue.flushForShutdown()

    expect(sendBatch).toHaveBeenCalledOnce()
    expect(sendBatch.mock.calls[0]?.[0]).toMatchObject({
      firstSequence: 1,
      lastSequence: 1
    })
    queue.dispose()
  })

  it('retries the exact HTTP batch body after a backend non-success response', async () => {
    vi.useFakeTimers()
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: vi.fn()
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ durableSequence: 1 })
      })
    const client = createHttpDocumentPersistenceClient({
      baseURL: 'http://127.0.0.1:4317',
      fetchImplementation
    })
    const queue = createDocumentPersistenceQueue({
      documentId: 'file/a',
      maxPublicationCount: 1,
      retryIntervalMs: 1_000,
      sendBatch: (batch) => client.sendBatch(batch)
    })

    queue.enqueue(entry(1))
    await vi.runAllTicks()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(fetchImplementation).toHaveBeenCalledTimes(2)
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:4317/api/documents/file%2Fa/persistence-batches'
    )
    expect(fetchImplementation.mock.calls[1]?.[1]?.body).toBe(
      fetchImplementation.mock.calls[0]?.[1]?.body
    )
    expect(queue.getState()).toMatchObject({
      editable: true,
      durableSequence: 1
    })
    queue.dispose()
  })

  it('reads the authoritative bootstrap checkpoint from the explicit backend origin', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        checkpoint: { elements: [{ id: 'element-a' }] },
        durableSequence: 7
      })
    })
    const client = createHttpDocumentPersistenceClient({
      baseURL: 'http://127.0.0.1:4317',
      fetchImplementation
    })

    await expect(client.readCheckpoint('file/a')).resolves.toEqual({
      checkpoint: { elements: [{ id: 'element-a' }] },
      durableSequence: 7
    })
    expect(fetchImplementation).toHaveBeenCalledWith(
      'http://127.0.0.1:4317/api/documents/file%2Fa/bootstrap-checkpoint',
      {
        method: 'GET',
        headers: { accept: 'application/json' }
      }
    )
  })
})
