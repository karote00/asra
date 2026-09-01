export interface FrameworkReleaseMilestone {
  githubUrl: string
  highlights: readonly string[]
  status: 'Current' | 'Previous'
  summary: string
  title: string
  version: string
}

export const frameworkReleaseHistory = [
  {
    githubUrl: 'https://github.com/karote00/asyra/releases/tag/v0.5.0',
    highlights: [
      'App-owned Features route human, UI, automation, device, and AI intent through one explicit product boundary.',
      'Transaction-safe canonical state coordinates validation, rollback, one-action Undo/Redo, and downstream projections.',
      'Replaceable rendering and explicit Presets separate stable orchestration from the Pixi implementation and App-selected defaults.',
      'The 7,076-element reference product proves editable vectors, hierarchy, rendering, Undo/Redo, persistence, and two-client CRDT convergence.',
      'Optional collaboration and AI use the same accepted canonical paths without becoming Core dependencies.',
      'Nineteen public ESM packages, create-asyra-design-app, public documentation, and exact artifact validation form the supported distribution.',
      'Node.js 24 is required; browser/Core with 2D and engine-neutral CUSTOM composition is the current support boundary.',
      'Flow Inspector 0.2.0 provides a static contract-reading workspace for 32 current-project Inspectors.'
    ],
    status: 'Current',
    summary:
      'Asyra v0.5.0 brings the Framework, maintained Asyra Design product, public documentation, and release tooling together as one cohesive product-infrastructure stack.',
    title: 'Build product features, not infrastructure.',
    version: '0.5.0'
  }
] as const satisfies readonly FrameworkReleaseMilestone[]

export const currentFrameworkRelease = frameworkReleaseHistory[0]
