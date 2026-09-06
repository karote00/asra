import { expect, it, vi } from 'vitest'
import { OBSERVATION_LIMITS } from '../../common-apis/observation-contract'
import { ObservationAttachmentArchive } from '../observation-archive'
import {
  validateObservationSources,
  verifyObservationSources
} from '../observation-source'

const file = (text = 'gap,mm\nfixture,25', filename = 'measurement.csv') => ({
  filename,
  bytes: new TextEncoder().encode(text)
})

it('retains detached opaque bytes with digest identity only after accepting an owned receipt', async () => {
  const archive = new ObservationAttachmentArchive(),
    input = file()
  const original = new Uint8Array(input.bytes)
  const pending = archive.prepare([input])
  input.bytes.fill(0)
  const receipt = await pending,
    [reference] = receipt.attachments
  expect(Object.isFrozen(receipt.attachments)).toBe(true)
  expect(reference).toMatchObject({
    filename: 'measurement.csv',
    mediaType: 'text/csv',
    byteLength: original.byteLength
  })
  expect(reference.sourceId).toMatch(/^sha256:[a-f0-9]{64}$/)
  expect(() => archive.resolve([reference])).toThrow('Missing')
  expect(archive.capture([])).toEqual([])
  archive.accept(receipt)
  expect(archive.bytes(reference.sourceId)).toEqual(original)
  archive.bytes(reference.sourceId).fill(0)
  expect(archive.bytes(reference.sourceId)).toEqual(original)
  const captured = archive.capture([reference.sourceId, reference.sourceId])
  expect(captured).toHaveLength(1)
  expect(captured[0]).not.toHaveProperty('filename')
  expect(await verifyObservationSources(captured)).toEqual(captured)
  const reopened = await ObservationAttachmentArchive.hydrate(captured)
  expect(reopened.bytes(reference.sourceId)).toEqual(original)
  expect(() => reopened.resolve([{ ...reference, byteLength: 999 }])).toThrow(
    'length'
  )
  expect(() => reopened.accept(receipt)).toThrow('receipt')
  archive.discard(receipt)
  expect(() => archive.accept(receipt)).toThrow('receipt')
  const next = await archive.prepare([file(undefined, 'other.csv')])
  archive.accept(next)
  expect(archive.capture([reference.sourceId])).toEqual(captured)
  archive.dispose()
  reopened.dispose()
  expect(() => archive.bytes(reference.sourceId)).toThrow('closed')
})

it('rejects invalid files, duplicate contents and revoked or forged receipts without retaining sources', async () => {
  const archive = new ObservationAttachmentArchive()
  for (const invalid of [
    [],
    [file('', 'empty.txt')],
    [file('x', '../unsafe.txt')],
    [file('x', 'page.html')],
    [
      {
        filename: 'large.pdf',
        bytes: new Uint8Array(OBSERVATION_LIMITS.fileBytes + 1)
      }
    ],
    Array.from({ length: 5 }, (_, i) => file(String(i))),
    [file(), file(undefined, 'copy.csv')]
  ])
    await expect(archive.prepare(invalid)).rejects.toThrow()
  const original = await archive.prepare([file()])
  expect(() => archive.accept(structuredClone(original))).toThrow('receipt')
  const current = await archive.prepare([file('a,b', 'new.csv')])
  expect(() => archive.accept(original)).toThrow('receipt')
  expect(() => archive.capture([original.attachments[0].sourceId])).toThrow(
    'Missing'
  )
  archive.dispose()
  expect(() => archive.accept(current)).toThrow('closed')
})

it('bounds accepted source count and aggregate original bytes including replay-retained sources', async () => {
  const archive = new ObservationAttachmentArchive(),
    ids: string[] = []
  for (let index = 0; index < OBSERVATION_LIMITS.sourceCount; index++) {
    const receipt = await archive.prepare([file(String(index))])
    archive.accept(receipt)
    ids.push(receipt.attachments[0].sourceId)
  }
  expect(archive.capture(ids)).toHaveLength(64)
  await expect(archive.prepare([file('one more')])).rejects.toThrow('count')
  archive.accept(await archive.prepare([file('0', 'same-content.txt')]))
  archive.dispose()
  const bytesArchive = new ObservationAttachmentArchive()
  for (let index = 0; index < 8; index++) {
    const bytes = new Uint8Array(OBSERVATION_LIMITS.fileBytes)
    bytes[0] = index
    bytesArchive.accept(
      await bytesArchive.prepare([{ filename: 'large.pdf', bytes }])
    )
  }
  await expect(bytesArchive.prepare([file('one more byte')])).rejects.toThrow(
    'byte'
  )
  bytesArchive.dispose()
})

it('rejects noncanonical Base64, bad digests and malformed collections before hydration', async () => {
  const archive = new ObservationAttachmentArchive()
  const receipt = await archive.prepare([file('a', 'one.txt')])
  archive.accept(receipt)
  const [source] = archive.capture([receipt.attachments[0].sourceId])
  for (const invalid of [
    undefined,
    [source, source],
    [{ ...source, version: 2 }],
    [{ ...source, base64: 'YR==' }],
    [{ ...source, base64: 'YQ=A' }],
    [{ ...source, byteLength: 2 }],
    [{ ...source, verified: true }],
    Array.from({ length: 65 }, (_, i) => ({
      ...source,
      sourceId: `sha256:${String(i).padStart(64, '0')}`
    }))
  ])
    expect(() => validateObservationSources(invalid)).toThrow()
  const corrupt = [{ ...source, base64: 'Yg==' }]
  expect(validateObservationSources(corrupt)).toEqual(corrupt)
  await expect(verifyObservationSources(corrupt)).rejects.toThrow('digest')
  await expect(ObservationAttachmentArchive.hydrate(corrupt)).rejects.toThrow(
    'digest'
  )
  const abort = new AbortController()
  abort.abort()
  await expect(
    ObservationAttachmentArchive.hydrate([source], abort.signal)
  ).rejects.toMatchObject({ name: 'AbortError' })
  archive.dispose()
})

it('rejects overlap and discards late digest output after cancellation or disposal', async () => {
  const result = await crypto.subtle.digest('SHA-256', file().bytes)
  for (const close of [false, true]) {
    const archive = new ObservationAttachmentArchive(),
      abort = new AbortController()
    let finish: (value: ArrayBuffer) => void = () => undefined
    const digest = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    try {
      const pending = archive.prepare([file()], abort.signal)
      expect(digest).toHaveBeenCalledOnce()
      await expect(archive.prepare([file('overlap')])).rejects.toThrow('active')
      if (close) archive.dispose()
      else abort.abort()
      finish(result)
      await expect(pending).rejects.toThrow(/closed|cancel/i)
      if (!close) expect(archive.capture([])).toEqual([])
    } finally {
      digest.mockRestore()
      archive.dispose()
    }
  }
})
