import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  emitBrowserDragPhase,
  emitDiagnosticCounter,
  subscribeToBrowserDragPhases,
  subscribeToDiagnosticCounters,
  type TransactionStatusPayload
} from '@asyra/utils'
import {
  attachAiDrawingPerformanceRuntimeEvidence,
  getActiveAiDrawingPerformanceProfile,
  isAiDrawingPerformanceProfileRequested,
  installAiDrawingPerformanceProfile,
  recordAiDrawingPerformancePublication
} from '../performance/ai-drawing-performance-profile'

const observerDisposers: (() => void)[] = []

afterEach(() => {
  getActiveAiDrawingPerformanceProfile()?.dispose()
  observerDisposers.splice(0).forEach((dispose) => dispose())
})

describe('AI drawing performance profile', () => {
  it('enables detached profiling from one exact diagnostic opt-in', () => {
    expect(
      isAiDrawingPerformanceProfileRequested('?aiPerformance=profile')
    ).toBe(true)
    expect(
      isAiDrawingPerformanceProfileRequested(
        '?fileId=fixture-16&aiPerformance=profile'
      )
    ).toBe(true)

    for (const search of [
      '',
      '?aiPerformance=disabled',
      '?aiPerformance=profile&aiPerformance=profile',
      '?aiPerformance='
    ]) {
      expect(isAiDrawingPerformanceProfileRequested(search)).toBe(false)
    }
  })

  it('records detached monotonic samples and restores existing observers', () => {
    const priorPhase = vi.fn(() => {
      throw new Error('diagnostic failure')
    })
    const priorCounter = vi.fn()
    observerDisposers.push(subscribeToBrowserDragPhases(priorPhase))
    observerDisposers.push(subscribeToDiagnosticCounters(priorCounter))
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(104)
      .mockReturnValueOnce(109)

    const profile = installAiDrawingPerformanceProfile({
      now,
      runtime: 'production'
    })

    emitBrowserDragPhase('ui-context:flush', 3.5)
    emitDiagnosticCounter('render:flush', 2)

    const first = profile.snapshot()
    expect(first).toEqual({
      counters: [{ atMs: 9, name: 'render:flush', value: 2 }],
      phases: [{ atMs: 4, durationMs: 3.5, name: 'ui-context:flush' }],
      releaseEvidenceEligible: false,
      runtime: 'production'
    })
    expect(first).not.toHaveProperty('configuration')
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

    emitBrowserDragPhase('after-dispose', 1)
    emitDiagnosticCounter('after-dispose', 1)
    expect(priorPhase).toHaveBeenLastCalledWith('after-dispose', 1)
    expect(priorCounter).toHaveBeenLastCalledWith('after-dispose', 1)
    expect(getActiveAiDrawingPerformanceProfile()).toBeNull()
  })

  it('reads one accumulated counter without materializing a full profile snapshot', () => {
    const profile = installAiDrawingPerformanceProfile({
      now: () => 0,
      runtime: 'production'
    })

    emitDiagnosticCounter('render-projection-outcome-applied', 2)
    emitDiagnosticCounter('unrelated-counter', 100)
    emitDiagnosticCounter('render-projection-outcome-applied', 3)

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

  it('bounds retained frame evidence without losing exact totals, latest phase, or release eligibility', () => {
    const evidenceCapacity = 16_384
    const profile = installAiDrawingPerformanceProfile({
      now: () => 0,
      runtime: 'production'
    })

    emitDiagnosticCounter('ai-turn:accepted', 1)
    emitBrowserDragPhase('ai-turn:accepted-to-settled', 12)
    emitBrowserDragPhase('ai-app:create-composition-batch', 3)
    emitDiagnosticCounter('ai-turn:outcome:success', 1)

    for (let index = 0; index < evidenceCapacity; index += 1) {
      emitDiagnosticCounter('render-frame-count', 1)
      emitBrowserDragPhase('render:flush-frame', index)
    }

    const snapshot = profile.snapshot()
    expect(snapshot.counters).toHaveLength(evidenceCapacity)
    expect(snapshot.phases).toHaveLength(evidenceCapacity)
    expect(snapshot.counters[0]).toEqual({
      atMs: 0,
      name: 'render-frame-count',
      value: 1
    })
    expect(snapshot.phases[0]).toEqual({
      atMs: 0,
      durationMs: 0,
      name: 'render:flush-frame'
    })
    expect(snapshot.phases.at(-1)).toEqual({
      atMs: 0,
      durationMs: evidenceCapacity - 1,
      name: 'render:flush-frame'
    })
    expect(
      snapshot.counters.some(({ name }) => name === 'ai-turn:accepted')
    ).toBe(false)
    expect(
      snapshot.phases.some(({ name }) => name === 'ai-turn:accepted-to-settled')
    ).toBe(false)
    expect(
      snapshot.phases.some(
        ({ name }) => name === 'ai-app:create-composition-batch'
      )
    ).toBe(false)
    expect(profile.readCounterTotal('ai-turn:accepted')).toBe(1)
    expect(profile.readCounterTotal('ai-turn:outcome:success')).toBe(1)
    expect(profile.readCounterTotal('render-frame-count')).toBe(
      evidenceCapacity
    )
    expect(profile.readPhaseCount('ai-app:create-composition-batch')).toBe(1)
    expect(profile.readPhaseCount('missing-phase')).toBe(0)
    expect(profile.readLatestPhaseSample()).toEqual({
      atMs: 0,
      durationMs: evidenceCapacity - 1,
      name: 'render:flush-frame'
    })
    expect(snapshot.releaseEvidenceEligible).toBe(true)

    profile.reset()
    expect(profile.snapshot()).toMatchObject({
      counters: [],
      phases: [],
      releaseEvidenceEligible: false
    })
    expect(profile.readCounterTotal('render-frame-count')).toBe(0)
    expect(profile.readPhaseCount('ai-app:create-composition-batch')).toBe(0)
    expect(profile.readLatestPhaseSample()).toBeNull()

    profile.dispose()
  })

  it('bounds diagnostic names and accumulated counter key space', () => {
    const counterKeyCapacity = 1_024
    const profile = installAiDrawingPerformanceProfile({
      now: () => 0,
      runtime: 'production'
    })

    for (let index = 0; index < counterKeyCapacity; index += 1) {
      emitDiagnosticCounter(`counter-${index}`, 1)
    }
    emitDiagnosticCounter('counter-overflow', 1)
    emitDiagnosticCounter('counter-0', 1)
    const oversizedName = `phase-${'x'.repeat(512)}`
    emitBrowserDragPhase(oversizedName, 1)
    emitDiagnosticCounter(oversizedName, 1)

    expect(profile.readCounterTotal('counter-0')).toBe(2)
    expect(profile.readCounterTotal('counter-overflow')).toBe(0)
    expect(profile.readCounterTotal(oversizedName)).toBe(0)
    expect(
      profile
        .snapshot()
        .counters.some(({ name }) => name === 'counter-overflow')
    ).toBe(false)
    expect(
      profile.snapshot().phases.some(({ name }) => name === oversizedName)
    ).toBe(false)

    profile.dispose()
  })

  it('reads detached conversation failure evidence without exposing the controller snapshot', () => {
    const profile = installAiDrawingPerformanceProfile({
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
    expect(profile.readLatestTurnSettlement()).toEqual({
      code: 'AI_FEATURE_FAILED',
      message: null,
      outcome: 'failed',
      stage: 'feature',
      status: 'failed'
    })

    detach()
    profile.dispose()
  })

  it('records ordered runtime progress spans for local owner attribution', () => {
    let subscriber:
      | ((snapshot: {
          activeTurn: {
            progress: readonly {
              attempt: number
              phase: string
              summary: string
            }[]
          } | null
          settledTurns: readonly { durationMs: number; outcome: string }[]
        }) => void)
      | undefined
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(11)
      .mockReturnValueOnce(31)
      .mockReturnValueOnce(36)
      .mockReturnValueOnce(46)
      .mockReturnValueOnce(56)
      .mockReturnValueOnce(66)
    const profile = installAiDrawingPerformanceProfile({
      now,
      runtime: 'production'
    })
    profile.attachConversation({
      subscribe: (nextSubscriber: typeof subscriber) => {
        subscriber = nextSubscriber
        return () => undefined
      }
    } as never)
    const progress: {
      attempt: number
      phase: string
      summary: string
    }[] = []
    const publish = (phase: string) => {
      progress.push({ attempt: 1, phase, summary: phase })
      subscriber?.({
        activeTurn: { progress: [...progress] },
        settledTurns: []
      })
    }

    subscriber?.({ activeTurn: { progress: [] }, settledTurns: [] })
    publish('context')
    publish('provider')
    publish('resolution')
    publish('permission')
    publish('execution')
    subscriber?.({
      activeTurn: null,
      settledTurns: [{ durationMs: 55, outcome: 'success' }]
    })

    expect(profile.snapshot().phases).toEqual([
      { atMs: 31, durationMs: 20, name: 'ai-runtime:context' },
      { atMs: 36, durationMs: 5, name: 'ai-runtime:provider' },
      { atMs: 46, durationMs: 10, name: 'ai-runtime:resolution' },
      { atMs: 56, durationMs: 10, name: 'ai-runtime:permission' },
      { atMs: 66, durationMs: 10, name: 'ai-runtime:execution' },
      { atMs: 66, durationMs: 55, name: 'ai-turn:accepted-to-settled' }
    ])

    profile.dispose()
  })

  it('bounds settlement strings without reading accessors or nested server geometry', () => {
    const profile = installAiDrawingPerformanceProfile({
      now: () => 0,
      runtime: 'production'
    })
    const stageGetter = vi.fn(() => {
      throw new Error('stage accessor must not run')
    })
    const geometryTrap = vi.fn(() => {
      throw new Error('nested geometry must not be traversed')
    })
    const result: Record<string, unknown> = {
      code: 'C'.repeat(100),
      geometry: new Proxy(
        {},
        {
          getOwnPropertyDescriptor: geometryTrap,
          getPrototypeOf: geometryTrap,
          ownKeys: geometryTrap
        }
      ),
      message: 'M'.repeat(400),
      status: 'failed'
    }
    Object.defineProperty(result, 'stage', {
      enumerable: true,
      get: stageGetter
    })
    profile.attachConversation({
      subscribe: (subscriber: (snapshot: unknown) => void) => {
        subscriber({
          activeTurn: null,
          settledTurns: [
            {
              durationMs: 1,
              outcome: 'failed',
              result
            }
          ]
        })
        return () => undefined
      }
    } as never)

    expect(profile.readLatestTurnSettlement()).toEqual({
      code: 'C'.repeat(80),
      message: 'M'.repeat(300),
      outcome: 'failed',
      stage: null,
      status: 'failed'
    })
    expect(stageGetter).not.toHaveBeenCalled()
    expect(geometryTrap).not.toHaveBeenCalled()
    profile.dispose()
  })

  it('marks development observations as ineligible for release budgets', () => {
    const profile = installAiDrawingPerformanceProfile({
      now: () => 0,
      runtime: 'development'
    })

    emitDiagnosticCounter('ai-turn:accepted', 1)
    emitBrowserDragPhase('ai-turn:accepted-to-settled', 12)
    emitDiagnosticCounter('ai-turn:outcome:success', 1)

    expect(profile.snapshot()).toMatchObject({
      releaseEvidenceEligible: false,
      runtime: 'development'
    })

    profile.dispose()
  })

  it('requires complete turn evidence for release eligibility in production', () => {
    const profile = installAiDrawingPerformanceProfile({
      now: () => 0,
      runtime: 'production'
    })

    expect(profile.snapshot().releaseEvidenceEligible).toBe(false)
    emitDiagnosticCounter('ai-turn:accepted', 1)
    emitDiagnosticCounter('ai-turn:outcome:success', 1)
    expect(profile.snapshot().releaseEvidenceEligible).toBe(false)
    emitBrowserDragPhase('ai-turn:accepted-to-settled', 12)
    expect(profile.snapshot().releaseEvidenceEligible).toBe(true)

    profile.dispose()
  })

  it('captures detached canonical and Factory evidence without exposing runtime owners', () => {
    let transactionSubscriber:
      ((status: TransactionStatusPayload) => void) | undefined
    const detachTransactions = vi.fn()
    let authoritativeHistoryDepth = 0
    let renderProjectionElementCount = 1
    let viewportPosition = { x: 12, y: 34 }
    let zoom = 1.25
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
      readViewportPosition: () => viewportPosition,
      readZoom: () => zoom,
      subscribeToTransactionStatus: (subscriber) => {
        transactionSubscriber = subscriber
        return detachTransactions
      }
    })

    expect(profile).not.toHaveProperty('attachRuntimeEvidence')
    expect(profile.readLatestFactoryTransactionStatus()).toBeNull()
    expect(profile.readCanonicalElementCount()).toBe(1)
    expect(profile.readFactoryPublicationCount()).toBe(0)
    expect(profile.readHistoryDepth()).toBe(0)
    expect(profile.readRenderProjectionElementCount()).toBe(1)
    expect(profile.readViewportPosition()).toEqual({ x: 12, y: 34 })
    expect(profile.readZoom()).toBe(1.25)
    viewportPosition = { x: -20, y: 45 }
    zoom = 0.75
    expect(profile.readViewportPosition()).toEqual({ x: -20, y: 45 })
    expect(profile.readZoom()).toBe(0.75)
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
    expect(profile.readLatestFactoryTransactionStatus()).toMatchObject({
      failure: {
        cause: {
          message: 'canonical mutation failed',
          name: 'TypeError'
        },
        kind: 'handler-error',
        message: 'action rolled back'
      },
      status: 'rolled-back',
      transactionId: 6
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
    expect(profile.readLatestFactoryTransactionStatus()).toBeNull()

    const boundedError = new Error('E'.repeat(400))
    boundedError.name = 'N'.repeat(100)
    transactionSubscriber?.({
      changeCount: 0,
      error: boundedError,
      failure: {
        cause: new Error('C'.repeat(400)),
        kind: 'handler-error',
        message: 'F'.repeat(400)
      },
      nonRollbackableChangeCount: 0,
      origin: 'action',
      providerName: 'P'.repeat(100),
      rollbackableChangeCount: 0,
      status: 'rolled-back',
      timestamp: 775,
      transactionId: 8,
      undoableChangeCount: 0
    })
    expect(profile.readLatestFactoryTransactionStatus()).toMatchObject({
      error: {
        message: 'E'.repeat(300),
        name: 'N'.repeat(80)
      },
      failure: {
        cause: {
          message: 'C'.repeat(300),
          name: 'Error'
        },
        message: 'F'.repeat(300)
      },
      providerName: 'P'.repeat(80)
    })
    profile.reset()

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
    expect(() => profile.readViewportPosition()).toThrow(
      'runtime evidence is unavailable'
    )
    expect(() => profile.readZoom()).toThrow('runtime evidence is unavailable')

    profile.dispose()
  })

  it('retains a fixed-capacity window for Factory status, commit, and publication evidence', () => {
    const capacity = 16_384
    let transactionSubscriber:
      ((status: TransactionStatusPayload) => void) | undefined
    const profile = installAiDrawingPerformanceProfile({
      epochNow: () => 1_000,
      now: () => 0,
      runtime: 'production'
    })
    const detachRuntime = attachAiDrawingPerformanceRuntimeEvidence(profile, {
      readCanonicalElementCount: () => 0,
      readCanonicalElements: () => [],
      readCanonicalOwnerSnapshot: () => ({ props: {}, sceneTree: {} }),
      readHistoryDepth: () => 0,
      readRenderProjectionElementCount: () => 0,
      readViewportPosition: () => ({ x: 0, y: 0 }),
      readZoom: () => 1,
      subscribeToTransactionStatus: (subscriber) => {
        transactionSubscriber = subscriber
        return () => undefined
      }
    })

    for (let index = 0; index < capacity + 3; index += 1) {
      transactionSubscriber?.({
        changeCount: 1,
        nonRollbackableChangeCount: 0,
        origin: 'action',
        rollbackableChangeCount: 1,
        status: 'committed',
        timestamp: index,
        transactionId: index,
        undoableChangeCount: 1
      })
      recordAiDrawingPerformancePublication(profile, {
        deliveryCount: 1,
        publicationId: `publication-${index}`
      })
    }

    const evidence = profile.getRuntimeEvidence()
    expect(evidence.factoryStatuses).toHaveLength(capacity)
    expect(evidence.factoryCommits).toHaveLength(capacity)
    expect(evidence.factoryPublications).toHaveLength(capacity)
    expect(evidence.factoryStatuses[0]?.transactionId).toBe(3)
    expect(evidence.factoryCommits[0]?.transactionId).toBe(3)
    expect(evidence.factoryPublications[0]?.publicationId).toBe('publication-3')
    expect(profile.readLatestFactoryTransactionStatus()?.transactionId).toBe(
      capacity + 2
    )
    expect(profile.readFactoryPublicationCount()).toBe(capacity)

    detachRuntime()
    profile.dispose()
  })

  it('captures hostile diagnostic values without losing the latest status', () => {
    let transactionSubscriber:
      ((status: TransactionStatusPayload) => void) | undefined
    const profile = installAiDrawingPerformanceProfile({
      now: () => 0,
      runtime: 'production'
    })
    const hostileTrap = vi.fn(() => {
      throw new Error('diagnostic object must not be inspected dynamically')
    })
    const hostileValue = new Proxy(
      {},
      {
        get: hostileTrap,
        getOwnPropertyDescriptor: hostileTrap,
        getPrototypeOf: hostileTrap,
        ownKeys: hostileTrap
      }
    )
    const detachRuntime = attachAiDrawingPerformanceRuntimeEvidence(profile, {
      readCanonicalElementCount: () => 0,
      readCanonicalElements: () => [],
      readCanonicalOwnerSnapshot: () => ({ props: {}, sceneTree: {} }),
      readHistoryDepth: () => 0,
      readRenderProjectionElementCount: () => 0,
      readViewportPosition: () => ({ x: 0, y: 0 }),
      readZoom: () => 1,
      subscribeToTransactionStatus: (subscriber) => {
        transactionSubscriber = subscriber
        return () => undefined
      }
    })

    expect(() =>
      transactionSubscriber?.({
        changeCount: 0,
        error: hostileValue,
        failure: {
          cause: hostileValue,
          kind: 'handler-error'
        },
        nonRollbackableChangeCount: 0,
        origin: 'action',
        rollbackableChangeCount: 0,
        status: 'rolled-back',
        timestamp: 10,
        transactionId: 10,
        undoableChangeCount: 0
      })
    ).not.toThrow()
    expect(profile.readLatestFactoryTransactionStatus()).toMatchObject({
      status: 'rolled-back',
      transactionId: 10
    })
    expect(hostileTrap).toHaveBeenCalled()

    detachRuntime()
    profile.dispose()
  })
})
