import { expect, it, vi } from 'vitest'
import { createMethodCatalog } from '../../../extensions/catalog'
import type { MethodRegistration } from '../../../extensions/contracts'
import { runOfficialClearanceMethod } from '../../methods/official-method'
import { sampleSnapshot } from '../sample'
import { INSTALLED_METHOD_CATALOG } from '../../../extensions/installed-methods'
import { LiveWorkerHost } from '../worker-host'
import { LiveMessages, type LiveResponse } from '../protocol'
import { liveFixture } from './fixtures'

it('publishes an admitted collision before the remaining method work finishes', async () => {
  const input = liveFixture(true)
  const original = INSTALLED_METHOD_CATALOG.resolve(
    input.method.id,
    input.method.version
  )
  const evidence = runOfficialClearanceMethod(sampleSnapshot(input, 4))
  const collision = evidence.pairs.find((pair) =>
    pair.evidence.leaves.some((leaf) => leaf.state === 'finding')
  )
  if (!collision) throw new Error('Missing collision fixture')
  let release: () => void = () => undefined
  const execute: MethodRegistration['execute'] = async (_snapshot, context) => {
    context.emitPair(collision)
    await new Promise<void>((resolve) => {
      release = resolve
    })
    return evidence
  }
  const messages: LiveResponse[] = []
  const host = new LiveWorkerHost(
    createMethodCatalog([{ ...original, execute }]),
    (message) => messages.push(message)
  )

  await host.handle({ type: LiveMessages.OPEN, snapshot: input })
  const task = host.handle({ type: LiveMessages.SAMPLE, id: 1, time: 4 })

  try {
    expect(messages.at(-1)).toMatchObject({
      type: 'progress',
      id: 1,
      time: 4,
      pairs: [collision]
    })
    expect(
      messages.some((message) => message.type === LiveMessages.RESULT)
    ).toBe(false)
  } finally {
    release()
    await task
  }
})

it('creates one installed executor per admitted Worker input, with fresh per-sample contexts', async () => {
  const input = liveFixture()
  const original = INSTALLED_METHOD_CATALOG.resolve(
    input.method.id,
    input.method.version
  )
  const execute = vi.fn(original.execute)
  const fallback = vi.fn(original.execute)
  const createExecutor = vi.fn(() => execute)
  const catalog = createMethodCatalog([
    { ...original, execute: fallback, createExecutor }
  ])
  const host = new LiveWorkerHost(catalog, () => undefined)

  await host.handle({ type: LiveMessages.OPEN, snapshot: input })
  await host.handle({ type: LiveMessages.SAMPLE, id: 1, time: 4 })
  await host.handle({ type: LiveMessages.SAMPLE, id: 2, time: 8 })

  expect(createExecutor).toHaveBeenCalledOnce()
  expect(fallback).not.toHaveBeenCalled()
  expect(execute).toHaveBeenCalledTimes(2)
  expect(execute.mock.calls[0][1].signal).not.toBe(
    execute.mock.calls[1][1].signal
  )
  expect(() => execute.mock.calls[0][1].checkpoint()).toThrow()
})

it('admits one input lifetime and executes static samples without a report or canonical mutation', async () => {
  const messages: LiveResponse[] = []
  const input = liveFixture()
  const before = structuredClone(input)
  const host = new LiveWorkerHost(INSTALLED_METHOD_CATALOG, (message) =>
    messages.push(message)
  )

  await host.handle({ type: LiveMessages.OPEN, snapshot: input })
  await host.handle({ type: LiveMessages.SAMPLE, id: 1, time: 4 })
  await host.handle({ type: LiveMessages.SAMPLE, id: 2, time: 8 })

  expect(messages.map((message) => message.type)).toEqual([
    'ready',
    'result',
    'result'
  ])
  expect(messages[1]).toMatchObject({ id: 1, time: 4 })
  expect(messages[1]).not.toHaveProperty('runId')
  expect(input).toEqual(before)

  await expect(
    host.handle({ type: LiveMessages.SAMPLE, id: 2, time: 8 })
  ).rejects.toThrow()
  await expect(
    host.handle({ type: LiveMessages.SAMPLE, id: 3, time: 9 })
  ).rejects.toThrow()
})

it('bounds each sample deadline independently and leaves exhaustion explicitly incomplete', async () => {
  const messages: LiveResponse[] = []
  let ticks = 0
  const host = new LiveWorkerHost(
    INSTALLED_METHOD_CATALOG,
    (message) => messages.push(message),
    () => ticks++ * 1000
  )

  await host.handle({ type: LiveMessages.OPEN, snapshot: liveFixture() })
  await host.handle({ type: LiveMessages.SAMPLE, id: 1, time: 4 })

  expect(messages[1]).toMatchObject({
    type: LiveMessages.ERROR,
    id: 1,
    time: 4,
    pairs: []
  })
})
