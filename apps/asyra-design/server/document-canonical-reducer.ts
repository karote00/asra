import type { CanonicalChange } from '@asyra/core'
import type {
  CoreRawData,
  ElementRawData,
  GroupRawData,
  PropertyComponentRawData
} from '@asyra/utils'

const fail = (message: string): never => {
  throw new Error(`[document-canonical-reducer] ${message}`)
}

const cloneJson = <Value>(value: Value): Value =>
  JSON.parse(JSON.stringify(value)) as Value

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

const createWorkingDocument = (document: CoreRawData): CoreRawData => ({
  ...document,
  sceneTree: {
    ...document.sceneTree,
    workspaceList: [...document.sceneTree.workspaceList],
    elements: { ...document.sceneTree.elements }
  },
  props: { ...document.props },
  ...(document.systemContext === undefined
    ? {}
    : { systemContext: { ...document.systemContext } })
})

const getElement = (
  document: CoreRawData,
  elementId: string
): ElementRawData | GroupRawData => {
  const element = document.sceneTree.elements[elementId]
  if (!element) fail(`element "${elementId}" is missing`)
  return element
}

const getContainerChildren = (
  document: CoreRawData,
  parentId: string
): readonly string[] => {
  const parent = getElement(document, parentId) as GroupRawData
  if (!Array.isArray(parent.children)) {
    fail(`parent "${parentId}" is not a container`)
  }
  return parent.children
}

const setContainerChildren = (
  document: CoreRawData,
  parentId: string,
  children: readonly string[]
): void => {
  const parent = getElement(document, parentId) as GroupRawData
  document.sceneTree.elements[parentId] = {
    ...parent,
    children: [...children]
  }
}

const collectPropertyReferences = (
  value: unknown,
  knownPropertyIds: ReadonlySet<string>,
  references: Set<string>
): void => {
  if (typeof value === 'string') {
    if (knownPropertyIds.has(value)) references.add(value)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) =>
      collectPropertyReferences(item, knownPropertyIds, references)
    )
    return
  }
  if (typeof value !== 'object' || value === null) return
  Object.entries(value).forEach(([key, item]) => {
    if (key === 'id' || key === 'type') return
    collectPropertyReferences(item, knownPropertyIds, references)
  })
}

const removeOwnedProperties = (
  document: CoreRawData,
  elements: readonly (ElementRawData | GroupRawData)[]
): void => {
  const knownPropertyIds = new Set(Object.keys(document.props))
  const pending = elements.flatMap((element) =>
    Object.values(element.props ?? {})
  )
  const removed = new Set<string>()
  while (pending.length > 0) {
    const propertyId = pending.shift()
    if (!propertyId || removed.has(propertyId)) continue
    const component = document.props[propertyId]
    if (!component) continue
    removed.add(propertyId)
    const references = new Set<string>()
    collectPropertyReferences(component, knownPropertyIds, references)
    pending.push(...references)
  }
  removed.forEach((propertyId) => {
    Reflect.deleteProperty(document.props, propertyId)
  })
}

const applyPropertyComponents = (
  document: CoreRawData,
  change: Extract<CanonicalChange, { kind: 'property-components' }>
): void => {
  for (const record of change.records ?? []) {
    const component = document.props[record.propertyId]
    if (!component) fail(`property "${record.propertyId}" is missing`)
    const currentChildIds = (
      component as unknown as Readonly<Record<string, unknown>>
    )[record.key]
    if (
      !Array.isArray(currentChildIds) ||
      currentChildIds.some(
        (childId) => typeof childId !== 'string' || childId.length === 0
      ) ||
      new Set(currentChildIds).size !== currentChildIds.length
    ) {
      fail(`property "${record.propertyId}" record "${record.key}" is invalid`)
    }
    const existingChildIds = currentChildIds as string[]
    const setEntries = Object.entries(record.set ?? {})
    const removeIds = [...(record.remove ?? [])]
    const removeIdSet = new Set(removeIds)
    if (
      removeIds.some(
        (childId) => typeof childId !== 'string' || childId.length === 0
      ) ||
      removeIdSet.size !== removeIds.length ||
      removeIds.some((childId) => !existingChildIds.includes(childId)) ||
      setEntries.some(
        ([childId, values]) =>
          childId.length === 0 ||
          typeof values !== 'object' ||
          values === null ||
          Array.isArray(values) ||
          removeIdSet.has(childId)
      )
    ) {
      fail(
        `property "${record.propertyId}" record "${record.key}" has invalid operations`
      )
    }
    const nextChildIds = existingChildIds.filter(
      (childId) => !removeIdSet.has(childId)
    )
    const nextChildIdSet = new Set(nextChildIds)
    for (const [childId, values] of setEntries) {
      const detachedValues = cloneJson(values)
      if (detachedValues.id !== undefined && detachedValues.id !== childId) {
        fail(`property record "${childId}" has a mismatched id`)
      }
      const existingChild = document.props[childId]
      const nextType = detachedValues.type ?? existingChild?.type
      if (typeof nextType !== 'string' || nextType.length === 0) {
        fail(`property record "${childId}" has an invalid type`)
      }
      if (
        existingChild &&
        detachedValues.type !== undefined &&
        detachedValues.type !== existingChild.type
      ) {
        fail(`property record "${childId}" changes its type`)
      }
      document.props[childId] = {
        ...(existingChild ?? {}),
        ...detachedValues,
        id: childId,
        type: nextType
      } as PropertyComponentRawData
      if (!nextChildIdSet.has(childId)) {
        nextChildIds.push(childId)
        nextChildIdSet.add(childId)
      }
    }
    removeIds.forEach((childId) => {
      Reflect.deleteProperty(document.props, childId)
    })
    document.props[record.propertyId] = {
      ...component,
      [record.key]: nextChildIds
    } as PropertyComponentRawData
  }
  for (const update of change.updates) {
    const component = document.props[update.propertyId]
    if (!component) fail(`property "${update.propertyId}" is missing`)
    document.props[update.propertyId] = {
      ...component,
      ...cloneJson(update.values)
    } as PropertyComponentRawData
  }
}

const applyElementData = (
  document: CoreRawData,
  change: Extract<CanonicalChange, { kind: 'element-data' }>
): void => {
  for (const entry of change.changes) {
    const element = getElement(document, entry.id)
    const next = { ...element }
    for (const field of entry.changes) {
      if (next[field.key] !== field.before) {
        fail(`element "${entry.id}" data evidence is stale`)
      }
      Object.assign(next, { [field.key]: field.after })
    }
    document.sceneTree.elements[entry.id] = next
  }
}

const applyHierarchyMoves = (
  document: CoreRawData,
  change: Extract<CanonicalChange, { kind: 'hierarchy-moves' }>
): void => {
  const movingIds = new Set(change.moves.map(({ elementId }) => elementId))
  if (movingIds.size !== change.moves.length) {
    fail('hierarchy moves contain duplicate elements')
  }
  const beforeParents = new Map<string, readonly string[]>()
  for (const move of change.moves) {
    getElement(document, move.elementId)
    const children =
      beforeParents.get(move.before.parentId) ??
      getContainerChildren(document, move.before.parentId)
    beforeParents.set(move.before.parentId, children)
    if (children[move.before.index] !== move.elementId) {
      fail(`hierarchy move evidence for "${move.elementId}" is stale`)
    }
  }

  const nextChildren = new Map<string, string[]>()
  for (const [parentId, children] of beforeParents) {
    nextChildren.set(
      parentId,
      children.filter((elementId) => !movingIds.has(elementId))
    )
  }
  const afterParents = new Set(
    change.moves.map(({ after: { parentId } }) => parentId)
  )
  for (const parentId of afterParents) {
    if (!nextChildren.has(parentId)) {
      nextChildren.set(parentId, [...getContainerChildren(document, parentId)])
    }
    const parentMoves = change.moves
      .filter(({ after }) => after.parentId === parentId)
      .sort((left, right) => left.after.index - right.after.index)
    const children =
      nextChildren.get(parentId) ??
      fail(`hierarchy parent "${parentId}" is missing`)
    for (const move of parentMoves) {
      if (move.after.index < 0 || move.after.index > children.length) {
        fail(`hierarchy target for "${move.elementId}" is invalid`)
      }
      children.splice(move.after.index, 0, move.elementId)
    }
  }
  nextChildren.forEach((children, parentId) =>
    setContainerChildren(document, parentId, children)
  )
  for (const move of change.moves) {
    document.sceneTree.elements[move.elementId] = {
      ...getElement(document, move.elementId),
      parentId: move.after.parentId
    }
  }
}

const applySubtreeRemoval = (
  document: CoreRawData,
  change: Extract<CanonicalChange, { kind: 'subtree-removal' }>
): void => {
  const { removed, elementId, rootParentChildrenAfter } = change.change
  const root =
    removed.find((entry) => entry.elementId === elementId) ??
    fail(`subtree root "${elementId}" is missing`)
  for (const entry of removed) {
    const current = getElement(document, entry.elementId)
    if (!sameJson(current, entry.data)) {
      fail(`subtree evidence for "${entry.elementId}" is stale`)
    }
  }
  const expectedRootParentChildren = getContainerChildren(
    document,
    root.parentId
  ).filter((id) => id !== elementId)
  if (!sameJson(expectedRootParentChildren, rootParentChildrenAfter)) {
    fail(`subtree root parent evidence for "${elementId}" is stale`)
  }
  removeOwnedProperties(
    document,
    removed.map(({ data }) => data)
  )
  removed.forEach(({ elementId: removedId }) => {
    Reflect.deleteProperty(document.sceneTree.elements, removedId)
  })
  setContainerChildren(document, root.parentId, rootParentChildrenAfter)
}

const applySubtreeRestore = (
  document: CoreRawData,
  change: Extract<CanonicalChange, { kind: 'subtree-restore' }>
): void => {
  const { removed, elementId, rootParentChildrenAfter } = change.sceneSnapshot
  const root =
    removed.find((entry) => entry.elementId === elementId) ??
    fail(`subtree restore root "${elementId}" is missing`)
  for (const component of change.propsSnapshot.components) {
    if (document.props[component.id]) {
      fail(`restored property "${component.id}" already exists`)
    }
    document.props[component.id] = cloneJson(component)
  }
  for (const entry of removed) {
    if (document.sceneTree.elements[entry.elementId]) {
      fail(`restored element "${entry.elementId}" already exists`)
    }
    document.sceneTree.elements[entry.elementId] = cloneJson(entry.data)
  }
  const rootParentChildren = [...rootParentChildrenAfter]
  rootParentChildren.splice(root.index, 0, elementId)
  setContainerChildren(document, root.parentId, rootParentChildren)
}

const applyElementCreation = (
  document: CoreRawData,
  change: Extract<CanonicalChange, { kind: 'element-creation' }>
): void => {
  const parentChildren = [...getContainerChildren(document, change.parentId)]
  if (change.index < 0 || change.index > parentChildren.length) {
    fail('element creation index is invalid')
  }
  const elementIds = new Set<string>()
  for (const element of change.elements) {
    if (elementIds.has(element.id) || document.sceneTree.elements[element.id]) {
      fail(`created element "${element.id}" already exists`)
    }
    elementIds.add(element.id)
  }
  for (const component of change.properties) {
    if (document.props[component.id]) {
      fail(`created property "${component.id}" already exists`)
    }
    document.props[component.id] = cloneJson(component)
  }
  for (const element of change.elements) {
    document.sceneTree.elements[element.id] = cloneJson(element)
  }
  parentChildren.splice(change.index, 0, ...elementIds)
  setContainerChildren(document, change.parentId, parentChildren)
}

const applyElementRemoval = (
  document: CoreRawData,
  change: Extract<CanonicalChange, { kind: 'element-removal' }>
): void => {
  const removalIds = new Set<string>()
  const parentChildren = new Map<string, readonly string[]>()
  for (const removal of change.removals) {
    const elementId = removal.data.id
    if (removalIds.has(elementId)) {
      fail(`element removal "${elementId}" is duplicated`)
    }
    removalIds.add(elementId)
    const current = getElement(document, elementId)
    if (!sameJson(current, removal.data)) {
      fail(`element removal evidence for "${elementId}" is stale`)
    }
    const children =
      parentChildren.get(removal.parentId) ??
      getContainerChildren(document, removal.parentId)
    parentChildren.set(removal.parentId, children)
    if (children[removal.index] !== elementId) {
      fail(`element removal location for "${elementId}" is stale`)
    }
  }
  removeOwnedProperties(
    document,
    change.removals.map(({ data }) => data)
  )
  change.removals.forEach(({ data }) => {
    Reflect.deleteProperty(document.sceneTree.elements, data.id)
  })
  parentChildren.forEach((children, parentId) => {
    setContainerChildren(
      document,
      parentId,
      children.filter((id) => !removalIds.has(id))
    )
  })
}

export const applyCanonicalChangesToDocument = (
  document: CoreRawData,
  changes: readonly CanonicalChange[]
): CoreRawData => {
  const working = createWorkingDocument(document)
  for (const change of changes) {
    switch (change.kind) {
      case 'property-components':
        applyPropertyComponents(working, change)
        break
      case 'element-data':
        applyElementData(working, change)
        break
      case 'hierarchy-moves':
        applyHierarchyMoves(working, change)
        break
      case 'subtree-removal':
        applySubtreeRemoval(working, change)
        break
      case 'subtree-restore':
        applySubtreeRestore(working, change)
        break
      case 'element-creation':
        applyElementCreation(working, change)
        break
      case 'element-removal':
        applyElementRemoval(working, change)
        break
    }
  }
  return working
}
