import Core from '@asra/core'
const core = new Core()

if (process.env.NODE_ENV === 'development') {
  window.__Core__ = core
}

export default core
