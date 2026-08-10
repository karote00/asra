import { defineFeature } from '@asyra/core'

export const exampleDefinition = Object.freeze({
  id: 'generated-design-app-extension',
  title: 'Extend a generated Asyra Design app',
  objective:
    'Add one app-owned review queue through the public Feature boundary without changing the generated app bootstrap.',
  publicPackages: ['@asyra/core'],
  environment:
    'Generated Asyra Design browser app; this module remains inert until explicitly imported.',
  runCommand: 'yarn examples:run generated-design-app-extension',
  sourceRegion: 'example',
  expectedResult:
    'The registered Feature owns review-domain records, rejects duplicate IDs atomically, and disappears on dispose.',
  ownership: {
    framework:
      'Asyra owns Feature registration, priority, exclusivity, public API exposure, and disposal.',
    preset:
      'The generated app keeps its existing 2D defaults; this extension does not reapply or modify Preset.',
    app: 'The extension owns review record validation, queue ordering, and the explicit integration decision.'
  }
})

const FEATURE_NAME = 'generatedApp.reviewQueue'

const snapshotRecord = (record) => Object.freeze({ ...record })

// #region example
export const installReviewQueueExtension = () => {
  const records = new Map()

  const api = {
    add(input) {
      if (
        !input ||
        typeof input.id !== 'string' ||
        !input.id.trim() ||
        typeof input.title !== 'string' ||
        !input.title.trim()
      ) {
        throw new Error('Review records require non-empty id and title')
      }
      if (records.has(input.id)) {
        throw new Error(`Review record already exists: ${input.id}`)
      }

      const record = snapshotRecord({
        id: input.id,
        status: 'pending',
        title: input.title
      })
      records.set(record.id, record)
      return record
    },
    list() {
      return [...records.values()]
    }
  }

  const feature = defineFeature(FEATURE_NAME, undefined, {
    api,
    priority: 20,
    exclusive: true
  })

  return Object.freeze({
    api: feature.api,
    dispose: feature.dispose,
    featureName: FEATURE_NAME
  })
}
// #endregion example

export const runExample = () => {
  const extension = installReviewQueueExtension()
  try {
    const record = extension.api.add({
      id: 'review-1',
      title: 'Factory safety'
    })
    let duplicateRejected = false
    try {
      extension.api.add({ id: 'review-1', title: 'Duplicate' })
    } catch {
      duplicateRejected = true
    }
    const queue = extension.api.list()
    if (!duplicateRejected || queue.length !== 1) {
      throw new Error('Review extension left partial or duplicate state')
    }
    return Object.freeze({ duplicateRejected, queue, record })
  } finally {
    extension.dispose()
  }
}
