export interface FrameworkReleaseMilestone {
  highlights: readonly string[]
  status: 'Current' | 'Previous'
  summary: string
  title: string
  version: string
}

export const frameworkReleaseHistory = [
  {
    highlights: [
      'Composable runtime owners for intent, transactions, validation, persistence, and projections.',
      'Official 2D composition plus an engine-neutral CUSTOM path.',
      'Public documentation, Runtime Atlas, and Asyra Design as the reference product.'
    ],
    status: 'Current',
    summary:
      "Asyra's first public Framework milestone brings its runtime model, package family, documentation, executable evidence, roadmap, and reference product into one discoverable release.",
    title: 'The public Framework foundation.',
    version: '0.5.0'
  }
] as const satisfies readonly FrameworkReleaseMilestone[]

export const currentFrameworkRelease = frameworkReleaseHistory[0]
