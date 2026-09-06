import { INSTALLED_METHOD_CATALOG } from '../../extensions/installed-methods'
import { LiveWorkerHost } from './worker-host'
import { LiveMessages } from './protocol'

const host = new LiveWorkerHost(INSTALLED_METHOD_CATALOG, (message) =>
  self.postMessage(message)
)

self.onmessage = (event: MessageEvent<unknown>) => {
  void host.handle(event.data).catch(() => {
    // A protocol/admission failure terminates this input lifetime, never reports clear.
    self.postMessage({ type: LiveMessages.ERROR, id: 0, time: 0, pairs: [] })
  })
}
