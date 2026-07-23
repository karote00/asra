export const resolveOrdinaryPlaywrightRuntimePolicy = (environment) => {
  const isCI = Boolean(environment.CI)
  const isScheduled = environment.GITHUB_EVENT_NAME === 'schedule'

  return {
    maxFailures: isCI && !isScheduled ? 1 : undefined,
    reporter: isCI ? 'line' : 'html',
    retries: isCI && isScheduled ? 1 : 0,
    workers: isCI ? 2 : undefined
  }
}
