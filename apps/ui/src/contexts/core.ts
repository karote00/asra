import Core from '@asra/core'
import factory from '@asra/factory'

export const core = new Core()
export { factory }

// For debug
if (process.env.NODE_ENV === 'development') {
  window.__Core__ = core
  window.__Factory__ = factory
}
