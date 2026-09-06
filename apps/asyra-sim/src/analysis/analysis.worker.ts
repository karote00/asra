import { INSTALLED_METHOD_CATALOG } from '../extensions/installed-methods'
import { AnalysisWorkerHost } from './worker-host'

const host = new AnalysisWorkerHost(
  INSTALLED_METHOD_CATALOG,
  (message) => self.postMessage(message),
  () => self.close()
)

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  void host.handle(event.data)
})
