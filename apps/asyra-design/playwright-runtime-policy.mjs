export const resolveOrdinaryPlaywrightRuntimePolicy = (environment) => {
  const isCI = Boolean(environment.CI)
  const isScheduled = environment.GITHUB_EVENT_NAME === 'schedule'

  return {
    maxFailures: isCI && !isScheduled ? 1 : undefined,
    reporter: isCI ? 'line' : 'html',
    retries: isCI && isScheduled ? 1 : 0,
    // Long ordinary suites can finish every assertion yet leave multiple
    // Chrome workers waiting on teardown. CI favors a deterministic exit over
    // parallelism; specialized performance/collaboration configs own their
    // worker policies independently.
    workers: isCI ? 1 : undefined
  }
}
