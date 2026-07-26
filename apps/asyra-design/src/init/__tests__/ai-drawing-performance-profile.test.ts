import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installAiDrawingPerformanceProfile,
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
  it('accepts only one exact Mock AI profiling configuration', () => {
    expect(
      resolveAiDrawingPerformanceProfile(
        '?ai=mock&aiDelivery=progressive&aiPerformance=profile'
      )
    ).toEqual({
      contentsMode: 'present',
      deliveryMode: 'progressive'
    })
    expect(
      resolveAiDrawingPerformanceProfile(
        '?ai=mock&aiDelivery=atomic&aiPerformance=profile&aiPerformanceContents=omitted'
      )
    ).toEqual({
      contentsMode: 'omitted',
      deliveryMode: 'atomic'
    })

    for (const search of [
      '?aiPerformance=profile',
      '?ai=mock&aiPerformance=profile&aiPerformance=profile',
      '?ai=mock&aiPerformance=profile&aiPerformanceContents=hidden',
      '?ai=mock&ai=mock&aiPerformance=profile',
      '?ai=mock&aiDelivery=progressive&aiDelivery=atomic&aiPerformance=profile'
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
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.phases)).toBe(true)
    expect(priorPhase).toHaveBeenCalledOnce()
    expect(priorCounter).toHaveBeenCalledOnce()

    profile.dispose()

    expect(runtimeGlobal.__asyraBrowserDragPhaseSink).toBe(priorPhase)
    expect(runtimeGlobal.__asyraDiagnosticCounterSink).toBe(priorCounter)
    expect(window.__AsyraAiDrawingPerformance__).toBeUndefined()
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
})
