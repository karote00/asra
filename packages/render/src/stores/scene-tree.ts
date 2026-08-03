import type {
  AddRemoveElementEntry,
  ComputedDataPatchChange,
  ComputedDataRecordValue,
  DataTypes,
  ElementRawData,
  HierarchyMove,
  SceneTreeDataOwner,
  SubtreeChange,
  WorkspaceRawData
} from '@asyra/utils'
import {
  EntityTypes,
  SCENE_TREE_ACTIONS,
  emitDiagnosticCounter,
  isRecord,
  measureBrowserDragPhase
} from '@asyra/utils'
import sceneTree from '@asyra/scene-tree'
import { RenderElementData } from '../types'

import render from '../render'
import renderStrategyRegistry from '../registries/render-strategy'
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

type ChildMembershipAction = 'add' | 'remove'

type RenderProjectionStatus = 'applied' | 'resynced' | 'removed' | 'failed'

interface RenderProjectionOutcome {
  status: RenderProjectionStatus
  elementId: string
}

const hasOwn = (record: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(record, key)

const getEnumerableOwnKeys = (value: object): PropertyKey[] =>
  Reflect.ownKeys(value).filter((key) =>
    Object.prototype.propertyIsEnumerable.call(value, key)
  )

const isArrayIndexKey = (key: PropertyKey): key is string => {
  if (typeof key !== 'string' || key === '') {
    return false
  }
  const index = Number(key)
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < 2 ** 32 - 1 &&
    String(index) === key
  )
}

const cloneArrayWithEnumerableProperties = <T>(
  value: T[],
  entries: T[] = value.slice()
): T[] => {
  const clone = entries
  getEnumerableOwnKeys(value).forEach((key) => {
    if (isArrayIndexKey(key)) {
      return
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor) {
      Object.defineProperty(clone, key, descriptor)
    }
  })
  return clone
}

const setOwn = (record: object, key: string, value: unknown): void => {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  })
}

const isSceneTreeDataOwner = (value: unknown): value is SceneTreeDataOwner =>
  value === 'raw' || value === 'computed'

const composeCompleteRenderData = (
  elementId: string,
  rawDataSnapshot: Record<string, unknown>,
  computedDataSnapshot: Record<string, DataTypes>
): RenderElementData | null => {
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
    return null
  }

  return renderDataSnapshot as unknown as RenderElementData
}

const getEffectiveValue = (
  rawDataSnapshot: Record<string, unknown>,
  computedDataSnapshot: Record<string, DataTypes>,
  key: string
): unknown =>
  hasOwn(computedDataSnapshot, key)
    ? computedDataSnapshot[key]
    : rawDataSnapshot[key]

interface ComparedDataPairs {
  leftToRight: WeakMap<object, object>
  rightToLeft: WeakMap<object, object>
}

const rememberComparedPair = (
  left: object,
  right: object,
  comparedPairs: ComparedDataPairs
): 'new' | 'equal' | 'mismatch' => {
  const mappedRight = comparedPairs.leftToRight.get(left)
  const mappedLeft = comparedPairs.rightToLeft.get(right)
  if (mappedRight !== undefined || mappedLeft !== undefined) {
    return mappedRight === right && mappedLeft === left ? 'equal' : 'mismatch'
  }
  comparedPairs.leftToRight.set(left, right)
  comparedPairs.rightToLeft.set(right, left)
  return 'new'
}

const isDataEqual = (
  left: unknown,
  right: unknown,
  comparedPairs: ComparedDataPairs = {
    leftToRight: new WeakMap(),
    rightToLeft: new WeakMap()
  }
): boolean => {
  if (Object.is(left, right)) {
    return true
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (
      !Array.isArray(left) ||
      !Array.isArray(right) ||
      left.length !== right.length
    ) {
      return false
    }
    const pairStatus = rememberComparedPair(left, right, comparedPairs)
    if (pairStatus !== 'new') {
      return pairStatus === 'equal'
    }
    const leftKeys = getEnumerableOwnKeys(left)
    const rightKeys = getEnumerableOwnKeys(right)
    if (leftKeys.length !== rightKeys.length) {
      return false
    }
    const leftRecord = left as unknown as Record<PropertyKey, unknown>
    const rightRecord = right as unknown as Record<PropertyKey, unknown>
    return leftKeys.every(
      (key) =>
        hasOwn(rightRecord, key) &&
        isDataEqual(leftRecord[key], rightRecord[key], comparedPairs)
    )
  }
  if (!isRecord(left) || !isRecord(right)) {
    return false
  }

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  const pairStatus = rememberComparedPair(left, right, comparedPairs)
  if (pairStatus !== 'new') {
    return pairStatus === 'equal'
  }
  return leftKeys.every(
    (key) =>
      hasOwn(right, key) && isDataEqual(left[key], right[key], comparedPairs)
  )
}

class ComputedDataMirror {
  private entries = new Map<string, ComputedDataMirrorEntry>()
  private childIdsBySnapshot = new WeakMap<unknown[], Set<string>>()

  clear() {
    const clearedEntryCount = this.entries.size
    this.entries.clear()
    return clearedEntryCount
  }

  get size() {
    return this.entries.size
  }

  get elementIds() {
    return [...this.entries.keys()]
  }

  private getChildIdSet(children: unknown[]): Set<string> | null {
    const cached = this.childIdsBySnapshot.get(children)
    if (cached) {
      emitDiagnosticCounter('computed-mirror-child-id-cache-hit')
      return cached
    }

    const childIds = new Set<string>()
    for (const candidate of children) {
      if (typeof candidate !== 'string' || childIds.has(candidate)) {
        return null
      }
      childIds.add(candidate)
    }
    this.childIdsBySnapshot.set(children, childIds)
    emitDiagnosticCounter('computed-mirror-child-id-cache-miss')
    return childIds
  }

  delete(elementId: string) {
    this.entries.delete(elementId)
    emitDiagnosticCounter('computed-mirror-invalidate')
  }

  private installSeed(
    elementId: string,
    rawData: unknown,
    computedData: unknown,
    reason: 'reload' | 'add' | 'resync' | 'hierarchy'
  ): ComputedDataMirrorEntry {
    if (!isRecord(rawData) || !isRecord(computedData)) {
      throw new Error('Render snapshot parts must be records')
    }

    const rawDataSnapshot = { ...rawData }
    const computedDataSnapshot = {
      ...computedData
    } as Record<string, DataTypes>
    const renderDataSnapshot = composeCompleteRenderData(
      elementId,
      rawDataSnapshot,
      computedDataSnapshot
    )
    if (!renderDataSnapshot) {
      throw new Error('Render snapshot identity is incomplete')
    }

    const entry = {
      rawDataSnapshot,
      computedDataSnapshot,
      renderDataSnapshot
    }
    this.entries.set(elementId, entry)
    emitDiagnosticCounter('computed-mirror-seed')
    emitDiagnosticCounter(`computed-mirror-seed-${reason}`)
    return entry
  }

  seed(
    elementId: string,
    reason: 'reload' | 'add' | 'resync' | 'hierarchy'
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
      return this.installSeed(elementId, rawData, computedData, reason)
    } catch (error) {
      this.delete(elementId)
      emitDiagnosticCounter('computed-mirror-seed-failed')
      throw error
    }
  }

  seedFromRawData(
    elementId: string,
    rawData: ElementRawData
  ): ComputedDataMirrorEntry | null {
    const element = sceneTree.getElementById(elementId)
    if (!element) {
      this.delete(elementId)
      return null
    }

    try {
      return this.installSeed(
        elementId,
        rawData,
        element.getAllComputedData() as unknown,
        'add'
      )
    } catch (error) {
      this.delete(elementId)
      emitDiagnosticCounter('computed-mirror-seed-failed')
      throw error
    }
  }

  get(elementId: string): ComputedDataMirrorEntry | null {
    const entry = this.entries.get(elementId)
    if (entry) {
      emitDiagnosticCounter('computed-mirror-hit')
      return entry
    }

    emitDiagnosticCounter('computed-mirror-cache-miss')
    return null
  }

  matchesElementParent(elementId: string, parentId: string): boolean {
    return this.entries.get(elementId)?.rawDataSnapshot.parentId === parentId
  }

  matchesParentChild(
    parentId: string,
    childId: string,
    index: number
  ): boolean {
    const children = this.entries.get(parentId)?.rawDataSnapshot.children
    return Array.isArray(children) && children[index] === childId
  }

  private installSnapshot(
    elementId: string,
    rawDataSnapshot: Record<string, unknown>,
    computedDataSnapshot: Record<string, DataTypes>
  ): boolean {
    const renderDataSnapshot = composeCompleteRenderData(
      elementId,
      rawDataSnapshot,
      computedDataSnapshot
    )
    if (!renderDataSnapshot) {
      return false
    }

    const nextEntry: ComputedDataMirrorEntry = {
      rawDataSnapshot,
      computedDataSnapshot,
      renderDataSnapshot
    }
    this.entries.set(elementId, nextEntry)
    return true
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
    if (
      !hasOwn(ownerSnapshot, key) ||
      !isDataEqual(ownerSnapshot[key], before)
    ) {
      return null
    }
    const effectiveBefore = getEffectiveValue(
      rawDataSnapshot,
      computedDataSnapshot,
      key
    )
    setOwn(ownerSnapshot, key, after)
    const effectiveAfter = getEffectiveValue(
      rawDataSnapshot,
      computedDataSnapshot,
      key
    )

    if (
      !this.installSnapshot(elementId, rawDataSnapshot, computedDataSnapshot)
    ) {
      return null
    }
    emitDiagnosticCounter('computed-mirror-staged-change-count')
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
      if (
        !hasOwn(ownerSnapshot, key) ||
        !isDataEqual(ownerSnapshot[key], before)
      ) {
        return null
      }
      const effectiveBefore = getEffectiveValue(
        rawDataSnapshot,
        computedDataSnapshot,
        key
      )
      setOwn(ownerSnapshot, key, after)
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

    if (
      !this.installSnapshot(elementId, rawDataSnapshot, computedDataSnapshot)
    ) {
      return null
    }
    emitDiagnosticCounter('computed-mirror-staged-change-count', changes.length)
    emitDiagnosticCounter('computed-mirror-batch-apply-count')
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
      if (
        !hasOwn(computedDataSnapshot, key) ||
        !isDataEqual(computedDataSnapshot[key], change.before)
      ) {
        return false
      }
      setOwn(computedDataSnapshot, key, change.after)
      changeCount += 1
    }

    for (const [key, recordPatch] of Object.entries(patch.records ?? {})) {
      const currentRecord = computedDataSnapshot[key]
      if (!hasOwn(computedDataSnapshot, key) || !isRecord(currentRecord)) {
        return false
      }
      let nextRecord = {
        ...currentRecord
      } as Record<string, ComputedDataRecordValue>

      for (const [recordId, change] of Object.entries(recordPatch.set ?? {})) {
        const recordExists = hasOwn(nextRecord, recordId)
        const hasOwnBefore = Object.prototype.hasOwnProperty.call(
          change,
          'before'
        )
        if (
          (hasOwnBefore &&
            (!recordExists ||
              !isDataEqual(nextRecord[recordId], change.before))) ||
          (!hasOwnBefore && recordExists)
        ) {
          return false
        }
        setOwn(nextRecord, recordId, change.after)
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

      setOwn(computedDataSnapshot, key, nextRecord)
    }

    if (
      !this.installSnapshot(
        elementId,
        entry.rawDataSnapshot,
        computedDataSnapshot
      )
    ) {
      return false
    }
    emitDiagnosticCounter('computed-mirror-staged-change-count', changeCount)
    emitDiagnosticCounter('computed-mirror-patch-apply-count')
    return true
  }

  applyChildMembershipChange(
    elementId: string,
    childId: string,
    index: number | undefined,
    action: ChildMembershipAction
  ): TopLevelApplyResult | null {
    const entry = this.get(elementId)
    const currentChildren = entry?.rawDataSnapshot.children
    if (
      !entry ||
      !Array.isArray(currentChildren) ||
      index === undefined ||
      !Number.isInteger(index) ||
      index < 0
    ) {
      return null
    }

    const nextChildren = cloneArrayWithEnumerableProperties(currentChildren)
    if (action === 'add') {
      if (index > currentChildren.length || currentChildren.includes(childId)) {
        return null
      }
      nextChildren.splice(index, 0, childId)
    } else {
      if (
        index >= currentChildren.length ||
        currentChildren[index] !== childId
      ) {
        return null
      }
      nextChildren.splice(index, 1)
    }

    return this.applyTopLevelChange(
      elementId,
      'raw',
      'children',
      currentChildren,
      nextChildren
    )
  }

  applyChildAdditionBatch(
    elementId: string,
    additions: readonly AddRemoveElementEntry[]
  ): TopLevelApplyResult | null {
    const entry = this.get(elementId)
    const currentChildren = entry?.rawDataSnapshot.children
    if (!entry || !Array.isArray(currentChildren) || additions.length === 0) {
      return null
    }

    const currentChildIdSet = this.getChildIdSet(currentChildren)
    if (!currentChildIdSet) {
      return null
    }
    const insertedIds = new Set<string>()
    const insertionByFinalIndex = new Map<number, string>()
    const finalLength = currentChildren.length + additions.length
    const appendIds = new Array<string>(additions.length)
    let appendCount = 0
    for (const { data, index } of additions) {
      const childId = data.id
      if (
        typeof childId !== 'string' ||
        childId.length === 0 ||
        insertedIds.has(childId) ||
        currentChildIdSet.has(childId) ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= finalLength ||
        insertionByFinalIndex.has(index)
      ) {
        return null
      }
      insertedIds.add(childId)
      insertionByFinalIndex.set(index, childId)
      const appendIndex = index - currentChildren.length
      if (appendIndex >= 0 && appendIndex < additions.length) {
        appendIds[appendIndex] = childId
        appendCount += 1
      }
    }

    let finalChildren: string[]
    if (appendCount === additions.length) {
      finalChildren = currentChildren.concat(appendIds) as string[]
      emitDiagnosticCounter('computed-mirror-child-add-batch-append')
    } else {
      let currentIndex = 0
      finalChildren = []
      for (let index = 0; index < finalLength; index += 1) {
        const insertedId = insertionByFinalIndex.get(index)
        if (insertedId) {
          finalChildren.push(insertedId)
          continue
        }
        const retainedId = currentChildren[currentIndex]
        if (retainedId === undefined) {
          return null
        }
        finalChildren.push(retainedId)
        currentIndex += 1
      }
      if (currentIndex !== currentChildren.length) {
        return null
      }
    }

    const rawDataSnapshot = { ...entry.rawDataSnapshot }
    setOwn(rawDataSnapshot, 'children', finalChildren)
    if (
      !this.installSnapshot(
        elementId,
        rawDataSnapshot,
        entry.computedDataSnapshot
      )
    ) {
      return null
    }

    this.childIdsBySnapshot.delete(currentChildren)
    insertedIds.forEach((childId) => currentChildIdSet.add(childId))
    this.childIdsBySnapshot.set(finalChildren, currentChildIdSet)
    emitDiagnosticCounter('computed-mirror-staged-change-count')
    emitDiagnosticCounter('computed-mirror-child-add-batch-apply')
    return {
      effectiveChanges: hasOwn(entry.computedDataSnapshot, 'children')
        ? []
        : [
            {
              key: 'children',
              before: currentChildren,
              after: finalChildren
            }
          ]
    }
  }

  applyChildRemovalBatch(
    elementId: string,
    removals: readonly AddRemoveElementEntry[]
  ): TopLevelApplyResult | null {
    const entry = this.get(elementId)
    const currentChildren = entry?.rawDataSnapshot.children
    if (
      !entry ||
      !Array.isArray(currentChildren) ||
      removals.length === 0 ||
      currentChildren.some((candidate) => typeof candidate !== 'string')
    ) {
      return null
    }

    const removalIndexes = new Set<number>()
    const removalIds = new Set<string>()
    for (const { data, index } of removals) {
      if (
        typeof data.id !== 'string' ||
        data.id.length === 0 ||
        removalIds.has(data.id) ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= currentChildren.length ||
        currentChildren[index] !== data.id
      ) {
        return null
      }
      removalIds.add(data.id)
      removalIndexes.add(index)
    }

    const retainedChildren = currentChildren.filter(
      (_childId, index) => !removalIndexes.has(index)
    ) as string[]
    const nextChildren = cloneArrayWithEnumerableProperties(
      currentChildren,
      retainedChildren
    )
    const applyResult = this.applyTopLevelChange(
      elementId,
      'raw',
      'children',
      currentChildren,
      nextChildren
    )
    if (applyResult) {
      emitDiagnosticCounter('computed-mirror-child-remove-batch-apply')
    }
    return applyResult
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
  private computedDataMirror = new ComputedDataMirror()
  private projectedElementIds = new Set<string>()
  private pendingElementUpdates = new Set<string>()
  private pendingFrameFlush = false
  private pendingFlush = false
  private frameAlignedFlush = false
  private flushingPendingChanges = false

  constructor() {
    this.frameAlignedFlush = installPendingRenderLayer(this)
  }

  private isDirectRenderProperty(elementId: string, key: string): boolean {
    if (key === 'visible' || DIRECT_RENDER_PROPERTY_KEYS.has(key)) {
      return true
    }
    const type = this.computedDataMirror.get(elementId)?.renderDataSnapshot.type
    return (
      typeof type === 'string' &&
      renderStrategyRegistry.supportsDirectProperty(type, key)
    )
  }

  private getCanonicalReloadEntries(
    currentWorkspaceData: WorkspaceRawData,
    seededEntries: Map<string, ComputedDataMirrorEntry>
  ): { elementId: string; siblingIndex?: number }[] {
    const visitedElementIds = new Set<string>()
    const entries: { elementId: string; siblingIndex?: number }[] = []

    const visitHierarchy = (
      roots: { elementId: string; siblingIndex?: number }[]
    ) => {
      const pending = [...roots].reverse()
      while (pending.length > 0) {
        const entry = pending.pop()
        if (!entry || visitedElementIds.has(entry.elementId)) {
          continue
        }
        const seededEntry = seededEntries.get(entry.elementId)
        if (!seededEntry) {
          continue
        }

        visitedElementIds.add(entry.elementId)
        entries.push(entry)
        const children = seededEntry.rawDataSnapshot.children
        if (Array.isArray(children)) {
          for (let index = children.length - 1; index >= 0; index -= 1) {
            const childId = children[index]
            if (typeof childId === 'string') {
              pending.push({ elementId: childId, siblingIndex: index })
            }
          }
        }
      }
    }

    if (Array.isArray(currentWorkspaceData.children)) {
      visitHierarchy(
        currentWorkspaceData.children.flatMap((elementId, index) =>
          typeof elementId === 'string'
            ? [{ elementId, siblingIndex: index }]
            : []
        )
      )
    }

    seededEntries.forEach((_entry, elementId) => {
      if (!visitedElementIds.has(elementId)) {
        visitHierarchy([{ elementId }])
      }
    })

    return entries
  }

  reload() {
    this.clearProjection()
    if (!sceneTree.currentWorkspace) return

    const currentWorkspaceData =
      sceneTree.currentWorkspace.save() as WorkspaceRawData

    // Create root render node
    render.switchWorkspace({
      label: currentWorkspaceData.id,
      x: 0,
      y: 0
    })

    // Rebuild parents before children and siblings in canonical hierarchy order.
    try {
      const seededEntries = new Map<string, ComputedDataMirrorEntry>()
      sceneTree.getAllElements().forEach((element) => {
        const elementId = element.get('id')
        if (element.get('type') === EntityTypes.WORKSPACE) {
          return
        }
        const entry = this.computedDataMirror.seed(elementId, 'reload')
        if (entry) {
          seededEntries.set(elementId, entry)
        }
      })

      this.getCanonicalReloadEntries(
        currentWorkspaceData,
        seededEntries
      ).forEach(({ elementId, siblingIndex }) => {
        const renderElementData =
          seededEntries.get(elementId)?.renderDataSnapshot
        if (renderElementData) {
          this.addElement(renderElementData, siblingIndex)
        }
      })
    } catch (error) {
      emitDiagnosticCounter('computed-mirror-reload-seed-failed')
      this.clearProjection()
      throw error
    }
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

  private releaseProjectedElement(elementId: string) {
    this.projectedElementIds.add(elementId)
    render.removeElement(elementId)
    this.projectedElementIds.delete(elementId)
  }

  private resyncElement(elementId: string): RenderProjectionOutcome {
    emitDiagnosticCounter('computed-mirror-projection-mismatch')
    this.pendingElementUpdates.delete(elementId)
    this.computedDataMirror.delete(elementId)

    let entry: ComputedDataMirrorEntry | null
    try {
      entry = this.computedDataMirror.seed(elementId, 'resync')
    } catch {
      emitDiagnosticCounter('computed-mirror-resync-failed')
      this.releaseProjectedElement(elementId)
      this.computedDataMirror.delete(elementId)
      return this.projectionOutcome(elementId, 'failed')
    }

    if (!entry) {
      emitDiagnosticCounter('computed-mirror-resync-removed')
      this.releaseProjectedElement(elementId)
      return this.projectionOutcome(elementId, 'removed')
    }

    try {
      this.addElement(entry.renderDataSnapshot)
    } catch {
      emitDiagnosticCounter('computed-mirror-resync-failed')
      this.releaseProjectedElement(elementId)
      this.computedDataMirror.delete(elementId)
      return this.projectionOutcome(elementId, 'failed')
    }

    emitDiagnosticCounter('computed-mirror-resync-success')
    return this.projectionOutcome(elementId, 'resynced')
  }

  private projectAddedElement(
    id: string,
    index?: number
  ): RenderProjectionOutcome {
    let entry: ComputedDataMirrorEntry | null
    try {
      entry = this.computedDataMirror.seed(id, 'add')
    } catch {
      this.pendingElementUpdates.delete(id)
      emitDiagnosticCounter('computed-mirror-add-seed-failed')
      this.releaseProjectedElement(id)
      this.computedDataMirror.delete(id)
      return this.projectionOutcome(id, 'failed')
    }

    if (!entry) {
      this.pendingElementUpdates.delete(id)
      this.releaseProjectedElement(id)
      return this.projectionOutcome(id, 'removed')
    }

    try {
      this.addElement(entry.renderDataSnapshot, index)
      return this.projectionOutcome(id, 'applied')
    } catch {
      this.pendingElementUpdates.delete(id)
      emitDiagnosticCounter('computed-mirror-add-seed-failed')
      this.releaseProjectedElement(id)
      this.computedDataMirror.delete(id)
      return this.projectionOutcome(id, 'failed')
    }
  }

  private projectAddedElementFromRawData(
    data: ElementRawData,
    index: number
  ): RenderProjectionOutcome {
    const { id } = data
    let entry: ComputedDataMirrorEntry | null
    try {
      entry = this.computedDataMirror.seedFromRawData(id, data)
    } catch {
      this.pendingElementUpdates.delete(id)
      emitDiagnosticCounter('computed-mirror-add-seed-failed')
      this.releaseProjectedElement(id)
      this.computedDataMirror.delete(id)
      return this.projectionOutcome(id, 'failed')
    }

    if (!entry) {
      this.pendingElementUpdates.delete(id)
      this.releaseProjectedElement(id)
      return this.projectionOutcome(id, 'removed')
    }

    try {
      this.addElement(entry.renderDataSnapshot, index)
      return this.projectionOutcome(id, 'applied')
    } catch {
      this.pendingElementUpdates.delete(id)
      emitDiagnosticCounter('computed-mirror-add-seed-failed')
      this.releaseProjectedElement(id)
      this.computedDataMirror.delete(id)
      return this.projectionOutcome(id, 'failed')
    }
  }

  private failProjectedAddition(elementId: string): RenderProjectionOutcome {
    this.pendingElementUpdates.delete(elementId)
    this.releaseProjectedElement(elementId)
    this.computedDataMirror.delete(elementId)
    return this.projectionOutcome(elementId, 'failed')
  }

  private synchronizeAddedElement(
    outcome: RenderProjectionOutcome,
    parentId?: string,
    index?: number
  ): RenderProjectionOutcome {
    if (outcome.status !== 'applied') {
      return outcome
    }
    const parentOutcome = this.synchronizeParentMembership(
      parentId,
      outcome.elementId,
      index,
      'add'
    )
    if (
      parentOutcome?.status !== 'failed' &&
      parentOutcome?.status !== 'removed'
    ) {
      return outcome
    }

    this.pendingElementUpdates.delete(outcome.elementId)
    this.releaseProjectedElement(outcome.elementId)
    this.computedDataMirror.delete(outcome.elementId)
    return this.projectionOutcome(outcome.elementId, 'failed')
  }

  addElementById(id: string, parentId?: string, index?: number) {
    return this.synchronizeAddedElement(
      this.projectAddedElement(id, index),
      parentId,
      index
    )
  }

  addElements(
    entries: readonly AddRemoveElementEntry[]
  ): readonly RenderProjectionOutcome[] {
    if (entries.length === 0) {
      return []
    }

    const elementIds = entries.map(({ data }) => data.id)
    if (
      new Set(elementIds).size !== elementIds.length ||
      entries.some(
        ({ data, parentId, index }) =>
          typeof data.id !== 'string' ||
          data.id.length === 0 ||
          data.parentId !== parentId ||
          typeof parentId !== 'string' ||
          parentId.length === 0 ||
          !Number.isInteger(index) ||
          index < 0
      )
    ) {
      return entries.map(({ data }) =>
        this.projectionOutcome(data.id, 'failed')
      )
    }

    const indexedEntriesByParent = new Map<
      string,
      { entry: AddRemoveElementEntry; inputIndex: number }[]
    >()
    entries.forEach((entry, inputIndex) => {
      const parentEntries = indexedEntriesByParent.get(entry.parentId) ?? []
      parentEntries.push({ entry, inputIndex })
      indexedEntriesByParent.set(entry.parentId, parentEntries)
    })

    const outcomes = entries.map(({ data }) =>
      this.projectionOutcome(data.id, 'failed')
    )
    indexedEntriesByParent.forEach((indexedEntries, parentId) => {
      if (!sceneTree.getElementById(parentId)) {
        return
      }
      const sortedEntries = [...indexedEntries].sort(
        (left, right) => left.entry.index - right.entry.index
      )
      sortedEntries.forEach(({ entry, inputIndex }) => {
        outcomes[inputIndex] = this.projectAddedElementFromRawData(
          entry.data,
          entry.index
        )
      })

      const hasProjectionFailure = sortedEntries.some(
        ({ inputIndex }) => outcomes[inputIndex]?.status !== 'applied'
      )
      const parentOutcome = hasProjectionFailure
        ? this.projectionOutcome(parentId, 'failed')
        : this.synchronizeParentMembershipBatch(
            parentId,
            sortedEntries.map(({ entry }) => entry)
          )
      if (
        parentOutcome?.status !== 'failed' &&
        parentOutcome?.status !== 'removed'
      ) {
        return
      }

      sortedEntries.forEach(({ entry, inputIndex }) => {
        if (outcomes[inputIndex]?.status === 'applied') {
          outcomes[inputIndex] = this.failProjectedAddition(entry.data.id)
        }
      })
    })
    return outcomes
  }

  addElement(data: RenderElementData, siblingIndex?: number) {
    this.projectedElementIds.add(data.id)
    const element =
      siblingIndex === undefined
        ? render.addElement(data)
        : render.addElement(data, siblingIndex)
    if (!element) {
      throw new Error(`Render failed to rebuild element ${data.id}`)
    }
    return element
  }

  removeElement(data: ElementRawData, parentId?: string, index?: number) {
    this.pendingElementUpdates.delete(data.id)
    this.projectedElementIds.add(data.id)
    render.removeElement(data.id, parentId)
    this.projectedElementIds.delete(data.id)
    this.computedDataMirror.delete(data.id)
    const parentOutcome = this.synchronizeParentMembership(
      parentId,
      data.id,
      index,
      'remove'
    )
    return parentOutcome?.status === 'failed'
      ? this.projectionOutcome(data.id, 'failed')
      : this.projectionOutcome(data.id, 'removed')
  }

  removeElements(
    entries: readonly AddRemoveElementEntry[]
  ): readonly RenderProjectionOutcome[] {
    if (entries.length === 0) {
      return []
    }
    const elementIds = entries.map(({ data }) => data.id)
    if (
      new Set(elementIds).size !== elementIds.length ||
      entries.some(
        ({ data, parentId, index }) =>
          typeof data.id !== 'string' ||
          data.id.length === 0 ||
          data.parentId !== parentId ||
          typeof parentId !== 'string' ||
          parentId.length === 0 ||
          !Number.isInteger(index) ||
          index < 0
      )
    ) {
      return entries.map(({ data }) =>
        this.projectionOutcome(data.id, 'failed')
      )
    }

    const entriesByParent = new Map<string, AddRemoveElementEntry[]>()
    entries.forEach((entry) => {
      const parentEntries = entriesByParent.get(entry.parentId) ?? []
      parentEntries.push(entry)
      entriesByParent.set(entry.parentId, parentEntries)
    })

    const renderDataByElementId = new Map<string, RenderElementData>()
    for (const { data } of entries) {
      const renderData = this._getRenderData(data.id)
      if (!renderData) {
        return entries.map(({ data: failedData }) =>
          this.projectionOutcome(failedData.id, 'failed')
        )
      }
      renderDataByElementId.set(data.id, renderData)
    }
    for (const parentId of entriesByParent.keys()) {
      if (!sceneTree.getElementById(parentId)) {
        return entries.map(({ data }) =>
          this.projectionOutcome(data.id, 'failed')
        )
      }
    }

    const appliedParentRemovals: {
      parentId: string
      entries: readonly AddRemoveElementEntry[]
    }[] = []
    for (const [parentId, parentEntries] of entriesByParent) {
      const parentOutcome = this.synchronizeParentRemovalBatch(
        parentId,
        parentEntries
      )
      if (
        parentOutcome?.status === 'failed' ||
        parentOutcome?.status === 'removed'
      ) {
        for (const applied of [...appliedParentRemovals].reverse()) {
          if (
            !this.compensateParentRemovalBatch(
              applied.parentId,
              applied.entries
            )
          ) {
            throw new Error(
              `Render failed to compensate parent ${applied.parentId}`
            )
          }
        }
        return entries.map(({ data }) =>
          this.projectionOutcome(data.id, 'failed')
        )
      }
      if (parentOutcome?.status === 'applied') {
        appliedParentRemovals.push({
          parentId,
          entries: parentEntries
        })
      }
    }

    const visuallyRemovedEntries: AddRemoveElementEntry[] = []
    try {
      for (const entry of entries) {
        this.pendingElementUpdates.delete(entry.data.id)
        render.removeElement(entry.data.id, entry.parentId)
        visuallyRemovedEntries.push(entry)
      }
    } catch (error) {
      for (const applied of [...appliedParentRemovals].reverse()) {
        if (
          !this.compensateParentRemovalBatch(applied.parentId, applied.entries)
        ) {
          throw new Error(
            `Render failed to compensate parent ${applied.parentId}`
          )
        }
      }
      const restoreEntriesByParent = new Map<string, AddRemoveElementEntry[]>()
      visuallyRemovedEntries.forEach((entry) => {
        const parentEntries = restoreEntriesByParent.get(entry.parentId) ?? []
        parentEntries.push(entry)
        restoreEntriesByParent.set(entry.parentId, parentEntries)
      })
      for (const parentEntries of restoreEntriesByParent.values()) {
        for (const entry of [...parentEntries].sort(
          (left, right) => left.index - right.index
        )) {
          const renderData = renderDataByElementId.get(entry.data.id)
          if (!renderData) {
            throw new Error(
              `Render lost removal compensation for ${entry.data.id}`
            )
          }
          this.addElement(renderData, entry.index)
        }
      }
      throw error
    }

    entries.forEach(({ data }) => {
      this.pendingElementUpdates.delete(data.id)
      this.projectedElementIds.delete(data.id)
      this.computedDataMirror.delete(data.id)
    })
    return entries.map(({ data }) => this.projectionOutcome(data.id, 'removed'))
  }

  moveElements(moves: readonly HierarchyMove[]): RenderProjectionOutcome {
    const elementId = moves[0]?.elementId ?? ''
    if (
      !Array.isArray(moves) ||
      moves.length === 0 ||
      new Set(moves.map((move) => move.elementId)).size !== moves.length
    ) {
      return this.projectionOutcome(elementId, 'failed')
    }

    const canonicalParents = new Map<string, readonly string[]>()
    const targetParentId = moves[0].after.parentId
    const affectedParentIds = [
      targetParentId,
      ...moves.map((move) => move.before.parentId)
    ].filter(
      (parentId, index, parentIds) => parentIds.indexOf(parentId) === index
    )

    for (const parentId of affectedParentIds) {
      const parent = sceneTree.getElementById(parentId)
      if (!parent && parentId !== targetParentId) {
        continue
      }
      const parentData = parent?.save() as
        | (ElementRawData & { children?: unknown })
        | undefined
      const children = parentData?.children
      if (!parent || !Array.isArray(children)) {
        return this.projectionOutcome(elementId, 'failed')
      }
      canonicalParents.set(parentId, [...children])
    }

    const mirrorsMatchBefore = moves.every((move) => {
      if (
        !this.computedDataMirror.matchesElementParent(
          move.elementId,
          move.before.parentId
        )
      ) {
        return false
      }
      const source = sceneTree.getElementById(move.before.parentId)
      return (
        source?.get('type') === EntityTypes.WORKSPACE ||
        this.computedDataMirror.matchesParentChild(
          move.before.parentId,
          move.elementId,
          move.before.index
        )
      )
    })
    const mirrorsMatchAfter = moves.every((move) =>
      this.computedDataMirror.matchesElementParent(
        move.elementId,
        move.after.parentId
      )
    )
    const canonicalMatchesAfter = moves.every(
      (move) =>
        sceneTree.getElementById(move.elementId)?.get('parentId') ===
          move.after.parentId &&
        canonicalParents.get(move.after.parentId)?.includes(move.elementId) ===
          true
    )
    if ((!mirrorsMatchBefore && !mirrorsMatchAfter) || !canonicalMatchesAfter) {
      return this.projectionOutcome(elementId, 'failed')
    }

    const affectedElementIds = new Set(moves.map((move) => move.elementId))
    affectedParentIds.forEach((parentId) => {
      const parent = sceneTree.getElementById(parentId)
      if (parent && parent.get('type') !== EntityTypes.WORKSPACE) {
        affectedElementIds.add(parentId)
      }
    })

    try {
      affectedElementIds.forEach((affectedElementId) => {
        if (!this.computedDataMirror.seed(affectedElementId, 'hierarchy')) {
          throw new Error(
            `Render hierarchy snapshot is missing for ${affectedElementId}`
          )
        }
      })
      canonicalParents.forEach((childIds, parentId) => {
        render.projectHierarchy(parentId, childIds)
      })
      return this.projectionOutcome(elementId, 'applied')
    } catch {
      return this.projectionOutcome(elementId, 'failed')
    }
  }

  applySubtreeChange(change: SubtreeChange): RenderProjectionOutcome {
    if (!Array.isArray(change.removed) || change.removed.length === 0) {
      return this.projectionOutcome(change.elementId, 'failed')
    }

    if (change.action === SCENE_TREE_ACTIONS.REMOVE_SUBTREE) {
      let failed = false
      change.removed.forEach(({ data, parentId, index }) => {
        failed ||= this.removeElement(data, parentId, index).status === 'failed'
      })
      return this.projectionOutcome(
        change.elementId,
        failed ? 'failed' : 'removed'
      )
    }

    if (change.action === SCENE_TREE_ACTIONS.RESTORE_SUBTREE) {
      const rootEntry = change.removed.find(
        ({ elementId }) => elementId === change.elementId
      )
      if (!rootEntry) {
        return this.projectionOutcome(change.elementId, 'failed')
      }
      const externalParent = sceneTree.getElementById(rootEntry.parentId)
      if (
        externalParent &&
        externalParent.get('type') !== EntityTypes.WORKSPACE &&
        !this.computedDataMirror.seed(rootEntry.parentId, 'hierarchy')
      ) {
        return this.projectionOutcome(change.elementId, 'failed')
      }

      try {
        for (const { elementId, index } of [...change.removed].reverse()) {
          const entry = this.computedDataMirror.seed(elementId, 'hierarchy')
          if (!entry) {
            throw new Error(
              `Render subtree snapshot is missing for ${elementId}`
            )
          }
          this.addElement(entry.renderDataSnapshot, index)
        }
        return this.projectionOutcome(change.elementId, 'applied')
      } catch {
        return this.projectionOutcome(change.elementId, 'failed')
      }
    }

    return this.projectionOutcome(change.elementId, 'failed')
  }

  private synchronizeParentMembership(
    parentId: string | undefined,
    childId: string,
    index: number | undefined,
    action: ChildMembershipAction
  ): RenderProjectionOutcome | null {
    if (!parentId) {
      return null
    }
    const parent = sceneTree.getElementById(parentId)
    if (!parent || parent.get('type') === EntityTypes.WORKSPACE) {
      return null
    }

    if (
      action === 'add' &&
      index !== undefined &&
      this.computedDataMirror.matchesElementParent(childId, parentId) &&
      this.computedDataMirror.matchesParentChild(parentId, childId, index)
    ) {
      emitDiagnosticCounter('computed-mirror-add-parent-already-synchronized')
      return this.projectionOutcome(parentId, 'applied')
    }

    const applyResult = this.computedDataMirror.applyChildMembershipChange(
      parentId,
      childId,
      index,
      action
    )
    if (!applyResult) {
      return this.resyncElement(parentId)
    }

    this.recordDirtyChange(
      parentId,
      1,
      this.pendingElementUpdates.has(parentId)
    )
    this.pendingElementUpdates.add(parentId)
    this.scheduleFlush()
    return this.projectionOutcome(parentId, 'applied')
  }

  private synchronizeParentMembershipBatch(
    parentId: string,
    additions: readonly AddRemoveElementEntry[]
  ): RenderProjectionOutcome | null {
    const parent = sceneTree.getElementById(parentId)
    if (!parent) {
      return this.projectionOutcome(parentId, 'failed')
    }
    if (parent.get('type') === EntityTypes.WORKSPACE) {
      return null
    }

    const alreadySynchronized = additions.every(
      ({ data, index }) =>
        this.computedDataMirror.matchesElementParent(data.id, parentId) &&
        this.computedDataMirror.matchesParentChild(parentId, data.id, index)
    )
    if (alreadySynchronized) {
      emitDiagnosticCounter(
        'computed-mirror-add-parent-already-synchronized',
        additions.length
      )
      return this.projectionOutcome(parentId, 'applied')
    }
    if (
      additions.some(
        ({ data }) =>
          !this.computedDataMirror.matchesElementParent(data.id, parentId)
      )
    ) {
      return this.projectionOutcome(parentId, 'failed')
    }

    const applyResult = this.computedDataMirror.applyChildAdditionBatch(
      parentId,
      additions
    )
    if (!applyResult) {
      return this.projectionOutcome(parentId, 'failed')
    }
    return this.projectionOutcome(parentId, 'applied')
  }

  private synchronizeParentRemovalBatch(
    parentId: string,
    removals: readonly AddRemoveElementEntry[]
  ): RenderProjectionOutcome | null {
    const parent = sceneTree.getElementById(parentId)
    if (!parent) {
      return this.projectionOutcome(parentId, 'failed')
    }
    if (parent.get('type') === EntityTypes.WORKSPACE) {
      return null
    }

    const applyResult = this.computedDataMirror.applyChildRemovalBatch(
      parentId,
      removals
    )
    if (!applyResult) {
      return this.projectionOutcome(parentId, 'failed')
    }

    this.recordDirtyChange(
      parentId,
      removals.length,
      this.pendingElementUpdates.has(parentId)
    )
    this.pendingElementUpdates.add(parentId)
    this.scheduleFlush()
    return this.projectionOutcome(parentId, 'applied')
  }

  private compensateParentRemovalBatch(
    parentId: string,
    removals: readonly AddRemoveElementEntry[]
  ): boolean {
    const applyResult = this.computedDataMirror.applyChildAdditionBatch(
      parentId,
      removals
    )
    if (!applyResult) {
      emitDiagnosticCounter(
        'computed-mirror-child-remove-batch-compensation-failed'
      )
      return false
    }

    emitDiagnosticCounter('computed-mirror-child-remove-batch-compensated')
    this.recordDirtyChange(
      parentId,
      removals.length,
      this.pendingElementUpdates.has(parentId)
    )
    this.pendingElementUpdates.add(parentId)
    this.scheduleFlush()
    return true
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

    if (this.isDirectRenderProperty(elementId, key)) {
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
      ({ key }) => !this.isDirectRenderProperty(elementId, key)
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
        this.isDirectRenderProperty(elementId, key)
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
        emitDiagnosticCounter(`computed-mirror-undoable-refresh-key-${key}`)
      })
    }

    const didStage = measureBrowserDragPhase(
      'render-scene-tree:apply-computed-patch',
      () => this.computedDataMirror.applyComputedPatch(elementId, patch)
    )
    if (!didStage) {
      return this.resyncElement(elementId)
    }

    const directValueChanges = Object.entries(patch.values ?? {}).filter(
      ([key]) => this.isDirectRenderProperty(elementId, key)
    )
    const hasComputedFullUpdate =
      Object.keys(patch.records ?? {}).length > 0 ||
      Object.keys(patch.values ?? {}).some(
        (key) => !this.isDirectRenderProperty(elementId, key)
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
    emitDiagnosticCounter('dirty-change-count', changeCount)
    if (didCoalesce) {
      emitDiagnosticCounter('dirty-change-coalesced-count', changeCount)
    }
    if (!this.pendingElementUpdates.has(elementId)) {
      emitDiagnosticCounter('dirty-element-count')
    }
  }

  private scheduleFlush() {
    if (!this.hasPendingChanges()) {
      return
    }

    if (this.pendingFlush) {
      emitDiagnosticCounter('render-scene-tree-flush-coalesced')
      return
    }

    this.pendingFlush = true
    if (this.frameAlignedFlush) {
      emitDiagnosticCounter('render-scene-tree-frame-aligned-flush')
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
    emitDiagnosticCounter(
      'computed-mirror-reset-entry-count',
      clearedEntryCount
    )
  }

  clearProjection() {
    const projectedElementIds = new Set([
      ...this.projectedElementIds,
      ...this.computedDataMirror.elementIds
    ])
    this.pendingElementUpdates.clear()
    this.pendingFrameFlush = false
    this.pendingFlush = false
    let releasedEntryCount = 0
    let firstFailure: unknown
    projectedElementIds.forEach((elementId) => {
      try {
        this.releaseProjectedElement(elementId)
        this.computedDataMirror.delete(elementId)
        releasedEntryCount += 1
      } catch (error) {
        firstFailure ??= error
      }
    })
    try {
      render.switchWorkspace({ label: '', x: 0, y: 0 })
    } catch (error) {
      firstFailure ??= error
    }
    emitDiagnosticCounter(
      'computed-mirror-reset-entry-count',
      releasedEntryCount
    )
    if (firstFailure !== undefined) {
      throw firstFailure
    }
  }

  private flushPendingChanges() {
    if (this.flushingPendingChanges) {
      emitDiagnosticCounter('render-scene-tree-flush-reentrant-skipped')
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
      emitDiagnosticCounter('render-scene-tree-flush-reentrant-skipped')
      return false
    }

    if (!this.pendingFrameFlush && this.pendingElementUpdates.size === 0) {
      this.pendingFlush = false
      return false
    }

    return measureBrowserDragPhase('render-scene-tree:flush', () => {
      this.flushingPendingChanges = true
      const hadPendingFrameFlush = this.pendingFrameFlush
      try {
        this.pendingFlush = false
        emitDiagnosticCounter('computed-mirror-commit-count')
        this.pendingFrameFlush = false
        const ids = Array.from(this.pendingElementUpdates)
        emitDiagnosticCounter('product-render-per-render-frame', ids.length)
        ids.forEach((id) => {
          this.pendingElementUpdates.delete(id)
          const data = this._getRenderData(id)
          if (data) {
            try {
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
            } catch (error) {
              this.pendingElementUpdates.add(id)
              throw error
            }
          }
        })
        return true
      } catch (error) {
        this.pendingFrameFlush ||= hadPendingFrameFlush
        throw error
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
      activeRenderSceneTree?.clearProjection()
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
