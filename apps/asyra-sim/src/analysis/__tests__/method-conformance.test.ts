import { describe, expect, it, vi } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { createMethodCatalog } from '../../extensions/catalog'
import { INSTALLED_METHOD_CATALOG } from '../../extensions/installed-methods'
import type {
  MethodContext,
  MethodRegistration
} from '../../extensions/contracts'
import { MethodIds, MethodVersions } from '../../constants'
import { createExperimentSnapshot } from '../snapshot'
import { runStaticSphereMethod } from '../methods/static-spheres'
import { AnalysisWorkerHost } from '../worker-host'
import type { AnalysisWorkerResponse } from '../worker-protocol'

function setup(execute?: MethodRegistration['execute']) {
  const original = INSTALLED_METHOD_CATALOG.resolve(
    MethodIds.STATIC_SPHERES,
    MethodVersions.STATIC_SPHERES
  )
  const catalog = createMethodCatalog([
    { ...original, execute: execute ?? original.execute }
  ])
  const example = createSyntheticExample(),
    draft = createSyntheticExperimentDraft(example)
  const workcell = {
    ...example.workcell,
    bodies: example.workcell.bodies.map((body) => ({
      ...body,
      colliders: body.colliders.map((collider) => ({
        ...collider,
        geometry: { kind: 'sphere' as const, radius: 0.1 }
      }))
    }))
  }
  const snapshot = createExperimentSnapshot({
    snapshotId: 'conformance',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell,
    definition: {
      ...draft,
      revision: 1,
      rule: { ...draft.rule, revision: 1 },
      interval: [0, 0],
      trajectory: { version: 1, keyframes: [draft.trajectory.keyframes[0]] },
      method: {
        id: original.descriptor.id,
        version: original.descriptor.version,
        settings: {
          ...draft.method.settings,
          parameters: { additionalError: 0 }
        }
      }
    },
    methods: catalog.descriptors,
    acknowledgedWarningCodes: []
  })
  const messages: AnalysisWorkerResponse[] = [],
    close = vi.fn()
  const host = new AnalysisWorkerHost(
    catalog,
    (message) => messages.push(structuredClone(message)),
    close
  )
  return {
    snapshot,
    messages,
    close,
    host,
    request: { type: 'run' as const, runId: 'conformance-run', snapshot }
  }
}

describe('shared method Worker protocol conformance', () => {
  it('executes the selected independent module with frozen inputs and rejects late emissions', async () => {
    let context: MethodContext | undefined
    const execute: MethodRegistration['execute'] = (input, current) => {
      context = current
      expect(Object.isFrozen(input.workcell.bodies[0])).toBe(true)
      return runStaticSphereMethod(input, current.checkpoint, current.emitPair)
    }
    const { host, request, messages, close } = setup(execute)
    await host.handle(request)
    expect(messages.at(-1)).toMatchObject({
      type: 'complete',
      runId: 'conformance-run',
      evidence: { method: { id: MethodIds.STATIC_SPHERES } }
    })
    expect(messages.some((message) => message.type === 'progress')).toBe(true)
    expect(close).toHaveBeenCalledOnce()
    const count = messages.length,
      pair = runStaticSphereMethod(request.snapshot).pairs[0]
    expect(() => context?.emitPair(pair)).toThrow('settled')
    await host.handle(request)
    expect(messages).toHaveLength(count)
  })

  it('rejects a mismatched method before invoking trusted code', async () => {
    const execute = vi.fn(),
      { host, request, messages, close } = setup(execute)
    const snapshot = structuredClone(request.snapshot)
    snapshot.method.version = 'unavailable'
    delete snapshot.methodDescriptor
    await host.handle({ ...request, snapshot })
    expect(execute).not.toHaveBeenCalled()
    expect(messages.at(-1)).toMatchObject({
      type: 'error',
      error: expect.stringContaining('admission')
    })
    expect(close).toHaveBeenCalledOnce()
  })

  it('does not accept invalid output or false completeness and never exposes raw private errors', async () => {
    for (const execute of [
      () => {
        throw new Error('SECRET /private/customer-data token=123')
      },
      (input) => {
        const evidence = structuredClone(runStaticSphereMethod(input))
        evidence.pairs = []
        return evidence
      },
      (input) => {
        const evidence = structuredClone(runStaticSphereMethod(input))
        evidence.pairs[0].evidence.coverage = 'partial'
        return evidence
      }
    ] satisfies MethodRegistration['execute'][]) {
      const { host, request, messages, close } = setup(execute)
      await host.handle(request)
      expect(messages.at(-1)?.type).toBe('error')
      expect(JSON.stringify(messages)).not.toContain('SECRET')
      expect(JSON.stringify(messages)).not.toContain('/private/customer-data')
      expect(messages.some((message) => message.type === 'complete')).toBe(
        false
      )
      expect(close).toHaveBeenCalledOnce()
    }
  })

  it('propagates cancellation and never completes a cancelled asynchronous module', async () => {
    let release: (() => void) | undefined, signal: AbortSignal | undefined
    const { host, request, messages, close } = setup(async (input, context) => {
      signal = context.signal
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return runStaticSphereMethod(input)
    })
    const pending = host.handle(request)
    await host.handle({ type: 'cancel', runId: 'someone-else' })
    expect(signal?.aborted).toBe(false)
    await host.handle({ type: 'cancel', runId: request.runId })
    expect(signal?.aborted).toBe(true)
    release?.()
    await pending
    expect(messages.some((message) => message.type === 'complete')).toBe(false)
    expect(close).toHaveBeenCalledOnce()
  })
})
