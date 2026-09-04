import { useEffect, useState, useSyncExternalStore } from 'react'
import { bootstrap, type SimRuntime } from '../init/bootstrap'
import {
  RuntimeController,
  type RuntimeState
} from '../init/runtime-controller'
import { IndexedProjectRepository } from '../storage/indexed-db'
import { ProjectSession } from '../storage/project-session'

const emptyState: RuntimeState = Object.freeze({
  status: 'idle',
  runtime: null,
  generation: 0,
  error: '',
  recoveryAvailable: false
})
const emptySnapshot = () => emptyState
const emptySubscribe = () => () => undefined

export function useProjectRuntime(
  host: HTMLElement | null,
  onRuntime: (runtime: SimRuntime | null) => void
) {
  const [resources, setResources] = useState<{
    controller: RuntimeController
    session: ProjectSession
  } | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!host) return
    const controller = new RuntimeController((snapshot, prepared) =>
      bootstrap(host, undefined, snapshot, prepared)
    )
    const session = new ProjectSession(new IndexedProjectRepository(), {
      capture: () => controller.capture(),
      apply: (snapshot, assertCurrent) =>
        controller.replace(snapshot, assertCurrent)
    })
    let observed: SimRuntime | null = null,
      unsubscribeModel: (() => void) | undefined
    const unsubscribe = controller.subscribe(() => {
      const runtime = controller.getState().runtime
      if (runtime === observed) return
      unsubscribeModel?.()
      observed = runtime
      unsubscribeModel = runtime?.subscribe(() => {
        if (controller.getState().runtime !== runtime) return
        session.markEdited()
        setRevision((value) => value + 1)
      })
      onRuntime(runtime)
    })
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        session.getState().dirty ||
        session.getState().busy ||
        controller.getState().recoveryAvailable
      ) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    setResources({ controller, session })
    // The controller publishes startup failures as ordinary UI state.
    void controller.start().catch(() => undefined)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      unsubscribe()
      unsubscribeModel?.()
      session.close()
      void controller.dispose().catch((error) => globalThis.reportError(error))
    }
  }, [host, onRuntime])
  const lifecycle = useSyncExternalStore(
    resources?.controller.subscribe ?? emptySubscribe,
    resources?.controller.getState ?? emptySnapshot
  )
  return { resources, lifecycle, revision }
}
