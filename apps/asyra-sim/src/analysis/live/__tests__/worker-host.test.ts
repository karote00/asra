import { expect, it } from 'vitest'
import { INSTALLED_METHOD_CATALOG } from '../../../extensions/installed-methods'
import { LiveWorkerHost } from '../worker-host'
import { LiveMessages, type LiveResponse } from '../protocol'
import { liveFixture } from './fixtures'

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
