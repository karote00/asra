const defineAction = (id, label, owner, input) =>
  Object.freeze({ id, label, owner, input: Object.freeze(input) })

const defineCase = (definition) =>
  Object.freeze({
    ...definition,
    actions: Object.freeze(definition.actions),
    conditions: Object.freeze(definition.conditions),
    bypasses: Object.freeze(definition.bypasses),
    exampleIds: Object.freeze(definition.exampleIds),
    owners: Object.freeze(definition.owners)
  })

export const ATLAS_CASES = Object.freeze([
  defineCase({
    id: 'continuous-pointer-undo',
    coordinate: '01',
    title: 'One gesture, one reversible decision',
    plainLanguage:
      'Move something through several previews, commit once, then prove the whole decision can be undone and restored.',
    technicalSummary:
      'Feature session → App API → Factory journal → one Undo unit',
    expected:
      'Three visible updates settle as one new Undo entry; Undo restores 0 and Redo restores 6.',
    exampleIds: ['feature-session-undo'],
    owners: ['Feature System', 'App API', 'Factory'],
    conditions: [
      'The session remains open across every preview update.',
      'Only the outer session end may create the Undo entry.'
    ],
    bypasses: ['Render is an optional downstream projection.'],
    actions: [
      defineAction('start', 'Start pointer session', 'Feature System', {
        pointer: 0
      }),
      defineAction('update-2', 'Preview value 2', 'App API', { value: 2 }),
      defineAction('update-4', 'Preview value 4', 'App API', { value: 4 }),
      defineAction('update-6', 'Preview value 6', 'App API', { value: 6 }),
      defineAction('commit', 'Commit the gesture', 'Factory', {}),
      defineAction('undo', 'Undo the decision', 'Factory', {}),
      defineAction('redo', 'Redo the decision', 'Factory', {})
    ]
  }),
  defineCase({
    id: 'canonical-projection-fanout',
    coordinate: '02',
    title: 'One truth, many useful views',
    plainLanguage:
      'Approve one information record, then watch the same accepted state feed a visual, an outline, a property view, and saved data.',
    technicalSummary:
      'Feature API → Factory transaction → System Context → App projections',
    expected:
      'One canonical record reaches approved revision 2 and every App-owned projection reads that same result.',
    exampleIds: ['core-information-model', 'custom-component-schema'],
    owners: ['Feature System', 'Factory', 'System Context', 'App projections'],
    conditions: [
      'The registered validator accepts only the declared record shape.',
      'Every projection consumes the returned canonical snapshot.'
    ],
    bypasses: [
      'Canvas, hierarchy, properties, and serialization never own another copy of truth.'
    ],
    actions: [
      defineAction('register', 'Register the information model', 'App', {
        status: 'draft'
      }),
      defineAction('approve', 'Approve through the Feature API', 'Feature System', {
        status: 'approved'
      }),
      defineAction('project', 'Read canonical projections', 'App projections', {})
    ]
  }),
  defineCase({
    id: 'invalid-input-rollback',
    coordinate: '03',
    title: 'A bad update leaves no damage',
    plainLanguage:
      'Preview a valid change, send one rejected value, and verify the whole unfinished action disappears.',
    technicalSummary:
      'Feature session failure → Factory rollback → no partial state',
    expected:
      'The rejected update restores value 0 and creates no new Undo entry.',
    exampleIds: ['feature-session-undo'],
    owners: ['Feature System', 'App validation', 'Factory'],
    conditions: [
      'A value above the App-owned limit is rejected inside the active session.',
      'Rollback reverses every rollbackable preview in the session.'
    ],
    bypasses: ['No error fallback may write a replacement success value.'],
    actions: [
      defineAction('start', 'Start bounded edit', 'Feature System', {}),
      defineAction('preview', 'Apply valid preview 3', 'App API', { value: 3 }),
      defineAction('reject', 'Reject invalid value 9', 'App validation', {
        value: 9
      })
    ]
  }),
  defineCase({
    id: 'collaboration-two-actors',
    coordinate: '04',
    title: 'Two live actors, explicit ownership',
    plainLanguage:
      'Connect two in-browser participants, share one accepted change, and keep presence separate from the document.',
    technicalSummary:
      'Factory publication → Collaboration → App remote apply',
    expected:
      'Actor B converges to 7 while Actor A presence remains ephemeral and non-durable.',
    exampleIds: ['collaboration-two-memory-actors'],
    owners: ['Factory', 'Collaboration', 'MemoryProvider', 'App remote policy'],
    conditions: [
      'Both actors start explicitly before publication.',
      'The receiving App validates the one supported document event.'
    ],
    bypasses: ['No durability, authentication, replay, or conflict policy is implied.'],
    actions: [
      defineAction('connect', 'Connect both actors', 'Collaboration', {}),
      defineAction('publish', 'Share value 7', 'Factory', { value: 7 }),
      defineAction('presence', 'Share ephemeral tool presence', 'Awareness', {
        tool: 'select'
      }),
      defineAction('verify', 'Verify Actor B', 'App remote policy', {})
    ]
  }),
  defineCase({
    id: 'ai-registered-action',
    coordinate: '05',
    title: 'AI proposes; your application decides',
    plainLanguage:
      'Use a predictable local provider to prepare one action, then let your application validate, permit, and execute it.',
    technicalSummary:
      'AI provider → registered action → permission → App transaction',
    expected:
      'One visibility action executes, commits once, and makes the record hidden without any network call.',
    exampleIds: ['ai-registered-action'],
    owners: ['AI Runtime', 'App provider', 'App permission', 'App action'],
    conditions: [
      'The provider returns one registered action with schema-valid arguments.',
      'Permission and execution receive the same prepared arguments.'
    ],
    bypasses: ['No model vendor, secret, network request, or direct AI state write exists.'],
    actions: [
      defineAction('compose', 'Compose App-owned AI boundaries', 'App', {}),
      defineAction('request', 'Prepare one registered action', 'App provider', {
        intent: 'hide the example'
      }),
      defineAction('execute', 'Permit and execute', 'AI Runtime', {})
    ]
  }),
  defineCase({
    id: 'machine-retrieval-action',
    coordinate: '06',
    title: 'Machines can read without becoming owners',
    plainLanguage:
      'Let an application-owned search find one record without changing it, then route the accepted update through the same registered action boundary.',
    technicalSummary:
      'App retrieval → read-only result → Feature API → canonical state',
    expected:
      'Search returns Safety review without mutation; only the Feature API changes it to approved.',
    exampleIds: ['app-retrieval-action'],
    owners: ['System Context', 'App retrieval', 'Feature System'],
    conditions: [
      'Search reads the canonical snapshot and owns its own matching policy.',
      'Only the registered Feature API may change record status.'
    ],
    bypasses: ['Headless Core and Core Kernel remain future Roadmap work.'],
    actions: [
      defineAction('register', 'Register two information records', 'App', {}),
      defineAction('retrieve', 'Search for safety', 'App retrieval', {
        query: 'safety'
      }),
      defineAction('approve', 'Approve through Feature API', 'Feature System', {})
    ]
  })
])

export const ATLAS_CASE_IDS = Object.freeze(ATLAS_CASES.map(({ id }) => id))

export const getAtlasCase = (caseId) => {
  const definition = ATLAS_CASES.find(({ id }) => id === caseId)
  if (!definition) {
    throw new Error(`Unknown Runtime Atlas case: ${caseId}`)
  }
  return definition
}
