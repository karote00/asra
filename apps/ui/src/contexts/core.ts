import Core from '@asra/core'

export const core = new Core()

// For debug
if (process.env.NODE_ENV === 'development') {
  window.__Core__ = core
}
