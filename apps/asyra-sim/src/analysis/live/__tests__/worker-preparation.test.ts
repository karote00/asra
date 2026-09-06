import { expect, it, vi } from 'vitest'
import { INSTALLED_METHOD_CATALOG } from '../../../extensions/installed-methods'
import { originalWorkcellSnapshot } from '../../methods/__tests__/workcell-fixture'
import * as meshIndex from '../../methods/mesh-index'
import { runOriginalPartMethod } from '../../methods/original-part-method'
import { LiveWorkerHost } from '../worker-host'
import { LiveMessages, type LiveResponse } from '../protocol'
import { sampleSnapshot } from '../sample'

it('reuses complete original preparation through the installed live Worker and isolates successor Workers', async () => {
  const snapshot = await originalWorkcellSnapshot()
  const messages: LiveResponse[] = []
  const host = new LiveWorkerHost(INSTALLED_METHOD_CATALOG, (message) =>
    messages.push(message)
  )
  const build = vi.spyOn(meshIndex, 'buildMeshIndex')
  const durations: number[] = []

  try {
    await host.handle({ type: LiveMessages.OPEN, snapshot })
    let firstBuilds = 0
    for (const [i, time] of [3.8, 3.9, 4, 4.1, 4.2].entries()) {
      const start = performance.now()
      await host.handle({ type: LiveMessages.SAMPLE, id: i + 1, time })
      durations.push(performance.now() - start)
      expect(messages.at(-1)?.type).toBe(LiveMessages.RESULT)
      if (!i) firstBuilds = build.mock.calls.length
      expect(build).toHaveBeenCalledTimes(firstBuilds)
    }
    expect(firstBuilds).toBeGreaterThan(0)
    // eslint-disable-next-line no-console -- permanent bounded normal Worker host profile
    console.info(
      JSON.stringify({
        profile: 'live-original-worker-poses',
        indexBuilds: firstBuilds,
        poseMs: durations.map(Math.round)
      })
    )

    const successor = new LiveWorkerHost(
      INSTALLED_METHOD_CATALOG,
      () => undefined
    )
    await successor.handle({ type: LiveMessages.OPEN, snapshot })
    await successor.handle({ type: LiveMessages.SAMPLE, id: 1, time: 4 })
    expect(build).toHaveBeenCalledTimes(firstBuilds * 2)
  } finally {
    build.mockRestore()
  }

  for (const message of messages) {
    if (message.type === LiveMessages.RESULT)
      expect(message.evidence).toEqual(
        runOriginalPartMethod(sampleSnapshot(snapshot, message.time))
      )
  }
}, 20000)
