import { createExampleCoreComposition } from './create-core-composition.mjs'
import {
  assertExampleResult,
  definePublicExample
} from './example-contract.mjs'

const FEATURE = 'example:record-actions'
const RECORDS_KEY = 'example:records'

export const exampleDefinition = definePublicExample({
  id: 'app-retrieval-action',
  title: 'Let app retrieval find; let Feature API mutate',
  objective:
    'Query a canonical model through an app-owned index and route the accepted change through one registered action boundary.',
  publicPackages: ['@asyra/core', '@asyra/feature-system'],
  environment:
    'Supported browser/Core composition with Node.js artifact verification',
  runCommand: 'yarn examples:run app-retrieval-action',
  sourceRegion: 'example',
  expectedResult:
    'Retrieval returns the matching record without mutation; the registered Feature API performs the only status change.',
  ownership: {
    framework: 'Owns managed state and Feature registration boundaries.',
    preset: 'Not composed in this example.',
    app: 'Owns indexing, search policy, record schema, and action semantics.'
  }
})

// #region example
export const runAppRetrievalActionExample = () => {
  const { core } = createExampleCoreComposition()
  core.defineSystemProperty(RECORDS_KEY, {
    'record-a': { label: 'Cooling audit', status: 'open' },
    'record-b': { label: 'Safety review', status: 'open' }
  })
  const registration = core.defineFeature(FEATURE, undefined, {
    priority: 100,
    exclusive: true,
    api: {
      setStatus: (recordId, status) => {
        const records = core.getSystemContextSnapshot()[RECORDS_KEY]
        core.setSystemProperty(RECORDS_KEY, {
          ...records,
          [recordId]: { ...records[recordId], status }
        })
      }
    }
  })

  try {
    const retrieve = (query) => {
      const records = core.getSystemContextSnapshot()[RECORDS_KEY]
      return Object.entries(records)
        .filter(([, record]) =>
          record.label.toLowerCase().includes(query.toLowerCase())
        )
        .map(([id, record]) => ({ id, ...record }))
    }
    const before = core.getSystemContextSnapshot()[RECORDS_KEY]
    const matches = retrieve('safety')
    const afterSearch = core.getSystemContextSnapshot()[RECORDS_KEY]
    registration.api.setStatus(matches[0].id, 'approved')
    const afterAction = core.getSystemContextSnapshot()[RECORDS_KEY]
    const result = { afterAction, afterSearch, before, matches }

    assertExampleResult(matches.length === 1, 'retrieval is deterministic')
    assertExampleResult(
      JSON.stringify(before) === JSON.stringify(afterSearch),
      'retrieval does not mutate canonical state'
    )
    assertExampleResult(
      afterAction['record-b'].status === 'approved',
      'the Feature API applies the accepted action'
    )
    return Object.freeze(result)
  } finally {
    registration.dispose()
    core.unregisterSystemProperty(RECORDS_KEY)
  }
}
// #endregion example
