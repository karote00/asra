import currentCore from '@asyra/core'
import type { RenderEngineProvider } from '@asyra/render-engine'
import { ComponentTypes, MethodIds, MethodVersions } from '../constants'
import { readWorkcell, readCandidateLineage } from '../common-apis/workcell'
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
import { createMechanicalVisuals } from '../../samples/mechanical-visuals'
import { createSyntheticExperimentDraft } from '../../samples/synthetic-experiment'
import {
  projectVisualAssetIds,
  type ProjectSnapshot
} from '../storage/project-format'
import { AnalysisRunner } from '../analysis/runner'
import { INSTALLED_METHOD_CATALOG } from '../extensions/installed-methods'
import { preflightExperiment as checkExperiment } from '../analysis/preflight'
import { createExperimentSnapshot as freezeExperiment } from '../analysis/snapshot'
import { RunArchive } from '../storage/run-record'
import { readCapturedRunReferences } from '../common-apis/run-reference'
import { readFieldObservations } from '../common-apis/field-observation'
import type { ObservationAttachmentReference } from '../common-apis/observation-contract'
import { installRunStorageFeature } from '../features/storage-runs'
import { installVisualStorageFeatures } from '../features/storage-visuals'
import { installObservationStorageFeatures } from '../features/storage-observations'
import {
  ObservationAttachmentArchive,
  type PreparedObservationAttachments
} from '../storage/observation-archive'
import {
  projectObservationAttachments,
  validateProjectObservationReferences,
  exportObservationBundle
} from '../storage/project-observations'
import {
  VisualAssetArchive,
  type PreparedVisualImport
} from '../storage/visual-archive'
import { prepareProjectVisuals } from '../storage/project-visuals'
import { readCapturedVisualBindingGroups } from '../common-apis/visual-reference'
import type { Workcell } from '../domain/workcell'
import { resolvePartWorkcell } from '../domain/part-geometry'
import { validateOriginalPartSources } from '../storage/original-part-sources'

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
  snapshot?: ProjectSnapshot,
  prepared?: VisualAssetArchive
) {
  const core = currentCore
  if (!core.isCompositionOpen()) throw new Error('Runtime already started')
  let rendering: ReturnType<typeof installCustomRenderer> | undefined
  let visualResources: VisualAssetArchive | undefined
  let observationResources: ObservationAttachmentArchive | undefined
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
      // Also covers startup failure before the storage Feature cleanup was registered.
      attempt(() => visualResources?.dispose())
      attempt(() => observationResources?.dispose())
      if (errors.length === 1) throw errors[0]
      if (errors.length)
        throw new AggregateError(errors, 'Runtime cleanup failed')
    })
    return disposal
  }
  try {
    const visuals =
      prepared ??
      (snapshot
        ? await prepareProjectVisuals(snapshot)
        : new VisualAssetArchive())
    visualResources = visuals
    const observations = snapshot
      ? await ObservationAttachmentArchive.hydrate(
          validateProjectObservationReferences(snapshot)
        )
      : new ObservationAttachmentArchive()
    observationResources = observations
    if (snapshot) {
      for (const bindings of readCapturedVisualBindingGroups(
        snapshot.document
      ).values())
        visuals.resolveBindings(bindings)
      for (const run of snapshot.runs ?? [])
        visuals.resolveWorkcell(run.snapshot.workcell)
    }
    const archive = new RunArchive(snapshot?.runs, (record) =>
      validateOriginalPartSources(record.snapshot, visuals)
    )
    const captureRuns = (document: unknown) =>
      readCapturedRunReferences(document).map((reference) => {
        const run = archive.get(reference.runId)
        if (
          !run ||
          run.snapshot.snapshotId !== reference.snapshotId ||
          run.snapshot.source.candidateId !== reference.candidateId ||
          run.snapshot.source.experimentId !== reference.experimentId
        )
          throw new Error(
            `Retained evidence is missing or mismatched: ${reference.runId}`
          )
        return run
      })
    rendering = installCustomRenderer(core, provider)
    const layer = rendering.layer
    installModelComponents(core)
    const editing = installEditingFeatures(core, {
      validateVisuals: (workcell) => {
        resolvePartWorkcell(workcell, visuals.resolveWorkcell(workcell))
      },
      validateObservationAttachments: (references) =>
        observations.resolve(references),
      readRun: (runId) => {
        const run = archive.get(runId)
        if (!run) return
        return {
          runId,
          snapshotId: run.snapshot.snapshotId,
          candidateId: run.snapshot.source.candidateId,
          experimentId: run.snapshot.source.experimentId,
          name: run.name
        }
      }
    })
    const storage = installRunStorageFeature(core, archive, (runId) => {
      assertAccepting()
      return editing.edit.attachRun(runId)
    })
    const analysisRunner = new AnalysisRunner()
    const analysis = installAnalysisFeature(core, analysisRunner)
    const visualStorage = installVisualStorageFeatures(
      core,
      visuals,
      (...args) => {
        assertAccepting()
        return editing.edit.upsertVisual(...args)
      }
    )
    const observationStorage = installObservationStorageFeatures(
      core,
      observations,
      {
        addObservation: (...args) => {
          assertAccepting()
          return editing.edit.addObservation(...args)
        },
        updateObservation: (...args) => {
          assertAccepting()
          return editing.edit.updateObservation(...args)
        }
      }
    )
    const features = {
      edit: guardCommands(editing.edit, assertAccepting),
      history: guardCommands(editing.history, assertAccepting),
      storage: guardCommands(storage, assertAccepting),
      observations: {
        ...guardCommands(
          {
            prepare: observationStorage.prepare,
            retain: observationStorage.retain
          },
          assertAccepting
        ),
        cancel: () => {
          assertLive()
          return observationStorage.cancel()
        },
        discard: (receipt: PreparedObservationAttachments) => {
          assertLive()
          observationStorage.discard(receipt)
        }
      },
      visuals: {
        ...guardCommands(
          { prepare: visualStorage.prepare, retain: visualStorage.retain },
          assertAccepting
        ),
        cancel: () => {
          assertLive()
          return visualStorage.cancel()
        },
        discard: (receipt: PreparedVisualImport) => {
          assertLive()
          visualStorage.discard(receipt)
        }
      },
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
        },
        getProgress: () => {
          assertLive()
          return analysis.getProgress()
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
    if (snapshot) captureRuns(core.getCanonicalOwnerSnapshot())
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
      for (const source of createMechanicalVisuals()) {
        const receipt = await visuals.prepare(
          source.bytes,
          `${source.body}.glb`
        )
        const retained = visuals.accept(receipt)
        const body = example.workcell.bodies.find(
          (value) => value.id === `example:${source.body}`
        )
        if (!body)
          throw new Error(`Missing example visual target: ${source.body}`)
        body.visuals = [
          {
            version: 1,
            id: 'main-body',
            assetId: retained.assetId,
            pose: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
            scale: [1, 1, 1]
          }
        ]
        body.colliders = []
      }
      const candidateId = await features.edit.createCandidate(
        'A - Baseline workcell',
        example.workcell
      )
      const draft = createSyntheticExperimentDraft(example)
      draft.method.id = MethodIds.ORIGINAL_PART_CLEARANCE
      draft.method.version = MethodVersions.ORIGINAL_PART_CLEARANCE
      await features.edit.createExperiment(
        candidateId,
        'Synthetic clearance study',
        draft
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
    const getObservations = (runId: string) => {
      assertLive()
      const notes = readFieldObservations(core, runId)
      observations.resolve(notes.flatMap((note) => note.attachments))
      return notes
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
      captureSnapshot: async () => {
        const document = await save()
        const runs = captureRuns(document)
        const visualSources = visuals.capture(
          projectVisualAssetIds({ document, runs })
        )
        const references = projectObservationAttachments({ document })
        observations.resolve(references)
        const observationSources = observations.capture(
          references.map((reference) => reference.sourceId)
        )
        return {
          document,
          loadIssues: structuredClone(loadIssues),
          ...(runs.length ? { runs } : {}),
          ...(visualSources.length ? { visualSources } : {}),
          ...(observationSources.length ? { observationSources } : {})
        }
      },
      getObservations,
      getObservationAttachment: (reference: ObservationAttachmentReference) => {
        assertLive()
        observations.resolve([reference])
        return observations.bytes(reference.sourceId)
      },
      exportObservations: (runId: string) => {
        const notes = getObservations(runId)
        const run = archive.get(runId)
        if (!run)
          throw new Error(
            'Missing retained run evidence for observation export'
          )
        return exportObservationBundle(run, notes, observations)
      },
      getVisualAssets: (workcell: Workcell, pending?: PreparedVisualImport) => {
        assertLive()
        return visuals.resolveWorkcell(workcell, pending)
      },
      getRuns: () => {
        assertLive()
        return captureRuns(core.getCanonicalOwnerSnapshot())
      },
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
      getCandidateLineage: (id: string) => {
        assertLive()
        return readCandidateLineage(core, id)
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
        return structuredClone(INSTALLED_METHOD_CATALOG.descriptors)
      },
      preflightExperiment: (experimentId: string) => {
        assertLive()
        const experiment = readExperiment(core, experimentId)
        const workcell = readWorkcell(core, experiment.candidateId)
        const resolved = resolvePartWorkcell(
          workcell,
          visuals.resolveWorkcell(workcell)
        )
        const report = checkExperiment(
          resolved,
          experiment.definition,
          INSTALLED_METHOD_CATALOG.descriptors
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
        const workcell = readWorkcell(core, experiment.candidateId)
        const resolved = resolvePartWorkcell(
          workcell,
          visuals.resolveWorkcell(workcell)
        )
        return freezeExperiment({
          snapshotId: crypto.randomUUID(),
          candidateId: experiment.candidateId,
          experimentId,
          workcell: resolved,
          definition: experiment.definition,
          methods: INSTALLED_METHOD_CATALOG.descriptors,
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
