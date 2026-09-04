import { createMethodCatalog } from '../../../extensions/catalog'
import { STATIC_SPHERE_METHOD } from '../../methods/static-spheres'
import { AnalysisWorkerHost } from '../../worker-host'

// An intentionally uncooperative trusted extension proves real Worker termination.
const catalog = createMethodCatalog([
  {
    descriptor: STATIC_SPHERE_METHOD,
    execute: () => {
      self.postMessage({ fixture: 'uncooperative-method-entered' })
      for (;;) Math.sqrt(Math.random())
    }
  }
])
const host = new AnalysisWorkerHost(
  catalog,
  (message) => self.postMessage(message),
  () => self.close()
)
self.addEventListener('message', (event: MessageEvent<unknown>) => {
  void host.handle(event.data)
})
