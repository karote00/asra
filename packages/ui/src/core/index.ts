import Core from '@asra/core'
import Factory from '@asra/factory'
import '../processor'
const core = new Core()

if (process.env.NODE_ENV === 'development') {
  window.__Core__ = core
  window.__Factory__ = Factory
}

export default core
