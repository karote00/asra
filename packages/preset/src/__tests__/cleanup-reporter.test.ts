import { describe, expect, it, vi } from 'vitest'
import { createCleanupReporter } from '../cleanup-reporter.js'

describe('cleanup reporter', () => {
  it('reports the owned disposer once', () => {
    const dispose = vi.fn()
    const onCleanupReady = vi.fn()
    const reporter = createCleanupReporter(onCleanupReady, dispose)

    reporter.report()
    reporter.report()

    expect(onCleanupReady).toHaveBeenCalledOnce()
    expect(onCleanupReady).toHaveBeenCalledWith(dispose)
    expect(reporter.hasReported()).toBe(true)
  })

  it('remains unreported when no callback owns the disposer', () => {
    const reporter = createCleanupReporter(undefined, vi.fn())

    reporter.report()

    expect(reporter.hasReported()).toBe(false)
  })
})
