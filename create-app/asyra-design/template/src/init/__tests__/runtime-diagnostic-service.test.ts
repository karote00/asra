import { afterEach, describe, expect, it, vi } from 'vitest'
import * as collaborationLifecycle from '../../collaboration/lifecycle'
import * as performanceProfile from '../performance/ai-drawing-performance-profile'
import {
  RUNTIME_DIAGNOSTIC_REQUEST_EVENT,
  installRuntimeDiagnosticService,
  type RuntimeDiagnosticRequest
} from '../diagnostics/runtime-diagnostic-service'

const serviceDisposers: (() => void)[] = []

const request = (operation: string, args: readonly unknown[] = []) => {
  const detail: RuntimeDiagnosticRequest = { args, operation }
  document.dispatchEvent(
    new CustomEvent(RUNTIME_DIAGNOSTIC_REQUEST_EVENT, { detail })
  )
  if (detail.error) throw new Error(detail.error)
  return detail.response
}

afterEach(() => {
  serviceDisposers.splice(0).forEach((dispose) => dispose())
  vi.restoreAllMocks()
})

describe('runtime diagnostic service', () => {
  it('exposes detached profile evidence without reading a Window debug handle', () => {
    const snapshot = Object.freeze({
      counters: Object.freeze([]),
      phases: Object.freeze([
        Object.freeze({ atMs: 1, durationMs: 2, name: 'phase-a' })
      ]),
      releaseEvidenceEligible: false,
      runtime: 'production' as const
    })
    const profile = {
      snapshot: vi.fn(() => snapshot),
      readCounterTotal: vi.fn((name: string) => (name === 'counter-a' ? 3 : 0))
    } as unknown as performanceProfile.AiDrawingPerformanceProfile
    vi.spyOn(
      performanceProfile,
      'getActiveAiDrawingPerformanceProfile'
    ).mockReturnValue(profile)
    serviceDisposers.push(installRuntimeDiagnosticService())

    expect(request('profile:snapshot')).toEqual(snapshot)
    expect(request('profile:readCounterTotal', ['counter-a'])).toBe(3)
    expect(() => request('profile:unknown')).toThrow(
      'Unsupported runtime diagnostic operation'
    )
  })

  it('owns bounded collaboration outcome diagnostics behind explicit requests', () => {
    let outcomeSubscriber:
      | ((outcome: {
          direction: 'local' | 'remote'
          error?: unknown
          publicationId: string
          status: 'processed' | 'send-failed' | 'sent'
        }) => void)
      | undefined
    const collaboration = {
      getStatus: () => 'connected' as const,
      observePublicationOutcomes: vi.fn((subscriber) => {
        outcomeSubscriber = subscriber
        return () => {
          outcomeSubscriber = undefined
        }
      })
    }
    vi.spyOn(
      collaborationLifecycle,
      'getActiveCollaborationHandle'
    ).mockReturnValue(collaboration as never)
    serviceDisposers.push(installRuntimeDiagnosticService())

    expect(request('collaboration:get-status')).toBe('connected')
    request('collaboration:reset-outcomes')
    outcomeSubscriber?.({
      direction: 'local',
      publicationId: 'publication-a',
      status: 'sent'
    })
    outcomeSubscriber?.({
      direction: 'remote',
      publicationId: 'publication-a',
      status: 'processed'
    })
    outcomeSubscriber?.({
      direction: 'local',
      error: new Error('send failed'),
      publicationId: 'publication-b',
      status: 'send-failed'
    })

    expect(request('collaboration:read-outcomes')).toMatchObject({
      failed: 1,
      localSent: 1,
      remoteProcessed: 1,
      lastPublicationFailure: {
        message: 'send failed',
        publicationId: 'publication-b',
        status: 'send-failed'
      }
    })
  })
})
