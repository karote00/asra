import type { FeatureDefinition } from '../types/feature'

/**
 * Template for tool-based interactions (drag to create/select)
 */
export const toolTemplate = <API, State>(
  config: {
    name: string
    keys?: string
    session: 'input.drag' | 'input.hover' | 'input.click'
    priority?: number
  },
  implementation: {
    api: API
    onStart: any
    onUpdate?: any
    onEnd?: any
  }
): FeatureDefinition<API> => ({
  name: config.name,
  api: implementation.api,
  define: ({ packages, session, keys }) => {
    if (config.keys) {
      keys([{ keys: config.keys, type: 'switchTool' }])
    }

    session.start(
      config.session,
      { priority: config.priority },
      implementation.onStart,
      implementation.onUpdate,
      implementation.onEnd
    )
  }
})

/**
 * Template for keyboard shortcuts
 */
export const shortcutTemplate = (config: {
  name: string
  keys: string
  action: () => void
}): FeatureDefinition => ({
  name: config.name,
  api: {},
  define: ({ keys, handle }) => {
    keys([{ keys: config.keys }])
    handle('input.shortcut', () => ({
      event: `${config.name}.execute`,
      handler: config.action
    }))
  }
})

/**
 * Template for transaction-wrapped actions
 */
export const transactionalTemplate = <API>(config: {
  name: string
  shortcut?: string
  action: (...args: any[]) => void
  api?: API
}): FeatureDefinition<API> => ({
  name: config.name,
  api: config.api || ({} as API),
  define: ({ packages, keys, handle }) => {
    if (config.shortcut) {
      keys([{ keys: config.shortcut }])
    }

    handle(`${config.name}.trigger`, () => {
      packages.factory?.startTransaction?.()
      config.action()
      packages.factory?.endTransaction?.()
      return { event: `${config.name}.executed` }
    })
  }
})
