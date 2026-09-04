import currentCore from '@asyra/core'
import type { RenderEngineProvider } from '@asyra/render-engine'
import { ComponentTypes } from '../constants'
import { readWorkcell } from '../common-apis/workcell'
import { readExperiment, readExperiments } from '../common-apis/experiment'
import {
  loadCanonicalDocument,
  type ModelLoadIssue
} from '../common-apis/document'
import { installEditingFeatures } from '../features/edit-workcell'
import { installAnalysisFeature } from '../features/analysis'
import { installModelComponents } from './components'
import { installCustomRenderer } from './custom-renderer'
import type { SpatialFrame } from '../render-app/spatial-layer'
import { createSyntheticExample } from '../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../samples/synthetic-experiment'
import type { ProjectSnapshot } from '../storage/project-format'
import { AnalysisRunner } from '../analysis/runner'
import { OFFICIAL_CLEARANCE_METHOD } from '../analysis/methods/official-method'
import { preflightExperiment as checkExperiment } from '../analysis/preflight'
import { createExperimentSnapshot as freezeExperiment } from '../analysis/snapshot'

function guardCommands<
  T extends { [K in keyof T]: (...args: never[]) => unknown }
>(commands: T, assertAccepting: () => void): T {
  return Object.fromEntries(
    Object.entries(commands).map(([name, command]) => [
      name,
      (...args: unknown[]) => {
        assertAccepting()
        return Reflect.apply(
          command as (...args: unknown[]) => unknown,
          commands,
          args
        )
      }
    ])
  ) as unknown as T
}

export async function bootstrap(
  host: HTMLElement,
  provider?: RenderEngineProvider,
  snapshot?: ProjectSnapshot
) {
  const core = currentCore
  if (!core.isCompositionOpen()) throw new Error('Runtime already started')
  let rendering: ReturnType<typeof installCustomRenderer> | undefined
  let observer: ResizeObserver | null = null,
    disposed = false
  let disposal: Promise<void> | undefined
  const subscriptions = new Set<() => void>()
  const pauses = new Set<object>()
  let loadIssues: readonly ModelLoadIssue[] = []
  const assertLive = () => {
    if (disposed) throw new Error('Runtime is closed')
  }
  const assertAccepting = () => {
    assertLive()
    if (pauses.size) throw new Error('Runtime editing is paused')
  }
  const dispose = () => {
    if (disposal) return disposal
    disposed = true
    pauses.clear()
    // Defer teardown so reentrant cleanup observes the same terminal promise.
    disposal = Promise.resolve().then(async () => {
      const errors: unknown[] = []
      const attempt = (cleanup: () => void) => {
        try {
          cleanup()
        } catch (error) {
          errors.push(error)
        }
      }
      attempt(() => observer?.disconnect())
      subscriptions.forEach(attempt)
      subscriptions.clear()
      attempt(() => rendering?.dispose())
      try {
        await core.resetRuntime()
      } catch (error) {
        errors.push(error)
      }
      if (errors.length === 1) throw errors[0]
      if (errors.length)
        throw new AggregateError(errors, 'Runtime cleanup failed')
    })
    return disposal
  }
  try {
    rendering = installCustomRenderer(core, provider)
    const layer = rendering.layer
    installModelComponents(core)
    const editing = installEditingFeatures(core)
    const analysisRunner = new AnalysisRunner()
    const analysis = installAnalysisFeature(core, analysisRunner)
    const features = {
      edit: guardCommands(editing.edit, assertAccepting),
      history: guardCommands(editing.history, assertAccepting),
      analysis: {
        run: (...args: Parameters<typeof analysis.run>) => {
          assertAccepting()
          return analysis.run(...args)
        },
        cancel: () => {
          assertLive()
          return analysis.cancel()
        },
        isRunning: () => {
          assertLive()
          return analysis.isRunning()
        }
      }
    }
    loadIssues = [
      ...structuredClone(snapshot?.loadIssues ?? []),
      ...loadCanonicalDocument(
        core,
        snapshot
          ? snapshot.document
          : {
              version: '1.0.0',
              sceneTree: { workspace: '', workspaceList: [], elements: {} },
              props: {}
            }
      )
    ]
    const rect = host.getBoundingClientRect()
    let width = Math.max(1, rect.width),
      height = Math.max(1, rect.height)
    await core.start(host, {
      width,
      height,
      backgroundColor: 0x101f2a
    })
    if (!snapshot) {
      const example = createSyntheticExample()
      const candidateId = await features.edit.createCandidate(
        'A · Baseline workcell',
        example.workcell
      )
      await features.edit.createExperiment(
        candidateId,
        'Synthetic clearance study',
        createSyntheticExperimentDraft(example)
      )
    }
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
    const save = async () => {
      assertLive()
      const document = await editing.edit.captureDocument()
      assertLive()
      return document
    }
    return {
      features,
      pauseEditing: () => {
        assertLive()
        const token = {}
        pauses.add(token)
        return () => {
          pauses.delete(token)
        }
      },
      captureSnapshot: async () => ({
        document: await save(),
        loadIssues: structuredClone(loadIssues)
      }),
      preflight: (data: unknown) => {
        assertLive()
        return core.preflightLoad(data)
      },
      getCandidates: () => {
        assertLive()
        return core
          .getAllElementData()
          .filter((item) => item.data.type === ComponentTypes.CANDIDATE)
          .map((item) => ({ id: item.data.id, name: item.data.name }))
      },
      getWorkcell: (id: string) => {
        assertLive()
        return readWorkcell(core, id)
      },
      getExperiments: (candidateId: string) => {
        assertLive()
        return readExperiments(core, candidateId)
      },
      getExperiment: (experimentId: string) => {
        assertLive()
        return readExperiment(core, experimentId)
      },
      getMethodDescriptors: () => {
        assertLive()
        return structuredClone([OFFICIAL_CLEARANCE_METHOD])
      },
      preflightExperiment: (experimentId: string) => {
        assertLive()
        const experiment = readExperiment(core, experimentId)
        const report = checkExperiment(
          readWorkcell(core, experiment.candidateId),
          experiment.definition,
          [OFFICIAL_CLEARANCE_METHOD]
        )
        if (!loadIssues.length) return report
        return {
          ...report,
          blockers: [
            ...report.blockers,
            {
              code: 'load-recovery-unresolved',
              message:
                'Retained load recovery requirements must be corrected or acknowledged before formal analysis.'
            }
          ]
        }
      },
      createExperimentSnapshot: (
        experimentId: string,
        acknowledgedWarningCodes: readonly string[]
      ) => {
        assertAccepting()
        if (loadIssues.length)
          throw new Error(
            'Retained load recovery requirements block formal analysis'
          )
        const experiment = readExperiment(core, experimentId)
        return freezeExperiment({
          snapshotId: crypto.randomUUID(),
          candidateId: experiment.candidateId,
          experimentId,
          workcell: readWorkcell(core, experiment.candidateId),
          definition: experiment.definition,
          methods: [OFFICIAL_CLEARANCE_METHOD],
          acknowledgedWarningCodes
        })
      },
      getLoadIssues: () => {
        assertLive()
        return structuredClone(loadIssues)
      },
      getHistoryDepth: () => {
        assertLive()
        return core.getUndoHistoryDepth()
      },
      setFrame: (frame: SpatialFrame) => {
        assertLive()
        layer.submit(frame)
      },
      pick: (x: number, y: number) => {
        if (disposed) return null
        const bounds = core.getCanvasBounds()
        if (
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
      save,
      load: (data: unknown) => {
        assertAccepting()
        loadIssues = loadCanonicalDocument(core, data)
        return structuredClone(loadIssues)
      },
      subscribe: (listener: () => void) => {
        assertLive()
        const unsubscribe = core.subscribeToTransactionStatus((event) => {
          if (
            !disposed &&
            (event.status === 'committed' || event.status === 'rolled-back')
          )
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
    try {
      await dispose()
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Runtime startup and cleanup failed'
      )
    }
    throw error
  }
}
export type SimRuntime = Awaited<ReturnType<typeof bootstrap>>
