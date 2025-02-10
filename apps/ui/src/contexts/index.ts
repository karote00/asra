import Core from '@asra/core'
import Factory from '@asra/factory'
export { initDataContexts } from '@asra/ui-context'

export const core = new Core()

// For debug
if (process.env.NODE_ENV === 'development') {
  window.__Core__ = core
  window.__Factory__ = Factory
}

export const sceneTreeManager = core.sceneTreeManager
export const dataTransact = Factory.transact
export { Factory }
