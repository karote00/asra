/**
 * Base UI Property Registrations
 *
 * These are UI state properties managed by ui-context directly.
 */

import core from '../contexts'

export const registerBaseUIProperties = () => {
  core.registerUIProperty<Set<string>>('elementSelection', {
    defaultValue: new Set()
  })

  core.registerUIProperty<Set<string>>('vertexSelection', {
    defaultValue: new Set()
  })

  core.registerUIProperty<string[]>('flattenedElementIds', {
    defaultValue: []
  })
}
