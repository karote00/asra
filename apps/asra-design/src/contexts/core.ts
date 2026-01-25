import core from '@asra/core'

// For debug
if (process.env.NODE_ENV === 'development') {
  window.__Core__ = core
}

export default core
