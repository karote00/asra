import {
  defineCanonicalOperationApply,
  type CollaborationOperationDefinition
} from '@asyra/collaboration'
import { EventTypes, type AllEvent } from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  isRecord
} from '@asyra/utils'
import { isNonBlankString } from './wire-values'

type ProcessOperation = (event: AllEvent) => boolean | undefined

const owns = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

const isTypedData = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && isNonBlankString(value.id) && isNonBlankString(value.type)

const isAddRemoveElement = (
  value: unknown,
  action: SCENE_TREE_ACTIONS,
  eventName: string
): value is Record<string, unknown> =>
  isRecord(value) &&
  value.action === action &&
  value.eventName === eventName &&
  isTypedData(value.data) &&
  (value.parentId === undefined || isNonBlankString(value.parentId)) &&
  (value.index === undefined ||
    (Number.isInteger(value.index) && Number(value.index) >= 0))

const isScalarComputedChange = (
  value: unknown
): value is Record<string, unknown> =>
  isRecord(value) &&
  value.action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA &&
  value.eventName === EventTypes.UPDATE_COMPUTED_DATA &&
  isNonBlankString(value.id) &&
  (value.owner === 'raw' || value.owner === 'computed') &&
  isNonBlankString(value.key) &&
  owns(value, 'before') &&
  owns(value, 'after')

const isBatchComputedChange = (
  value: unknown
): value is Record<string, unknown> =>
  isRecord(value) &&
  value.action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH &&
  value.eventName === EventTypes.UPDATE_COMPUTED_DATA &&
  isNonBlankString(value.id) &&
  Array.isArray(value.changes) &&
  value.changes.length > 0 &&
  value.changes.every(
    (change) =>
      isRecord(change) &&
      (change.owner === 'raw' || change.owner === 'computed') &&
      isNonBlankString(change.key) &&
      owns(change, 'before') &&
      owns(change, 'after')
  )

const isComputedPatch = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) &&
  value.action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH &&
  value.eventName === EventTypes.UPDATE_COMPUTED_DATA_PATCH &&
  isNonBlankString(value.id) &&
  isRecord(value.patch) &&
  (isRecord(value.patch.values) || isRecord(value.patch.records))

const isAddRemoveProperties = (
  value: unknown,
  action: PROPS_ACTIONS,
  eventName: string
): value is Record<string, unknown> =>
  isRecord(value) &&
  value.action === action &&
  value.eventName === eventName &&
  Array.isArray(value.data) &&
  value.data.length > 0 &&
  value.data.every(isTypedData)

const isUpdateProperty = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) &&
  value.action === PROPS_ACTIONS.UPDATE_PROPERTY &&
  value.eventName === EventTypes.UPDATE_PROPERTY &&
  isNonBlankString(value.id) &&
  isNonBlankString(value.key) &&
  owns(value, 'before') &&
  owns(value, 'after') &&
  (value.ownerElementId === undefined ||
    isNonBlankString(value.ownerElementId)) &&
  (value.ownerPropertyName === undefined ||
    isNonBlankString(value.ownerPropertyName))

const definition = (
  channel: string,
  eventName: AllEvent['type'],
  validate: (payload: unknown) => payload is Record<string, unknown>,
  process: ProcessOperation
): CollaborationOperationDefinition<Record<string, unknown>> => ({
  channel,
  eventName,
  schemaVersion: 1,
  validate,
  apply: defineCanonicalOperationApply(({ payload }) =>
    process({ type: eventName, payload } as AllEvent)
  )
})

export const createAsyraDesignOperationDefinitions = (
  process: ProcessOperation
): readonly CollaborationOperationDefinition[] =>
  Object.freeze([
    definition(
      SharedDataChannelNames.SCENE_TREE,
      EventTypes.ADD_ELEMENT,
      (payload): payload is Record<string, unknown> =>
        isAddRemoveElement(
          payload,
          SCENE_TREE_ACTIONS.ADD_ELEMENT,
          EventTypes.ADD_ELEMENT
        ),
      process
    ),
    definition(
      SharedDataChannelNames.SCENE_TREE,
      EventTypes.REMOVE_ELEMENT,
      (payload): payload is Record<string, unknown> =>
        isAddRemoveElement(
          payload,
          SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
          EventTypes.REMOVE_ELEMENT
        ),
      process
    ),
    definition(
      SharedDataChannelNames.SCENE_TREE,
      EventTypes.UPDATE_COMPUTED_DATA,
      (payload): payload is Record<string, unknown> =>
        isScalarComputedChange(payload) || isBatchComputedChange(payload),
      process
    ),
    definition(
      SharedDataChannelNames.SCENE_TREE,
      EventTypes.UPDATE_COMPUTED_DATA_PATCH,
      isComputedPatch,
      process
    ),
    definition(
      SharedDataChannelNames.PROPS,
      EventTypes.ADD_PROPERTY,
      (payload): payload is Record<string, unknown> =>
        isAddRemoveProperties(
          payload,
          PROPS_ACTIONS.ADD_PROPERTY,
          EventTypes.ADD_PROPERTY
        ),
      process
    ),
    definition(
      SharedDataChannelNames.PROPS,
      EventTypes.REMOVE_PROPERTY,
      (payload): payload is Record<string, unknown> =>
        isAddRemoveProperties(
          payload,
          PROPS_ACTIONS.REMOVE_PROPERTY,
          EventTypes.REMOVE_PROPERTY
        ),
      process
    ),
    definition(
      SharedDataChannelNames.PROPS,
      EventTypes.UPDATE_PROPERTY,
      isUpdateProperty,
      process
    )
  ])
