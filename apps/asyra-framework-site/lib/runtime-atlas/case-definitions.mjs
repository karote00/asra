const action = (id, label, owner, description) =>
  Object.freeze({ id, label, owner, description })

const defineCase = (definition) =>
  Object.freeze({
    ...definition,
    guideIds: Object.freeze([...definition.guideIds]),
    packages: Object.freeze([...definition.packages]),
    actions: Object.freeze([...definition.actions])
  })

export const ATLAS_CASES = Object.freeze([
  defineCase({
    id: 'continuous-pointer-undo',
    eyebrow: 'Intent → one history entry',
    title: 'One continuous gesture. One Undo unit.',
    purpose:
      'Watch three pointer updates travel through one Feature session and settle as one reversible action.',
    expectedResult:
      'The value reaches 5, Undo returns it to 0, Redo restores 5, and history contains one entry.',
    guideIds: ['build/feature-session'],
    packages: ['@asyra/feature-system', '@asyra/factory'],
    actions: [
      action(
        'compose',
        'Compose owners',
        'App + Framework',
        'Register the session, inverse, and replay route.'
      ),
      action(
        'start',
        'Start pointer intent',
        'Feature System',
        'Open one exclusive session and one Factory transaction.'
      ),
      action(
        'update-2',
        'Pointer update 2',
        'App common API',
        'Apply the first canonical preview value.'
      ),
      action(
        'update-4',
        'Pointer update 4',
        'App common API',
        'Apply the second preview inside the same transaction.'
      ),
      action(
        'update-5',
        'Pointer update 5',
        'App common API',
        'Apply the accepted final preview.'
      ),
      action(
        'commit',
        'Commit gesture',
        'Factory',
        'Close the session and settle one history entry.'
      ),
      action(
        'undo',
        'Undo',
        'Factory replay',
        'Apply the owner-issued inverse events.'
      ),
      action(
        'redo',
        'Redo',
        'Factory replay',
        'Replay the original owner events.'
      )
    ]
  }),
  defineCase({
    id: 'canonical-projection-fanout',
    eyebrow: 'One owner → four views',
    title: 'One canonical change. Every view agrees.',
    purpose:
      'Change one validated information record and derive four explicitly App-owned projections from the returned snapshot.',
    expectedResult:
      'Canvas, hierarchy, properties, and serialization all report the same approved record.',
    guideIds: ['learn/information-models', 'build/custom-schema'],
    packages: [
      '@asyra/system-context',
      '@asyra/feature-system',
      '@asyra/factory'
    ],
    actions: [
      action(
        'register-model',
        'Register information',
        'System Context',
        'Create one validated canonical record.'
      ),
      action(
        'register-action',
        'Register action',
        'Feature System',
        'Expose an App-owned approval API.'
      ),
      action(
        'approve',
        'Approve record',
        'Feature + Factory',
        'Mutate the owner inside one transaction.'
      ),
      action(
        'project',
        'Project result',
        'App projections',
        'Derive four detached views from the canonical snapshot.'
      )
    ]
  }),
  defineCase({
    id: 'invalid-input-rollback',
    eyebrow: 'Rejected input → no partial state',
    title: 'Failure is evidence too.',
    purpose:
      'Apply one valid preview, reject an invalid update, and inspect the complete transaction rollback.',
    expectedResult:
      'The prior value 5 remains canonical, the invalid preview disappears, and history stays empty.',
    guideIds: ['build/feature-session'],
    packages: ['@asyra/feature-system', '@asyra/factory'],
    actions: [
      action(
        'compose',
        'Compose validation',
        'App + Framework',
        'Register the rollback session and owner replay route.'
      ),
      action(
        'start',
        'Start edit',
        'Feature System',
        'Open the bounded edit transaction.'
      ),
      action(
        'preview',
        'Preview value 8',
        'App common API',
        'Apply a valid intermediate value.'
      ),
      action(
        'reject',
        'Reject value -1',
        'App validator + Factory',
        'Throw the owner error and roll back the complete edit.'
      )
    ]
  }),
  defineCase({
    id: 'collaboration-two-actors',
    eyebrow: 'Optional composition',
    title: 'Two actors. One completed publication.',
    purpose:
      'Connect two in-browser actors through the non-durable MemoryProvider and keep presence outside document state.',
    expectedResult:
      'Actor B converges to Actor A’s value 7; Awareness remains a separate ephemeral projection.',
    guideIds: ['build/collaboration'],
    packages: ['@asyra/collaboration', '@asyra/factory'],
    actions: [
      action(
        'compose',
        'Compose two actors',
        'App',
        'Create two factories, providers, and inbound policies.'
      ),
      action(
        'connect',
        'Connect room',
        'Collaboration',
        'Explicitly start both inert compositions.'
      ),
      action(
        'presence',
        'Share presence',
        'Awareness',
        'Send ephemeral tool state outside canonical data.'
      ),
      action(
        'publish',
        'Commit value 7',
        'Factory + Provider',
        'Send one completed immutable publication.'
      ),
      action(
        'converge',
        'Apply remotely',
        'App remote policy',
        'Validate and apply the delivery in Actor B.'
      )
    ]
  }),
  defineCase({
    id: 'ai-registered-action',
    eyebrow: 'Prepared intent → ordinary action',
    title: 'AI uses the same door as people.',
    purpose:
      'Let a deterministic App-owned provider prepare one registered action, then pass permission and transaction policy.',
    expectedResult:
      'One registered visibility action executes in one app transaction with no network, secret, or direct write.',
    guideIds: ['build/ai-actions'],
    packages: [
      '@asyra/ai-agent-runtime',
      '@asyra/feature-system',
      '@asyra/factory'
    ],
    actions: [
      action(
        'register',
        'Register action',
        'App Feature',
        'Define the visibility API and action schema.'
      ),
      action(
        'prepare',
        'Prepare intent',
        'App provider',
        'Return one deterministic server-shaped action batch.'
      ),
      action(
        'permit',
        'Evaluate permission',
        'App policy',
        'Allow the exact registered action.'
      ),
      action(
        'execute',
        'Execute transaction',
        'AI Runtime + App',
        'Run the executor through one ordinary transaction boundary.'
      )
    ]
  }),
  defineCase({
    id: 'machine-retrieval-action',
    eyebrow: 'Read is not write',
    title: 'Search context. Act through an owner.',
    purpose:
      'Query one canonical information model without mutation, then change it only through a registered Feature API.',
    expectedResult:
      'Retrieval finds Safety review without changing state; the Feature API alone marks it approved.',
    guideIds: ['build/app-retrieval-action'],
    packages: ['@asyra/system-context', '@asyra/feature-system'],
    actions: [
      action(
        'register-model',
        'Register records',
        'System Context',
        'Create the canonical information records.'
      ),
      action(
        'register-action',
        'Register mutation',
        'Feature System',
        'Expose one bounded status API.'
      ),
      action(
        'retrieve',
        'Retrieve “safety”',
        'App index',
        'Read and rank a detached canonical snapshot.'
      ),
      action(
        'act',
        'Approve match',
        'App Feature',
        'Mutate only through the registered owner route.'
      ),
      action(
        'disclose',
        'Disclose boundary',
        'Website',
        'Label this browser composition and route Headless work to Roadmap.'
      )
    ]
  })
])

export const ATLAS_CASE_IDS = Object.freeze(ATLAS_CASES.map(({ id }) => id))

export const getAtlasCase = (caseId) =>
  ATLAS_CASES.find(({ id }) => id === caseId)
