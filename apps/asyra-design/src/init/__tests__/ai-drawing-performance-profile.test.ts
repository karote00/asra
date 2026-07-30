import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TransactionStatusPayload } from '@asyra/utils'
import {
  attachAiDrawingPerformanceRuntimeEvidence,
  installAiDrawingPerformanceProfile,
  recordAiDrawingPerformancePublication,
  resolveAiDrawingPerformanceProfile
} from '../performance/ai-drawing-performance-profile'

const runtimeGlobal = globalThis as typeof globalThis & {
  __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
  __asyraDiagnosticCounterSink?: (name: string, value: number) => void
}

afterEach(() => {
  delete runtimeGlobal.__asyraBrowserDragPhaseSink
  delete runtimeGlobal.__asyraDiagnosticCounterSink
  delete window.__AsyraAiDrawingPerformance__
})

describe('AI drawing performance profile', () => {
  it('accepts one exact profiling configuration without an obsolete AI URL switch', () => {
    expect(
      resolveAiDrawingPerformanceProfile(
        '?aiDelivery=progressive&aiPerformance=profile'
      )
    ).toEqual({
      contentsMode: 'present',
      deliveryMode: 'progressive'
    })
    expect(
      resolveAiDrawingPerformanceProfile(
        '?aiDelivery=atomic&aiPerformance=profile&aiPerformanceContents=omitted'
      )
    ).toEqual({
      contentsMode: 'omitted',
      deliveryMode: 'atomic'
    })

    for (const search of [
      '',
      '?aiPerformance=profile&aiPerformance=profile',
      '?aiPerformance=profile&aiPerformanceContents=hidden',
      '?aiDelivery=progressive&aiDelivery=atomic&aiPerformance=profile'
    ]) {
      expect(resolveAiDrawingPerformanceProfile(search)).toBeNull()
    }
  })

  it('records detached monotonic samples and restores existing observers', () => {
    const priorPhase = vi.fn(() => {
      throw new Error('diagnostic failure')
    })
    const priorCounter = vi.fn()
    runtimeGlobal.__asyraBrowserDragPhaseSink = priorPhase
    runtimeGlobal.__asyraDiagnosticCounterSink = priorCounter
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(104)
      .mockReturnValueOnce(109)

    const profile = installAiDrawingPerformanceProfile({
      configuration: {
        contentsMode: 'present',
        deliveryMode: 'atomic'
      },
      now,
      runtime: 'production'
    })

    runtimeGlobal.__asyraBrowserDragPhaseSink?.('ui-context:flush', 3.5)
    runtimeGlobal.__asyraDiagnosticCounterSink?.('render:flush', 2)

    const first = profile.snapshot()
    expect(first).toEqual({
      configuration: {
        contentsMode: 'present',
        deliveryMode: 'atomic'
      },
      counters: [{ atMs: 9, name: 'render:flush', value: 2 }],
      phases: [{ atMs: 4, durationMs: 3.5, name: 'ui-context:flush' }],
      releaseEvidenceEligible: false,
      runtime: 'production'
    })
    expect(profile.readLatestPhaseSample()).toEqual({
      atMs: 4,
      durationMs: 3.5,
      name: 'ui-context:flush'
    })
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.phases)).toBe(true)
    expect(priorPhase).toHaveBeenCalledOnce()
    expect(priorCounter).toHaveBeenCalledOnce()

    profile.dispose()

    expect(runtimeGlobal.__asyraBrowserDragPhaseSink).toBe(priorPhase)
    expect(runtimeGlobal.__asyraDiagnosticCounterSink).toBe(priorCounter)
    expect(window.__AsyraAiDrawingPerformance__).toBeUndefined()
  })

  it('reads one accumulated counter without materializing a full profile snapshot', () => {
    const profile = installAiDrawingPerformanceProfile({
      configuration: {
        contentsMode: 'present',
        deliveryMode: 'progressive'
      },
      now: () => 0,
      runtime: 'production'
    })

    runtimeGlobal.__asyraDiagnosticCounterSink?.(
      'render-projection-outcome-applied',
      2
    )
    runtimeGlobal.__asyraDiagnosticCounterSink?.('unrelated-counter', 100)
    runtimeGlobal.__asyraDiagnosticCounterSink?.(
      'render-projection-outcome-applied',
      3
    )

    expect(profile.readCounterTotal('render-projection-outcome-applied')).toBe(
      5
    )
    expect(profile.readCounterTotal('missing-counter')).toBe(0)
    expect(profile.readLatestPhaseSample()).toBeNull()

    profile.reset()
    expect(profile.readCounterTotal('render-projection-outcome-applied')).toBe(
      0
    )

    profile.dispose()
  })

  it('reads detached conversation failure evidence without exposing the controller snapshot', () => {
    const profile = installAiDrawingPerformanceProfile({
      configuration: {
        contentsMode: 'present',
        deliveryMode: 'progressive'
      },
      now: () => 0,
      runtime: 'production'
    })
    const controllerSnapshot = {
      activeTurn: null,
      conversationId: 'conversation-a',
      disposed: false,
      settledTurns: [
        {
          attachments: [],
          conversationId: 'conversation-a',
          durationMs: 7,
          intent: 'create fixture',
          outcome: 'failed',
          progress: [],
          result: {
            code: 'AI_FEATURE_FAILED',
            stage: 'feature',
            status: 'failed'
          },
          turnId: 'conversation-a:turn:1'
        }
      ],
      targetHints: {
        compositionId: null,
        roleToElementIds: {}
      }
    } as const
    const detach = profile.attachConversation({
      subscribe: (
        subscriber: (snapshot: typeof controllerSnapshot) => void
      ) => {
        subscriber(controllerSnapshot)
        return () => undefined
      }
    } as never)

    const evidence = profile.readConversationSnapshot()

    expect(evidence).toEqual(controllerSnapshot)
    expect(evidence).not.toBe(controllerSnapshot)
    expect(evidence?.settledTurns).not.toBe(controllerSnapshot.settledTurns)

    detach()
    profile.dispose()
  })

  it('marks development observations as ineligible for release budgets', () => {
    const profile = installAiDrawingPerformanceProfile({
      configuration: {
        contentsMode: 'omitted',
        deliveryMode: 'progressive'
      },
      now: () => 0,
      runtime: 'development'
    })

    expect(profile.snapshot()).toMatchObject({
      releaseEvidenceEligible: false,
      runtime: 'development'
    })

    profile.dispose()
  })

  it('marks Contents omission as attribution-only even in production', () => {
    const profile = installAiDrawingPerformanceProfile({
      configuration: {
        contentsMode: 'omitted',
        deliveryMode: 'atomic'
      },
      now: () => 0,
      runtime: 'production'
    })

    expect(profile.snapshot().releaseEvidenceEligible).toBe(false)

    profile.dispose()
  })

  it('captures detached canonical and Factory evidence without exposing runtime owners', () => {
    let transactionSubscriber:
      | ((status: TransactionStatusPayload) => void)
      | undefined
    const detachTransactions = vi.fn()
    let authoritativeHistoryDepth = 0
    let renderProjectionElementCount = 1
    const canonicalElements = [
      {
        computed: {
          fills: [{ color: '#FFFFFF' }]
        },
        id: 'vector-1',
        raw: {
          props: {
            points: {
              pointA: { x: 1, y: 2 }
            }
          }
        },
        rendered: true,
        type: 'vector'
      }
    ]
    const canonicalOwnerSnapshot = {
      props: {
        'stroke-1': {
          id: 'stroke-1',
          type: 'stroke'
        }
      },
      sceneTree: {
        'vector-1': canonicalElements[0].raw
      }
    }
    const epochNow = vi.fn<() => number>().mockReturnValueOnce(1_000)
    const profile = installAiDrawingPerformanceProfile({
      configuration: {
        contentsMode: 'present',
        deliveryMode: 'progressive'
      },
      epochNow,
      now: () => 0,
      runtime: 'production'
    })

    const detachRuntime = attachAiDrawingPerformanceRuntimeEvidence(profile, {
      readCanonicalElementCount: () => canonicalElements.length,
      readCanonicalElements: () => canonicalElements,
      readCanonicalOwnerSnapshot: () => canonicalOwnerSnapshot,
      readHistoryDepth: () => authoritativeHistoryDepth,
      readRenderProjectionElementCount: () => renderProjectionElementCount,
      subscribeToTransactionStatus: (subscriber) => {
        transactionSubscriber = subscriber
        return detachTransactions
      }
    })

    expect(profile).not.toHaveProperty('attachRuntimeEvidence')
    expect(profile.readCanonicalElementCount()).toBe(1)
    expect(profile.readFactoryPublicationCount()).toBe(0)
    expect(profile.readHistoryDepth()).toBe(0)
    expect(profile.readRenderProjectionElementCount()).toBe(1)
    renderProjectionElementCount = 7077
    expect(profile.readRenderProjectionElementCount()).toBe(7077)
    renderProjectionElementCount = -1
    expect(() => profile.readRenderProjectionElementCount()).toThrow(
      'Render projection element count is invalid'
    )
    renderProjectionElementCount = 1
    recordAiDrawingPerformancePublication(profile, {
      deliveryCount: 2,
      publicationId: 'publication-1'
    })
    expect(profile.readFactoryPublicationCount()).toBe(1)
    transactionSubscriber?.({
      changeCount: 2,
      failure: {
        cause: new TypeError('canonical mutation failed'),
        kind: 'handler-error',
        message: 'action rolled back'
      },
      nonRollbackableChangeCount: 0,
      origin: 'action',
      rollbackableChangeCount: 2,
      status: 'rolled-back',
      timestamp: 700,
      transactionId: 6,
      undoableChangeCount: 2
    })
    expect(profile.readHistoryDepth()).toBe(0)
    authoritativeHistoryDepth = 1
    expect(profile.readHistoryDepth()).toBe(1)
    transactionSubscriber?.({
      changeCount: 2,
      nonRollbackableChangeCount: 0,
      origin: 'action',
      rollbackableChangeCount: 2,
      status: 'committed',
      timestamp: 750,
      transactionId: 7,
      undoableChangeCount: 2
    })

    expect(profile.getRuntimeEvidence()).toEqual({
      factoryCommits: [
        {
          capturedAtMs: 750,
          origin: 'action',
          transactionId: 7,
          undoableChangeCount: 2
        }
      ],
      factoryPublications: [
        {
          capturedAtMs: 1_000,
          deliveryCount: 2,
          publicationId: 'publication-1'
        }
      ],
      factoryStatuses: [
        {
          capturedAtMs: 700,
          changeCount: 2,
          failure: {
            cause: {
              message: 'canonical mutation failed',
              name: 'TypeError'
            },
            kind: 'handler-error',
            message: 'action rolled back'
          },
          nonRollbackableChangeCount: 0,
          origin: 'action',
          rollbackableChangeCount: 2,
          status: 'rolled-back',
          transactionId: 6,
          undoableChangeCount: 2
        },
        {
          capturedAtMs: 750,
          changeCount: 2,
          nonRollbackableChangeCount: 0,
          origin: 'action',
          rollbackableChangeCount: 2,
          status: 'committed',
          transactionId: 7,
          undoableChangeCount: 2
        }
      ]
    })
    const detachedStatusEvidence = profile.getRuntimeEvidence()
      .factoryStatuses[0] as {
      failure?: { cause?: { message?: string } }
    }
    if (detachedStatusEvidence.failure?.cause) {
      detachedStatusEvidence.failure.cause.message = 'polluted consumer value'
    }
    expect(
      (
        profile.getRuntimeEvidence().factoryStatuses[0]?.failure?.cause as {
          message?: string
        }
      ).message
    ).toBe('canonical mutation failed')

    const detachedElements = profile.readCanonicalElements()
    expect(detachedElements).toEqual(canonicalElements)
    expect(detachedElements).not.toBe(canonicalElements)
    ;(
      detachedElements[0].raw as {
        props: { points: { pointA: { x: number } } }
      }
    ).props.points.pointA.x = 99
    expect(canonicalElements[0].raw.props.points.pointA.x).toBe(1)
    const detachedOwnerSnapshot = profile.readCanonicalOwnerSnapshot()
    expect(detachedOwnerSnapshot).toEqual(canonicalOwnerSnapshot)
    expect(detachedOwnerSnapshot).not.toBe(canonicalOwnerSnapshot)
    ;(
      detachedOwnerSnapshot.props as {
        'stroke-1': { type: string }
      }
    )['stroke-1'].type = 'polluted'
    expect(canonicalOwnerSnapshot.props['stroke-1'].type).toBe('stroke')

    profile.reset()
    expect(profile.getRuntimeEvidence()).toEqual({
      factoryCommits: [],
      factoryPublications: [],
      factoryStatuses: []
    })
    expect(profile.readFactoryPublicationCount()).toBe(0)

    transactionSubscriber?.({
      changeCount: 2,
      nonRollbackableChangeCount: 0,
      origin: 'remote',
      rollbackableChangeCount: 2,
      status: 'committed',
      timestamp: 800,
      transactionId: 8,
      undoableChangeCount: 0
    })
    expect(profile.readHistoryDepth()).toBe(1)
    expect(profile.getRuntimeEvidence().factoryCommits).toEqual([
      {
        capturedAtMs: 800,
        origin: 'remote',
        transactionId: 8,
        undoableChangeCount: 0
      }
    ])
    expect(profile.getRuntimeEvidence().factoryStatuses).toEqual([
      {
        capturedAtMs: 800,
        changeCount: 2,
        nonRollbackableChangeCount: 0,
        origin: 'remote',
        rollbackableChangeCount: 2,
        status: 'committed',
        transactionId: 8,
        undoableChangeCount: 0
      }
    ])

    detachRuntime()
    expect(detachTransactions).toHaveBeenCalledOnce()
    expect(() => profile.readCanonicalElements()).toThrow(
      'runtime evidence is unavailable'
    )
    expect(() => profile.readCanonicalOwnerSnapshot()).toThrow(
      'runtime evidence is unavailable'
    )
    expect(() => profile.readRenderProjectionElementCount()).toThrow(
      'runtime evidence is unavailable'
    )

    profile.dispose()
  })
})
