import type {
  ComputedDataPatchChange,
  DataTypes,
  ElementRawData,
  WorkspaceRawData
} from '@asyra/utils'
import { EntityTypes } from '@asyra/utils'
import sceneTree from '@asyra/scene-tree'
import { RenderElementData } from '../types'

import render from '../render'
import type { RenderLayerRegistration } from '../types/render-layer'

const DIRECT_RENDER_PROPERTY_KEYS = new Set(['x', 'y', 'rotation'])
const SCENE_TREE_PENDING_RENDER_LAYER = 'render-scene-tree-pending-updates'

interface ComputedDataMirrorEntry {
  rawDataSnapshot: Record<string, unknown>
  computedDataSnapshot: Record<string, DataTypes>
  renderDataSnapshot: RenderElementData
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const hasOwn = (record: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(record, key)

const isDataEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => isDataEqual(value, right[index]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) {
    return false
  }

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => hasOwn(right, key) && isDataEqual(left[key], right[key])
    )
  )
}

const measureBrowserDragPhase = <T>(phaseName: string, run: () => T): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraBrowserDragPhaseSink
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return run()
  } finally {
    sink(phaseName, performance.now() - start)
  }
}

const emitStrokePipelineCounter = (counterName: string, value = 1) => {
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value: number
      ) => void
    }
  ).__asyraStrokePipelineCounterSink?.(counterName, value)
}

class ComputedDataMirror {
  private entries = new Map<string, ComputedDataMirrorEntry>()

  clear() {
    this.entries.clear()
  }

  delete(elementId: string) {
    this.entries.delete(elementId)
    emitStrokePipelineCounter('computed-mirror-invalidate')
  }

  seed(
    elementId: string,
    reason: 'reload' | 'add'
  ): ComputedDataMirrorEntry | null {
    const element = sceneTree.getElementById(elementId)
    if (!element) {
      this.delete(elementId)
      return null
    }

    const { rawDataSnapshot, computedDataSnapshot } = measureBrowserDragPhase(
      'render-scene-tree:mirror-seed',
      () => ({
        rawDataSnapshot: element.save() as unknown as Record<string, unknown>,
        computedDataSnapshot: element.getAllComputedData() as Record<
          string,
          DataTypes
        >
      })
    )
    const entry = {
      rawDataSnapshot: { ...rawDataSnapshot },
      computedDataSnapshot: { ...computedDataSnapshot },
      renderDataSnapshot: {
        ...rawDataSnapshot,
        ...computedDataSnapshot
      } as unknown as RenderElementData
    }
    this.entries.set(elementId, entry)
    emitStrokePipelineCounter('computed-mirror-seed')
    emitStrokePipelineCounter(`computed-mirror-seed-${reason}`)
    return entry
  }

  get(elementId: string): ComputedDataMirrorEntry | null {
    const entry = this.entries.get(elementId)
    if (entry) {
      emitStrokePipelineCounter('computed-mirror-hit')
      return entry
    }

    emitStrokePipelineCounter('computed-mirror-cache-miss')
    return null
  }

  private installComputedSnapshot(
    elementId: string,
    entry: ComputedDataMirrorEntry,
    computedDataSnapshot: Record<string, DataTypes>
  ) {
    const nextEntry: ComputedDataMirrorEntry = {
      rawDataSnapshot: entry.rawDataSnapshot,
      computedDataSnapshot,
      renderDataSnapshot: {
        ...entry.rawDataSnapshot,
        ...computedDataSnapshot
      } as unknown as RenderElementData
    }
    this.entries.set(elementId, nextEntry)
  }

  applyComputedChange(
    elementId: string,
    key: string,
    before: DataTypes,
    after: DataTypes
  ) {
    const entry = this.get(elementId)
    if (!entry || !isDataEqual(entry.computedDataSnapshot[key], before)) {
      return false
    }

    this.installComputedSnapshot(elementId, entry, {
      ...entry.computedDataSnapshot,
      [key]: after
    })
    emitStrokePipelineCounter('computed-mirror-staged-change-count')
    return true
  }

  applyComputedChanges(
    elementId: string,
    changes: { key: string; before: DataTypes; after: DataTypes }[]
  ) {
    const entry = this.get(elementId)
    if (!entry) {
      return false
    }

    const computedDataSnapshot = { ...entry.computedDataSnapshot }
    for (const { key, before, after } of changes) {
      if (!isDataEqual(computedDataSnapshot[key], before)) {
        return false
      }
      computedDataSnapshot[key] = after
    }

    this.installComputedSnapshot(elementId, entry, computedDataSnapshot)
    emitStrokePipelineCounter(
      'computed-mirror-staged-change-count',
      changes.length
    )
    emitStrokePipelineCounter('computed-mirror-batch-apply-count')
    return true
  }

  applyComputedPatch(elementId: string, patch: ComputedDataPatchChange) {
    const entry = this.get(elementId)
    if (!entry) {
      return false
    }

    const computedDataSnapshot = { ...entry.computedDataSnapshot }
    let changeCount = 0
    for (const [key, change] of Object.entries(patch.values ?? {})) {
      if (!isDataEqual(computedDataSnapshot[key], change.before)) {
        return false
      }
      computedDataSnapshot[key] = change.after
      changeCount += 1
    }

    for (const [key, recordPatch] of Object.entries(patch.records ?? {})) {
      const currentRecord = computedDataSnapshot[key]
      if (!isRecord(currentRecord)) {
        return false
      }
      let nextRecord = { ...currentRecord } as Record<string, DataTypes>

      for (const [recordId, change] of Object.entries(recordPatch.set ?? {})) {
        const recordExists = hasOwn(nextRecord, recordId)
        if (
          ('before' in change &&
            (!recordExists ||
              !isDataEqual(nextRecord[recordId], change.before))) ||
          (!('before' in change) && recordExists)
        ) {
          return false
        }
        nextRecord[recordId] = change.after
        changeCount += 1
      }

      for (const [recordId, change] of Object.entries(
        recordPatch.remove ?? {}
      )) {
        if (
          !hasOwn(nextRecord, recordId) ||
          !isDataEqual(nextRecord[recordId], change.before)
        ) {
          return false
        }
        const { [recordId]: _removed, ...retainedRecord } = nextRecord
        nextRecord = retainedRecord
        changeCount += 1
      }

      computedDataSnapshot[key] = nextRecord
    }

    this.installComputedSnapshot(elementId, entry, computedDataSnapshot)
    emitStrokePipelineCounter(
      'computed-mirror-staged-change-count',
      changeCount
    )
    emitStrokePipelineCounter('computed-mirror-patch-apply-count')
    return true
  }

  composeRenderData(elementId: string): RenderElementData | null {
    const entry = this.get(elementId)
    if (!entry) {
      return null
    }

    return entry.renderDataSnapshot
  }
}

class RenderSceneTree {
  private _workspace: WorkspaceRawData | null
  private computedDataMirror = new ComputedDataMirror()
  private pendingElementUpdates = new Set<string>()
  private pendingFrameFlush = false
  private pendingFlush = false
  private frameAlignedFlush = false
  private flushingPendingChanges = false

  constructor() {
    this._workspace = null
    this.frameAlignedFlush = installPendingRenderLayer(this)
  }

  reload() {
    if (!sceneTree.currentWorkspace) return

    this.pendingElementUpdates.clear()
    this.pendingFrameFlush = false
    this.pendingFlush = false
    this.computedDataMirror.clear()

    const currentWorkspaceData =
      sceneTree.currentWorkspace.save() as WorkspaceRawData
    this._workspace = currentWorkspaceData

    render.clearElements()

    // Create root render node
    render.switchWorkspace({
      label: currentWorkspaceData.id,
      x: 0,
      y: 0
    })

    // Create all element render node
    sceneTree.getAllElements().forEach((element) => {
      const elementId = element.get('id')
      if (element.get('type') === EntityTypes.WORKSPACE) {
        return
      }
      const renderElementData = this.computedDataMirror.seed(
        elementId,
        'reload'
      )?.renderDataSnapshot
      if (renderElementData) {
        this.addElement(renderElementData)
      }
    })
  }

  private _getRenderData(id: string) {
    return this.computedDataMirror.composeRenderData(id)
  }

  addElementById(id: string) {
    this.computedDataMirror.seed(id, 'add')
    const renderElementData = this._getRenderData(id)
    if (renderElementData) {
      this.addElement(renderElementData)
    }
  }

  addElement(data: RenderElementData) {
    render.addElement(data)
  }

  removeElement(data: ElementRawData, parentId?: string) {
    this.computedDataMirror.delete(data.id)
    this.pendingElementUpdates.delete(data.id)
    render.removeElement(data.id, parentId)
  }

  updateElement(
    elementId: string,
    key: string,
    before: DataTypes,
    after: DataTypes,
    _options?: { undoable?: boolean }
  ) {
    const didStage = this.computedDataMirror.applyComputedChange(
      elementId,
      key,
      before,
      after
    )
    if (!didStage) {
      return
    }

    if (key === 'visible' || DIRECT_RENDER_PROPERTY_KEYS.has(key)) {
      this.recordDirtyChange(elementId, 1, this.pendingFrameFlush)
      measureBrowserDragPhase('render-scene-tree:update-direct-property', () =>
        render.updateElement(elementId, key, before, after)
      )
      this.pendingFrameFlush = true
      this.scheduleFlush()
      return
    }

    // Computed data updates arrive per-key; commit once the transaction ends.
    this.recordDirtyChange(
      elementId,
      1,
      this.pendingElementUpdates.has(elementId)
    )
    this.pendingElementUpdates.add(elementId)
    this.scheduleFlush()
  }

  updateElementBatch(
    elementId: string,
    changes: { key: string; before: DataTypes; after: DataTypes }[],
    _options?: { undoable?: boolean }
  ) {
    const didStage = this.computedDataMirror.applyComputedChanges(
      elementId,
      changes
    )
    if (!didStage) {
      return
    }

    const hasComputedFullUpdate = changes.some(
      ({ key }) => key !== 'visible' && !DIRECT_RENDER_PROPERTY_KEYS.has(key)
    )

    this.recordDirtyChange(
      elementId,
      changes.length,
      hasComputedFullUpdate
        ? this.pendingElementUpdates.has(elementId)
        : this.pendingFrameFlush
    )

    changes.forEach(({ key, before, after }) => {
      if (
        !hasComputedFullUpdate &&
        (key === 'visible' || DIRECT_RENDER_PROPERTY_KEYS.has(key))
      ) {
        measureBrowserDragPhase(
          'render-scene-tree:update-direct-property',
          () => render.updateElement(elementId, key, before, after)
        )
        this.pendingFrameFlush = true
      }
    })

    if (hasComputedFullUpdate) {
      this.pendingElementUpdates.add(elementId)
    }
    this.scheduleFlush()
  }

  updateElementPatch(
    elementId: string,
    patch: ComputedDataPatchChange,
    options?: { undoable?: boolean }
  ) {
    if (options?.undoable !== false) {
      Object.keys(patch.values ?? {}).forEach((key) => {
        emitStrokePipelineCounter(`computed-mirror-undoable-refresh-key-${key}`)
      })
    }

    const didStage = this.computedDataMirror.applyComputedPatch(
      elementId,
      patch
    )
    if (!didStage) {
      return
    }

    const directValueChanges = Object.entries(patch.values ?? {}).filter(
      ([key]) => key === 'visible' || DIRECT_RENDER_PROPERTY_KEYS.has(key)
    )
    const hasComputedFullUpdate =
      Object.keys(patch.records ?? {}).length > 0 ||
      Object.keys(patch.values ?? {}).some(
        (key) => key !== 'visible' && !DIRECT_RENDER_PROPERTY_KEYS.has(key)
      )

    const changeCount =
      Object.keys(patch.values ?? {}).length +
      Object.values(patch.records ?? {}).reduce(
        (sum, recordPatch) =>
          sum +
          Object.keys(recordPatch.set ?? {}).length +
          Object.keys(recordPatch.remove ?? {}).length,
        0
      )

    this.recordDirtyChange(
      elementId,
      changeCount,
      hasComputedFullUpdate
        ? this.pendingElementUpdates.has(elementId)
        : this.pendingFrameFlush
    )

    directValueChanges.forEach(([key, change]) => {
      if (!hasComputedFullUpdate) {
        measureBrowserDragPhase(
          'render-scene-tree:update-direct-property',
          () =>
            render.updateElement(elementId, key, change.before, change.after)
        )
        this.pendingFrameFlush = true
      }
    })

    if (hasComputedFullUpdate) {
      this.pendingElementUpdates.add(elementId)
    }
    this.scheduleFlush()
  }

  commitPendingComputedDataChanges() {
    this.scheduleFlush()
  }

  private recordDirtyChange(
    elementId: string,
    changeCount: number,
    didCoalesce: boolean
  ) {
    emitStrokePipelineCounter('dirty-change-count', changeCount)
    if (didCoalesce) {
      emitStrokePipelineCounter('dirty-change-coalesced-count', changeCount)
    }
    if (!this.pendingElementUpdates.has(elementId)) {
      emitStrokePipelineCounter('dirty-element-count')
    }
  }

  private scheduleFlush() {
    if (this.pendingFlush) {
      emitStrokePipelineCounter('render-scene-tree-flush-coalesced')
      return
    }

    this.pendingFlush = true
    if (this.frameAlignedFlush) {
      emitStrokePipelineCounter('render-scene-tree-frame-aligned-flush')
      render.requestRender()
      return
    }

    const schedule =
      typeof queueMicrotask === 'function'
        ? queueMicrotask
        : (callback: () => void) => {
            Promise.resolve().then(callback)
          }

    schedule(() => {
      this.flushPendingChanges()
    })
  }

  hasPendingChanges() {
    return this.pendingFrameFlush || this.pendingElementUpdates.size > 0
  }

  private flushPendingChanges() {
    if (this.flushingPendingChanges) {
      emitStrokePipelineCounter('render-scene-tree-flush-reentrant-skipped')
      return
    }

    const didFlush = this.applyPendingChanges()
    if (didFlush) {
      render.flushFrame()
    }
  }

  flushPendingChangesForFrame() {
    return this.applyPendingChanges()
  }

  private applyPendingChanges() {
    if (this.flushingPendingChanges) {
      emitStrokePipelineCounter('render-scene-tree-flush-reentrant-skipped')
      return false
    }

    if (!this.pendingFrameFlush && this.pendingElementUpdates.size === 0) {
      this.pendingFlush = false
      return false
    }

    return measureBrowserDragPhase('render-scene-tree:flush', () => {
      this.flushingPendingChanges = true
      try {
        this.pendingFlush = false
        emitStrokePipelineCounter('computed-mirror-commit-count')
        this.pendingFrameFlush = false
        const ids = Array.from(this.pendingElementUpdates)
        emitStrokePipelineCounter('product-render-per-render-frame', ids.length)
        this.pendingElementUpdates.clear()
        ids.forEach((id) => {
          const data = this._getRenderData(id)
          if (data) {
            measureBrowserDragPhase('render-scene-tree:update-element', () =>
              render.updateElement(
                id,
                'computed',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                undefined as any as DataTypes,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                undefined as any as DataTypes,
                data
              )
            )
          }
        })
        return true
      } finally {
        this.flushingPendingChanges = false
      }
    })
  }
}

let activeRenderSceneTree: RenderSceneTree | null = null
let pendingRenderLayerInstalled = false

const installPendingRenderLayer = (store: RenderSceneTree) => {
  activeRenderSceneTree = store
  const renderWithLayer = render as typeof render & {
    registerLayer?: (
      registration: RenderLayerRegistration,
      options?: { override?: boolean }
    ) => void
  }

  if (typeof renderWithLayer.registerLayer !== 'function') {
    return false
  }

  if (!pendingRenderLayerInstalled) {
    renderWithLayer.registerLayer({
      name: SCENE_TREE_PENDING_RENDER_LAYER,
      layer: {},
      shouldUpdate: () => activeRenderSceneTree?.hasPendingChanges() ?? false,
      update: () =>
        activeRenderSceneTree?.flushPendingChangesForFrame() ?? false
    })
    pendingRenderLayerInstalled = true
  }

  return true
}

export { RenderSceneTree }

const renderSceneTree = new RenderSceneTree()
export default renderSceneTree
