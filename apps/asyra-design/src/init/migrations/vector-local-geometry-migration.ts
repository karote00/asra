import type { CoreRawData } from '@asyra/utils'
import {
  DOCUMENT_VERSION,
  LEGACY_WORKSPACE_VECTOR_VERSION
} from '../../config/document-version'

interface LoadHookRegistrar {
  registerLoadHook(hook: (rawDocument: unknown) => unknown): void
}

type UnknownRecord = Record<string, unknown>

interface RawVectorDocument extends UnknownRecord {
  version: string
  sceneTree: UnknownRecord & {
    elements: UnknownRecord
  }
  props: UnknownRecord
}

const installedRegistrars = new WeakSet<object>()

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const requireRecord = (value: unknown, path: string): UnknownRecord => {
  if (!isRecord(value)) {
    throw new Error(
      `[Vector local geometry migration] ${path} must be a record`
    )
  }
  return value
}

const requireString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `[Vector local geometry migration] ${path} must be a non-empty string`
    )
  }
  return value
}

const requireFiniteNumber = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `[Vector local geometry migration] ${path} must be a finite number`
    )
  }
  return value
}

const requireLegacyDocument = (rawDocument: unknown): RawVectorDocument => {
  const document = requireRecord(rawDocument, 'document')
  if (document.version !== LEGACY_WORKSPACE_VECTOR_VERSION) {
    throw new Error(
      `[Vector local geometry migration] expected document version ${LEGACY_WORKSPACE_VECTOR_VERSION}`
    )
  }
  const sceneTree = requireRecord(document.sceneTree, 'sceneTree')
  const elements = requireRecord(sceneTree.elements, 'sceneTree.elements')
  const props = requireRecord(document.props, 'props')

  return {
    ...document,
    version: LEGACY_WORKSPACE_VECTOR_VERSION,
    sceneTree: {
      ...sceneTree,
      elements
    },
    props
  }
}

const getElementPosition = (
  elementId: string,
  element: UnknownRecord,
  props: UnknownRecord
): { x: number; y: number } => {
  const propertyRefs = requireRecord(
    element.props,
    `sceneTree.elements.${elementId}.props`
  )
  const positionId = requireString(
    propertyRefs.position,
    `sceneTree.elements.${elementId}.props.position`
  )
  const position = requireRecord(props[positionId], `props.${positionId}`)

  return {
    x: requireFiniteNumber(position.x, `props.${positionId}.x`),
    y: requireFiniteNumber(position.y, `props.${positionId}.y`)
  }
}

const getLegacyVectorPointOffset = (
  elementId: string,
  vector: UnknownRecord,
  elements: UnknownRecord,
  props: UnknownRecord
): { x: number; y: number } => {
  const position = getElementPosition(elementId, vector, props)
  let x = position.x
  let y = position.y
  let parentId =
    typeof vector.parentId === 'string' ? vector.parentId : undefined
  const visited = new Set([elementId])

  while (parentId) {
    if (visited.has(parentId)) {
      throw new Error(
        `[Vector local geometry migration] hierarchy cycle at ${parentId}`
      )
    }
    visited.add(parentId)
    const parent = requireRecord(
      elements[parentId],
      `sceneTree.elements.${parentId}`
    )
    if (parent.type !== 'group') {
      break
    }
    const parentPosition = getElementPosition(parentId, parent, props)
    x += parentPosition.x
    y += parentPosition.y
    parentId = typeof parent.parentId === 'string' ? parent.parentId : undefined
  }

  return { x, y }
}

export const migrateWorkspaceVectorGeometryToLocal = (
  rawDocument: unknown
): CoreRawData => {
  const document = requireLegacyDocument(rawDocument)
  const elements = document.sceneTree.elements
  const props = document.props
  const updatedProps: UnknownRecord = {}
  const convertedPointOwners = new Map<
    string,
    { elementId: string; x: number; y: number }
  >()

  Object.entries(elements).forEach(([elementId, rawElement]) => {
    const element = requireRecord(rawElement, `sceneTree.elements.${elementId}`)
    if (element.type !== 'vector') {
      return
    }

    const propertyRefs = requireRecord(
      element.props,
      `sceneTree.elements.${elementId}.props`
    )
    const pointSpaceId = requireString(
      propertyRefs.pointCoordinateSpace,
      `sceneTree.elements.${elementId}.props.pointCoordinateSpace`
    )
    const pointSpace = requireRecord(
      props[pointSpaceId],
      `props.${pointSpaceId}`
    )
    if (pointSpace.pointCoordinateSpace !== 'workspace') {
      throw new Error(
        `[Vector local geometry migration] props.${pointSpaceId}.pointCoordinateSpace must be workspace`
      )
    }

    const pointsId = requireString(
      propertyRefs.points,
      `sceneTree.elements.${elementId}.props.points`
    )
    const pointsComponent = requireRecord(props[pointsId], `props.${pointsId}`)
    if (!Array.isArray(pointsComponent.points)) {
      throw new Error(
        `[Vector local geometry migration] props.${pointsId}.points must be an array`
      )
    }

    const offset = getLegacyVectorPointOffset(
      elementId,
      element,
      elements,
      props
    )
    pointsComponent.points.forEach((rawPointId, pointIndex) => {
      const pointId = requireString(
        rawPointId,
        `props.${pointsId}.points.${pointIndex}`
      )
      const existingOwner = convertedPointOwners.get(pointId)
      if (
        existingOwner &&
        (existingOwner.elementId !== elementId ||
          existingOwner.x !== offset.x ||
          existingOwner.y !== offset.y)
      ) {
        throw new Error(
          `[Vector local geometry migration] point ${pointId} has multiple Vector owners`
        )
      }
      if (existingOwner) {
        return
      }
      const point = requireRecord(props[pointId], `props.${pointId}`)
      const pointX = requireFiniteNumber(point.x, `props.${pointId}.x`)
      const pointY = requireFiniteNumber(point.y, `props.${pointId}.y`)
      convertedPointOwners.set(pointId, {
        elementId,
        x: offset.x,
        y: offset.y
      })
      updatedProps[pointId] = {
        ...point,
        x: pointX - offset.x,
        y: pointY - offset.y
      }
    })
    updatedProps[pointSpaceId] = {
      ...pointSpace,
      pointCoordinateSpace: 'local'
    }
  })

  return {
    ...(document as unknown as CoreRawData),
    version: DOCUMENT_VERSION,
    props: {
      ...(props as CoreRawData['props']),
      ...(updatedProps as CoreRawData['props'])
    }
  }
}

export const installVectorLocalGeometryMigration = (
  registrar: LoadHookRegistrar
): void => {
  if (installedRegistrars.has(registrar)) {
    return
  }

  registrar.registerLoadHook((rawDocument) => {
    const document = requireRecord(rawDocument, 'document')
    if (document.version === DOCUMENT_VERSION) {
      return rawDocument
    }
    if (document.version !== LEGACY_WORKSPACE_VECTOR_VERSION) {
      return rawDocument
    }
    return migrateWorkspaceVectorGeometryToLocal(rawDocument)
  })
  installedRegistrars.add(registrar)
}
