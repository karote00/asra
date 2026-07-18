import type {
  ComputedDataPatchChange,
  DataTypes,
  ElementRawData,
  SceneTreeDataOwner,
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

interface EffectiveTopLevelChange {
  key: string
  before: DataTypes
  after: DataTypes
}

interface TopLevelApplyResult {
  effectiveChanges: EffectiveTopLevelChange[]
}

type RenderProjectionStatus = 'applied' | 'resynced' | 'removed' | 'failed'

interface RenderProjectionOutcome {
  status: RenderProjectionStatus
  elementId: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const hasOwn = (record: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(record, key)

const isSceneTreeDataOwner = (value: unknown): value is SceneTreeDataOwner =>
  value === 'raw' || value === 'computed'

const getEffectiveValue = (
  rawDataSnapshot: Record<string, unknown>,
  computedDataSnapshot: Record<string, DataTypes>,
  key: string
): unknown =>
  hasOwn(computedDataSnapshot, key)
    ? computedDataSnapshot[key]
    : rawDataSnapshot[key]

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
    const clearedEntryCount = this.entries.size
    this.entries.clear()
    return clearedEntryCount
  }

  get size() {
    return this.entries.size
  }

  delete(elementId: string) {
    this.entries.delete(elementId)
    emitStrokePipelineCounter('computed-mirror-invalidate')
  }

  seed(
    elementId: string,
    reason: 'reload' | 'add' | 'resync'
  ): ComputedDataMirrorEntry | null {
    const element = sceneTree.getElementById(elementId)
    if (!element) {
      this.delete(elementId)
      return null
    }

    try {
      const { rawData, computedData } = measureBrowserDragPhase(
        'render-scene-tree:mirror-seed',
        () => ({
          rawData: element.save() as unknown,
          computedData: element.getAllComputedData() as unknown
        })
      )
      if (!isRecord(rawData) || !isRecord(computedData)) {
        throw new Error('Render snapshot parts must be records')
      }

      const rawDataSnapshot = { ...rawData }
      const computedDataSnapshot = {
        ...computedData
      } as Record<string, DataTypes>
      const renderDataSnapshot = {
        ...rawDataSnapshot,
        ...computedDataSnapshot
      }
      if (
        renderDataSnapshot.id !== elementId ||
        typeof renderDataSnapshot.type !== 'string' ||
        renderDataSnapshot.type.length === 0 ||
        renderDataSnapshot.type === EntityTypes.WORKSPACE
      ) {
        throw new Error('Render snapshot identity is incomplete')
      }

      const entry = {
        rawDataSnapshot,
        computedDataSnapshot,
        renderDataSnapshot: renderDataSnapshot as unknown as RenderElementData
      }
      this.entries.set(elementId, entry)
      emitStrokePipelineCounter('computed-mirror-seed')
      emitStrokePipelineCounter(`computed-mirror-seed-${reason}`)
      return entry
    } catch (error) {
      this.delete(elementId)
      emitStrokePipelineCounter('computed-mirror-seed-failed')
      throw error
    }
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

  private installSnapshot(
    elementId: string,
    rawDataSnapshot: Record<string, unknown>,
    computedDataSnapshot: Record<string, DataTypes>
  ) {
    const nextEntry: ComputedDataMirrorEntry = {
      rawDataSnapshot,
      computedDataSnapshot,
      renderDataSnapshot: {
        ...rawDataSnapshot,
        ...computedDataSnapshot
      } as unknown as RenderElementData
    }
    this.entries.set(elementId, nextEntry)
  }

  applyTopLevelChange(
    elementId: string,
    owner: SceneTreeDataOwner,
    key: string,
    before: DataTypes,
    after: DataTypes
  ): TopLevelApplyResult | null {
    if (!isSceneTreeDataOwner(owner)) {
      return null
    }
    const entry = this.get(elementId)
    if (!entry) {
      return null
    }

    const rawDataSnapshot = { ...entry.rawDataSnapshot }
    const computedDataSnapshot = { ...entry.computedDataSnapshot }
    const ownerSnapshot =
      owner === 'raw' ? rawDataSnapshot : computedDataSnapshot
    if (!isDataEqual(ownerSnapshot[key], before)) {
      return null
    }
    const effectiveBefore = getEffectiveValue(
      rawDataSnapshot,
      computedDataSnapshot,
      key
    )
    ownerSnapshot[key] = after
    const effectiveAfter = getEffectiveValue(
      rawDataSnapshot,
      computedDataSnapshot,
      key
    )

    this.installSnapshot(elementId, rawDataSnapshot, computedDataSnapshot)
    emitStrokePipelineCounter('computed-mirror-staged-change-count')
    return {
      effectiveChanges: isDataEqual(effectiveBefore, effectiveAfter)
        ? []
        : [
            {
              key,
              before: effectiveBefore as DataTypes,
              after: effectiveAfter as DataTypes
            }
          ]
    }
  }

  applyTopLevelChanges(
    elementId: string,
    changes: {
      owner: SceneTreeDataOwner
      key: string
      before: DataTypes
      after: DataTypes
    }[]
  ): TopLevelApplyResult | null {
    const entry = this.get(elementId)
    if (!entry) {
      return null
    }

    const rawDataSnapshot = { ...entry.rawDataSnapshot }
    const computedDataSnapshot = { ...entry.computedDataSnapshot }
    const effectiveChanges: EffectiveTopLevelChange[] = []
    for (const { owner, key, before, after } of changes) {
      if (!isSceneTreeDataOwner(owner)) {
        return null
      }
      const ownerSnapshot =
        owner === 'raw' ? rawDataSnapshot : computedDataSnapshot
      if (!isDataEqual(ownerSnapshot[key], before)) {
        return null
      }
      const effectiveBefore = getEffectiveValue(
        rawDataSnapshot,
        computedDataSnapshot,
        key
      )
      ownerSnapshot[key] = after
      const effectiveAfter = getEffectiveValue(
        rawDataSnapshot,
        computedDataSnapshot,
        key
      )
      if (!isDataEqual(effectiveBefore, effectiveAfter)) {
        effectiveChanges.push({
          key,
          before: effectiveBefore as DataTypes,
          after: effectiveAfter as DataTypes
        })
      }
    }

    this.installSnapshot(elementId, rawDataSnapshot, computedDataSnapshot)
    emitStrokePipelineCounter(
      'computed-mirror-staged-change-count',
      changes.length
    )
    emitStrokePipelineCounter('computed-mirror-batch-apply-count')
    return { effectiveChanges }
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

    this.installSnapshot(elementId, entry.rawDataSnapshot, computedDataSnapshot)
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
    this.resetProjection()
    render.clearElements()
    if (!sceneTree.currentWorkspace) return

    const currentWorkspaceData =
      sceneTree.currentWorkspace.save() as WorkspaceRawData
    this._workspace = currentWorkspaceData

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
      try {
        const renderElementData = this.computedDataMirror.seed(
          elementId,
          'reload'
        )?.renderDataSnapshot
        if (renderElementData) {
          this.addElement(renderElementData)
        }
      } catch {
        this.pendingElementUpdates.delete(elementId)
        this.computedDataMirror.delete(elementId)
        emitStrokePipelineCounter('computed-mirror-reload-seed-failed')
      }
    })
  }

  private _getRenderData(id: string) {
    return this.computedDataMirror.composeRenderData(id)
  }

  private projectionOutcome(
    elementId: string,
    status: RenderProjectionStatus
  ): RenderProjectionOutcome {
    return { status, elementId }
  }

  private resyncElement(elementId: string): RenderProjectionOutcome {
    emitStrokePipelineCounter('computed-mirror-projection-mismatch')
    this.pendingElementUpdates.delete(elementId)
    this.computedDataMirror.delete(elementId)

    try {
      const entry = this.computedDataMirror.seed(elementId, 'resync')
      if (!entry) {
        emitStrokePipelineCounter('computed-mirror-resync-removed')
        render.removeElement(elementId)
        return this.projectionOutcome(elementId, 'removed')
      }

      emitStrokePipelineCounter('computed-mirror-resync-success')
      if (render.getElementById(elementId)) {
        this.pendingElementUpdates.add(elementId)
        this.scheduleFlush()
      } else {
        this.addElement(entry.renderDataSnapshot)
      }
      return this.projectionOutcome(elementId, 'resynced')
    } catch {
      this.computedDataMirror.delete(elementId)
      emitStrokePipelineCounter('computed-mirror-resync-failed')
      render.removeElement(elementId)
      return this.projectionOutcome(elementId, 'failed')
    }
  }

  addElementById(id: string) {
    try {
      const entry = this.computedDataMirror.seed(id, 'add')
      if (!entry) {
        return this.projectionOutcome(id, 'removed')
      }
      this.addElement(entry.renderDataSnapshot)
      return this.projectionOutcome(id, 'applied')
    } catch {
      this.pendingElementUpdates.delete(id)
      this.computedDataMirror.delete(id)
      emitStrokePipelineCounter('computed-mirror-add-seed-failed')
      render.removeElement(id)
      return this.projectionOutcome(id, 'failed')
    }
  }

  addElement(data: RenderElementData) {
    render.addElement(data)
  }

  removeElement(data: ElementRawData, parentId?: string) {
    this.computedDataMirror.delete(data.id)
    this.pendingElementUpdates.delete(data.id)
    render.removeElement(data.id, parentId)
    return this.projectionOutcome(data.id, 'removed')
  }

  updateElement(
    elementId: string,
    owner: SceneTreeDataOwner,
    key: string,
    before: DataTypes,
    after: DataTypes,
    _options?: { undoable?: boolean }
  ) {
    const applyResult = this.computedDataMirror.applyTopLevelChange(
      elementId,
      owner,
      key,
      before,
      after
    )
    if (!applyResult) {
      return this.resyncElement(elementId)
    }

    const [effectiveChange] = applyResult.effectiveChanges
    if (!effectiveChange) {
      return this.projectionOutcome(elementId, 'applied')
    }

    if (key === 'visible' || DIRECT_RENDER_PROPERTY_KEYS.has(key)) {
      this.recordDirtyChange(elementId, 1, this.pendingFrameFlush)
      measureBrowserDragPhase('render-scene-tree:update-direct-property', () =>
        render.updateElement(
          elementId,
          key,
          effectiveChange.before,
          effectiveChange.after
        )
      )
      this.pendingFrameFlush = true
      this.scheduleFlush()
      return this.projectionOutcome(elementId, 'applied')
    }

    // Non-direct updates commit through the complete frame snapshot.
    this.recordDirtyChange(
      elementId,
      1,
      this.pendingElementUpdates.has(elementId)
    )
    this.pendingElementUpdates.add(elementId)
    this.scheduleFlush()
    return this.projectionOutcome(elementId, 'applied')
  }

  updateElementBatch(
    elementId: string,
    changes: {
      owner: SceneTreeDataOwner
      key: string
      before: DataTypes
      after: DataTypes
    }[],
    _options?: { undoable?: boolean }
  ) {
    const applyResult = this.computedDataMirror.applyTopLevelChanges(
      elementId,
      changes
    )
    if (!applyResult) {
      return this.resyncElement(elementId)
    }

    const { effectiveChanges } = applyResult
    if (effectiveChanges.length === 0) {
      return this.projectionOutcome(elementId, 'applied')
    }

    const hasComputedFullUpdate = effectiveChanges.some(
      ({ key }) => key !== 'visible' && !DIRECT_RENDER_PROPERTY_KEYS.has(key)
    )

    this.recordDirtyChange(
      elementId,
      effectiveChanges.length,
      hasComputedFullUpdate
        ? this.pendingElementUpdates.has(elementId)
        : this.pendingFrameFlush
    )

    effectiveChanges.forEach(({ key, before, after }) => {
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
    return this.projectionOutcome(elementId, 'applied')
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
      return this.resyncElement(elementId)
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
    return this.projectionOutcome(elementId, 'applied')
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
    if (!this.hasPendingChanges()) {
      return
    }

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

  getProjectionSnapshotCount() {
    return this.computedDataMirror.size
  }

  resetProjection() {
    const clearedEntryCount = this.computedDataMirror.clear()
    this.pendingElementUpdates.clear()
    this.pendingFrameFlush = false
    this.pendingFlush = false
    emitStrokePipelineCounter(
      'computed-mirror-reset-entry-count',
      clearedEntryCount
    )
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
let pendingRenderTeardownInstalled = false

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

  const renderWithLifecycle = render as typeof render & {
    registerTeardownCleanup?: (cleanup: () => void) => () => void
  }
  if (
    !pendingRenderTeardownInstalled &&
    typeof renderWithLifecycle.registerTeardownCleanup === 'function'
  ) {
    renderWithLifecycle.registerTeardownCleanup(() => {
      activeRenderSceneTree?.resetProjection()
    })
    pendingRenderTeardownInstalled = true
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
