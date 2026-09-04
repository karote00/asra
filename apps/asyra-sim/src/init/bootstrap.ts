import core from '@asyra/core'
import type { RenderEngineProvider } from '@asyra/render-engine'
import { ComponentTypes } from '../constants'
import { readWorkcell } from '../common-apis/workcell'
import {
  loadCanonicalDocument,
  type ModelLoadIssue
} from '../common-apis/document'
import { installEditingFeatures } from '../features/edit-workcell'
import { installModelComponents } from './components'
import { installCustomRenderer } from './custom-renderer'
import type { SpatialFrame } from '../render-app/spatial-layer'
import { createSyntheticExample } from '../../samples/synthetic-workcell'

export async function bootstrap(
  host: HTMLElement,
  provider?: RenderEngineProvider
) {
  const rendering = installCustomRenderer(core, provider)
  let observer: ResizeObserver | null = null,
    disposed = false
  const subscriptions = new Set<() => void>()
  let loadIssues: readonly ModelLoadIssue[] = []
  const dispose = async () => {
    if (disposed) return
    disposed = true
    observer?.disconnect()
    subscriptions.forEach((unsubscribe) => unsubscribe())
    subscriptions.clear()
    rendering.dispose()
    await core.destroy()
  }
  try {
    installModelComponents(core)
    const features = installEditingFeatures(core)
    loadIssues = loadCanonicalDocument(core, {
      version: '1.0.0',
      sceneTree: { workspace: '', workspaceList: [], elements: {} },
      props: {}
    })
    const rect = host.getBoundingClientRect()
    let width = Math.max(1, rect.width),
      height = Math.max(1, rect.height)
    await core.start(host, {
      width,
      height,
      backgroundColor: 0x101f2a
    })
    const example = createSyntheticExample()
    await features.edit.createCandidate(
      'A · Baseline workcell',
      example.workcell
    )
    observer = new ResizeObserver((entries) => {
      if (disposed) return
      const box = entries[0]?.contentRect
      if (box && box.width > 0 && box.height > 0) {
        core.resizeRenderer(box.width, box.height)
        width = box.width
        height = box.height
      }
    })
    observer.observe(host)
    return {
      features,
      getCandidates: () =>
        core
          .getAllElementData()
          .filter((item) => item.data.type === ComponentTypes.CANDIDATE)
          .map((item) => ({ id: item.data.id, name: item.data.name })),
      getWorkcell: (id: string) => readWorkcell(core, id),
      getLoadIssues: () => loadIssues,
      getHistoryDepth: () => core.getUndoHistoryDepth(),
      setFrame: (frame: SpatialFrame) => {
        if (disposed) throw new Error('Runtime disposed')
        rendering.layer.submit(frame)
      },
      pick: (x: number, y: number) => {
        const bounds = core.getCanvasBounds()
        if (
          disposed ||
          !bounds ||
          bounds.width <= 0 ||
          bounds.height <= 0 ||
          x < bounds.left ||
          x >= bounds.right ||
          y < bounds.top ||
          y >= bounds.bottom
        )
          return null
        return core.getElementIdAtClientPos({
          x: ((x - bounds.left) * width) / bounds.width,
          y: ((y - bounds.top) * height) / bounds.height
        })
      },
      save: () => core.save(),
      load: (data: unknown) => {
        loadIssues = loadCanonicalDocument(core, data)
        return loadIssues
      },
      subscribe: (listener: () => void) => {
        const unsubscribe = core.subscribeToTransactionStatus((event) => {
          if (event.status === 'committed' || event.status === 'rolled-back')
            listener()
        })
        subscriptions.add(unsubscribe)
        return () => {
          unsubscribe()
          subscriptions.delete(unsubscribe)
        }
      },
      dispose
    }
  } catch (error) {
    await dispose()
    throw error
  }
}
export type SimRuntime = Awaited<ReturnType<typeof bootstrap>>
