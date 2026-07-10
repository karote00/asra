import { readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  alternateStrokeParameterPayload,
  assertStrokeParameterCoverageForStep,
  expectNoStrokeParameterOutputKeys,
  representativeStrokeParameterPayload,
  strokeParameterPayloadAllowedKeys
} from './stroke-parameter-coverage-test-helper'
import * as Y from 'yjs'
import { SharedDataChannelRegistry } from '@asyra/factory'
import { SCENE_TREE_ACTIONS, SharedDataChannelNames } from '@asyra/utils'

type RefactorStatus = 'locked' | 'active' | 'verified'

interface InspectorStep {
  id: string
  refactorStatus: RefactorStatus
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  ownerStage: string
  forbiddenContributors: string[]
  evidenceRequired: string[]
}

interface InspectorData {
  steps: InspectorStep[]
  inspectorContractErrors: string[]
}

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../'
)
const require = createRequire(import.meta.url)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const coreDataChannelObserverSourcePath = resolve(
  repoRoot,
  'packages/core/src/data-channel-observer.ts'
)
const sceneTreeSourcePath = resolve(
  repoRoot,
  'packages/scene-tree/src/sceneTree.ts'
)
const sceneTreeSubscribesSourcePath = resolve(
  repoRoot,
  'packages/scene-tree/src/subscribes.ts'
)
const presetDataChannelSourcePath = resolve(
  repoRoot,
  'packages/preset/src/subscriptions/data-channel.ts'
)
const appIntentRoots = [
  resolve(repoRoot, 'apps/asyra-design/src/common-apis'),
  resolve(repoRoot, 'apps/asyra-design/src/features'),
  resolve(repoRoot, 'apps/asyra-design/src/properties')
]

let cachedInspectorData: InspectorData | null = null

const loadInspectorData = (): InspectorData => {
  if (cachedInspectorData) {
    return cachedInspectorData
  }
  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window =
    windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)
  const data = windowRecord.STROKE_FLOW_INSPECTOR_DATA
  expect(data).toBeDefined()
  cachedInspectorData = data as InspectorData
  return cachedInspectorData
}

const readRepoFile = (path: string) => readFileSync(path, 'utf8')

const extractBetween = (source: string, start: string, end: string): string => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return source.slice(startIndex, endIndex)
}

const collectSourceFiles = (root: string): string[] => {
  return readdirSync(root).flatMap((entry) => {
    const path = resolve(root, entry)
    const stats = statSync(path)
    if (stats.isDirectory()) {
      return collectSourceFiles(path)
    }
    return ['.ts', '.tsx'].includes(extname(path)) ? [path] : []
  })
}

describe('stroke flow step 12: downstream-subscriber-routing', () => {
  it('keeps downstream-subscriber-routing as the current or verified twelfth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'downstream-subscriber-routing'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'downstream-subscriber-routing'
      ])
    }
  })

  it('declares the complete data-channel implementation surface for this step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'downstream-subscriber-routing'
    )

    expect(step).toMatchObject({
      ownerStage: 'Data Channel',
      allowedInputs: ['computed patch event'],
      requiredOutputs: ['render/UI subscriber updates']
    })
    expect(step?.implementationFiles).toEqual(
      expect.arrayContaining([
        'packages/core/src/data-channel-observer.ts',
        'packages/factory/src/',
        'packages/scene-tree/src/',
        'packages/preset/src/subscriptions/'
      ])
    )
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'diagnostic/helper data as visible product output',
        'downstream repair for an upstream semantic mismatch'
      ])
    )
    expect(step?.evidenceRequired).toEqual(
      expect.arrayContaining([
        'input id or revision',
        'output id or revision',
        'route owner stage'
      ])
    )
  })

  it('routes shared scene-tree channel changes to observers without changing payloads', () => {
    const registry = new SharedDataChannelRegistry()
    const doc = new Y.Doc()
    const channel = doc.getArray(SharedDataChannelNames.SCENE_TREE)
    const received: unknown[] = []
    registry.register(SharedDataChannelNames.SCENE_TREE, channel)
    const cleanup = registry.observe(
      SharedDataChannelNames.SCENE_TREE,
      (change) => {
        received.push(change)
      }
    )
    const computedPatchChange = {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
      eventName: 'updateComputedDataPatch',
      id: 'element:step-12',
      patch: {
        values: {
          width: {
            before: 80,
            after: 96
          },
          strokes: {
            before: [alternateStrokeParameterPayload],
            after: [representativeStrokeParameterPayload]
          },
          fills: {
            before: [alternateStrokeParameterPayload.fill],
            after: [representativeStrokeParameterPayload.fill]
          }
        }
      },
      options: {
        routeId: 'downstream-subscriber-routing'
      }
    }

    expect(
      registry.pushToSharedChannel(
        SharedDataChannelNames.SCENE_TREE,
        computedPatchChange
      )
    ).toBe(true)

    expect(received).toEqual([computedPatchChange])
    expectNoStrokeParameterOutputKeys(
      received,
      strokeParameterPayloadAllowedKeys
    )
    cleanup()
    registry.pushToSharedChannel(SharedDataChannelNames.SCENE_TREE, {
      ...computedPatchChange,
      id: 'element:after-cleanup'
    })
    expect(received).toEqual([computedPatchChange])
  })

  it('keeps scene-tree computed patch commits on the shared scene-tree data channel', () => {
    const sceneTreeSource = readRepoFile(sceneTreeSourcePath)
    const sceneTreeSubscribesSource = readRepoFile(
      sceneTreeSubscribesSourcePath
    )
    const coreObserverSource = readRepoFile(coreDataChannelObserverSourcePath)

    expect(sceneTreeSubscribesSource).toContain(
      'subscribeToChangeComputedDataPatch'
    )
    expect(sceneTreeSubscribesSource).toContain(
      'sceneTree.patchComputedData(elementId, patch, options)'
    )
    expect(sceneTreeSubscribesSource).toContain(
      'sceneTree.commitSceneTreeTransaction(options)'
    )
    expect(sceneTreeSubscribesSource).toContain(
      'subscribeToUpdateComputedDataPatch'
    )
    expect(sceneTreeSubscribesSource).toContain(
      'sceneTree.patchComputedData(id, toAppliedComputedDataPatch(patch), options)'
    )
    expect(sceneTreeSource).toContain(
      'action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH'
    )
    expect(sceneTreeSource).toContain(
      'eventName: EventTypes.UPDATE_COMPUTED_DATA_PATCH'
    )
    expect(sceneTreeSource).toContain(
      'shared: changeOptions?.shared ?? SharedDataChannelNames.SCENE_TREE'
    )
    expect(coreObserverSource).toContain('factory.observeSharedDataChannel(')
    expect(coreObserverSource).toContain('registration.channel')
    expect(coreObserverSource).toContain('registration.onChange')
  })

  it('splits downstream computed patch output into render mirror and UI subscriber routes only', () => {
    const source = readRepoFile(presetDataChannelSourcePath)
    const renderMirrorRoute = extractBetween(
      source,
      'const updateRenderSceneTree = (change: SceneTreeChange) => {',
      '// Render selection mirror used by overlay/render behavior.'
    )
    const uiContextRoute = extractBetween(
      source,
      'const handleUIContextSceneTreeChange = (',
      'const applySelectionChangeToRuntime = ('
    )
    const renderObserverDeclaration = extractBetween(
      source,
      'const renderSceneTreeDataChannelObserver = defineDataChannelObserver({',
      'const renderSelectionDataChannelObserver = defineDataChannelObserver({'
    )
    const uiContextObserverDeclaration = extractBetween(
      source,
      'const uiContextSceneTreeDataChannelObserver = defineDataChannelObserver({',
      'const uiContextSelectionDataChannelObserver = defineDataChannelObserver({'
    )
    const registrationRoute = extractBetween(
      source,
      '  core.registerDataChannelObserver(renderSceneTreeDataChannelObserver)',
      '  hasRegistered = true'
    )

    expect(renderMirrorRoute).toContain(
      'case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH'
    )
    expect(renderMirrorRoute).toContain(
      'renderSceneTreeStore.updateElementPatch(id, patch, options)'
    )
    expect(uiContextRoute).toContain(
      'case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH'
    )
    expect(uiContextRoute).toContain('Object.keys(patch.values ?? {})')
    expect(uiContextRoute).toContain(
      'pendingUIContextSync.dirtyElementDataMapIds'
    )
    expect(renderObserverDeclaration).toContain(
      "name: 'preset.render.sceneTree'"
    )
    expect(renderObserverDeclaration).toContain(
      'channel: SharedDataChannelNames.SCENE_TREE'
    )
    expect(uiContextObserverDeclaration).toContain(
      "name: 'preset.uiContext.sceneTree'"
    )
    expect(uiContextObserverDeclaration).toContain(
      'channel: SharedDataChannelNames.SCENE_TREE'
    )
    expect(uiContextObserverDeclaration).toContain(
      'handleUIContextSceneTreeChange(change, core, deps)'
    )
    expect(registrationRoute).toContain(
      'registerDataChannelObserver(renderSceneTreeDataChannelObserver)'
    )
    expect(registrationRoute).toContain(
      'registerDataChannelObserver(uiContextSceneTreeDataChannelObserver)'
    )

    for (const forbiddenToken of [
      'buildSourceVertexJoinFootprint',
      'buildConstrained',
      'strokePathStyle',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'fillPolygons'
    ]) {
      expect(renderMirrorRoute).not.toContain(forbiddenToken)
      expect(uiContextRoute).not.toContain(forbiddenToken)
      expect(renderObserverDeclaration).not.toContain(forbiddenToken)
      expect(uiContextObserverDeclaration).not.toContain(forbiddenToken)
      expect(registrationRoute).not.toContain(forbiddenToken)
    }
  })

  it('preserves stroke parameter changes as routing payload keys without semantic branching', () => {
    const source = readRepoFile(presetDataChannelSourcePath)
    const renderMirrorRoute = extractBetween(
      source,
      'const updateRenderSceneTree = (change: SceneTreeChange) => {',
      '// Render selection mirror used by overlay/render behavior.'
    )
    const uiContextRoute = extractBetween(
      source,
      'const handleUIContextSceneTreeChange = (',
      'const applySelectionChangeToRuntime = ('
    )

    expect(renderMirrorRoute).toContain(
      'const { id, patch, options } = change as UpdateElementPatchChange'
    )
    expect(renderMirrorRoute).toContain(
      'renderSceneTreeStore.updateElementPatch(id, patch, options)'
    )
    expect(uiContextRoute).toContain('Object.keys(patch.values ?? {})')
    for (const forbiddenToken of [
      'joinType',
      'capType',
      'miterAngle',
      'resolvedJoin',
      'vertexAngle',
      'angleSource',
      'dash',
      'gap'
    ]) {
      expect(renderMirrorRoute).not.toContain(forbiddenToken)
      expect(uiContextRoute).not.toContain(forbiddenToken)
    }
  })

  it('does not let app intent/common-api code directly synchronize render state', () => {
    const checkedFiles = appIntentRoots.flatMap(collectSourceFiles)

    expect(checkedFiles.length).toBeGreaterThan(0)
    for (const path of checkedFiles) {
      const source = readRepoFile(path)
      for (const forbiddenToken of [
        'renderSceneTreeStore',
        'deps.render',
        '__asyraStrokeRenderEntries',
        'renderer-projection',
        'strokeMaskPolygons',
        'descriptorProductPolygons'
      ]) {
        expect(source, path).not.toContain(forbiddenToken)
      }
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('downstream-subscriber-routing')
  })
})
