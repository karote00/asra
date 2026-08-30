import {
  IDTypes,
  PropertyType,
  PROPS_ACTIONS,
  SharedDataChannelNames,
  beginBrowserDragPhase,
  measureBrowserDragPhase,
  id,
  isRecord
} from '@asyra/utils'
import type {
  EVENT_OPTIONS,
  LoadDiagnostic,
  UpdatePropertyChange,
  PropertyComponentInstanceTypes,
  PropertyComponentRawData,
  AddRemovePropertyChange,
  PreparedPropsRestore,
  PropsRestoreSnapshot,
  PropsRestoreStrategy,
  ElementPropertyRelation,
  PropsChange,
  PropsComponentRawData,
  EvnetOptions,
  PropertySchema,
  PropertyFieldSchema
} from '@asyra/utils'
import {
  acknowledgeTransactionReplayApplied,
  EventTypes,
  getTransactionReplayMode,
  TransactionEventTypes,
  updateTransaction,
  updateTransactionBatch,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import * as lodashModule from 'lodash'
import {
  createProperty,
  createPropertyWithConstructor
} from '../factories/create-property.js'
import type { PropertyComponentConstructor } from '../components/index.js'
import {
  arePropertyChildRelationsEqual,
  getPropertyComponent,
  getPropertyComponentBatchRebindableRelation,
  getPropertyComponentCanonicalChildRelation,
  getPropertyComponentConfigDefinition,
  getPropertyComponentRegistrationRevision,
  isPropertyComponentBatchRebindable,
  resolvePropertyComponentConfigRoles,
  type PropertyChildRelationDefinition
} from '../registries/property-component.js'
import { clonePropertyDefinitionValue } from '../registries/property-definition-value.js'
import elementPropertyRegistry, {
  type PropertyDefinition
} from '../registries/property-definition.js'
import { matchesPropertyValueKind } from '../registries/property-value-kind.js'
import {
  getPropertySchemaRegistrationRevision,
  getRegisteredPropertySchema,
  runWithPropertySchemaResolver
} from '../registries/property-schema.js'
import {
  runWithPropertyComponentAccessor,
  setComponentAccessor,
  type PropertyComponentAccessor
} from './component-accessor.js'

const lodash =
  (
    lodashModule as unknown as {
      readonly default?: typeof lodashModule
    }
  ).default ?? lodashModule
const { isEqual } = lodash

export type PropsLoadDiagnostic = LoadDiagnostic

export interface PropsLoadValidationResult {
  data: PropsComponentRawData
  diagnostics: PropsLoadDiagnostic[]
}

const clonePropsValue = <T>(data: T): T => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(data)
  }

  return JSON.parse(JSON.stringify(data)) as T
}

const beginPropertyBatchPhase = beginBrowserDragPhase

export const measurePropertyBatchPhase = measureBrowserDragPhase

const cloneLoadData = (data: PropsComponentRawData): PropsComponentRawData =>
  clonePropsValue(data)

const isAddPropertyChange = (
  change: PropsChange
): change is AddRemovePropertyChange =>
  change.action === PROPS_ACTIONS.ADD_PROPERTY &&
  change.eventName === EventTypes.ADD_PROPERTY

const isRemovePropertyChange = (
  change: PropsChange
): change is AddRemovePropertyChange =>
  change.action === PROPS_ACTIONS.REMOVE_PROPERTY &&
  change.eventName === EventTypes.REMOVE_PROPERTY

const isUpdatePropertyChange = (
  change: PropsChange
): change is UpdatePropertyChange =>
  change.action === PROPS_ACTIONS.UPDATE_PROPERTY &&
  change.eventName === EventTypes.UPDATE_PROPERTY

const reportsAcceptedPropertyMutationHandoff = (error: unknown): boolean =>
  error !== null &&
  typeof error === 'object' &&
  'batchAccepted' in error &&
  (error as { batchAccepted?: unknown }).batchAccepted === true

interface PreparedOrdinaryPropertyRoot {
  readonly name: string
  readonly type: string
  readonly requestedId: string | undefined
  readonly activeComponent: PropertyComponentInstanceTypes | undefined
  readonly creationData: Readonly<Record<string, unknown>>
}

interface PropertyCreationBatchState {
  readonly changeStart: number
  readonly components: PropertyComponentInstanceTypes[]
  readonly componentIds: Set<string>
  readonly stagedById: Map<string, PropertyComponentInstanceTypes>
  readonly rootComponents: PropertyComponentInstanceTypes[]
  readonly rootComponentIds: Set<string>
  readonly explicitCreationIdByComponent: Map<
    PropertyComponentInstanceTypes,
    string
  >
  readonly existingUpdates: UpdatePropertyChange[]
  readonly activeSchemaByType: ReadonlyMap<string, PropertySchema | undefined>
  readonly ordinaryRootCreations: readonly PreparedOrdinaryPropertyRoot[]
  ordinaryRootCreationIndex: number
}

interface ActivePropertyBatchState {
  readonly changeStart: number
  readonly componentIds: Set<string>
  readonly components: readonly PropertyComponentInstanceTypes[]
  readonly snapshots: readonly PropertyComponentRawData[]
}

interface PropertyCreationTypeContract {
  readonly type: string
  readonly constructor: PropertyComponentConstructor
  readonly childRelation: PropertyChildRelationDefinition | undefined
  readonly schema: PropertySchema | undefined
  readonly componentRegistrationRevision: number
  readonly schemaRegistrationRevision: number
}

type PropertyCreationSourceSemantics = 'exact' | 'normalize-partial'

const deepFreezePropertyContract = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(
      deepFreezePropertyContract
    )
    Object.freeze(value)
  }
  return value
}

const snapshotPropertySchema = (
  schema: PropertySchema | undefined
): PropertySchema | undefined =>
  schema
    ? deepFreezePropertyContract({
        type: schema.type,
        fields: schema.fields.map((field) => ({
          ...field,
          allowedUnits: field.allowedUnits
            ? [...field.allowedUnits]
            : undefined,
          defaultValue: clonePropertyDefinitionValue(field.defaultValue)
        }))
      })
    : undefined

const snapshotPropertyChildRelation = (
  relation: PropertyChildRelationDefinition | undefined
): PropertyChildRelationDefinition | undefined =>
  relation ? Object.freeze({ ...relation }) : undefined

const isRuntimePropertyFieldValueValid = (
  field: PropertyFieldSchema,
  value: unknown
): boolean => {
  if (!matchesPropertyValueKind(field.kind, value)) {
    return false
  }
  if (
    field.allowedUnits &&
    field.allowedUnits.length > 0 &&
    typeof value === 'string' &&
    !field.allowedUnits.some((unit) => unit === value)
  ) {
    return false
  }
  if (!field.validate) {
    return true
  }
  try {
    return field.validate(value as never)
  } catch {
    return false
  }
}

const describeInvalidRuntimePropertyFieldValue = (value: unknown): string => {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return 'non-finite number'
  }
  if (Array.isArray(value)) {
    return 'array'
  }
  if (value === null) {
    return 'null'
  }
  return typeof value
}

const assertRuntimePropertyFields = (
  data: Readonly<Record<string, unknown>>,
  schema: PropertySchema | undefined,
  ownerLabel: string,
  excludedKeys: ReadonlySet<string> = new Set()
): void => {
  schema?.fields.forEach((field) => {
    if (
      !excludedKeys.has(field.key) &&
      Object.prototype.hasOwnProperty.call(data, field.key) &&
      !isRuntimePropertyFieldValueValid(field, data[field.key])
    ) {
      throw new Error(
        `[PropsManager] Invalid runtime property field "${ownerLabel}.${field.key}" (received ${describeInvalidRuntimePropertyFieldValue(data[field.key])})`
      )
    }
  })
}

export interface PropertyCreationBatchReceipt<T> {
  readonly result: T
  rollback(): void
  complete(): void
}

export interface PreparedPropertyCreationBatch {
  readonly kind: 'prepared-property-creation-batch'
  readonly componentIds: readonly string[]
  readonly rootComponentIds: readonly string[]
}

export interface OrdinaryPropertyCreationOwner {
  readonly definitions: readonly PropertyDefinition[]
  readonly data: Readonly<Record<string, unknown>>
  readonly propertyIds?: Readonly<Record<string, string>>
}

export interface PreparedOrdinaryPropertyCreationBatch {
  readonly kind: 'prepared-ordinary-property-creation-batch'
  readonly ownerCount: number
  readonly rootPropertyCount: number
}

export interface PreparedActivePropertyBatch {
  readonly kind: 'prepared-active-property-batch'
  readonly componentIds: readonly string[]
  readonly rootComponentIds: readonly string[]
}

export interface PreparedPropsTransactionEvent extends UpdateTransactionEvent {
  readonly type: typeof EventTypes.UPDATE_TRANSACTION
  readonly eventName: string
  readonly payload: PropsChange
  readonly options: EVENT_OPTIONS
  readonly canonicalEvidence: NonNullable<
    UpdateTransactionEvent['canonicalEvidence']
  >
}

export interface CanonicalPropertyDeliveryOwner {
  readonly orderedId: string
  readonly rootPropertyIds: readonly string[]
}

export interface CanonicalPropertyDeliveryRecord {
  readonly orderedIds: readonly string[]
  readonly payload: AddRemovePropertyChange
}

export interface PropertyValuesMutation {
  readonly kind: 'values'
  readonly propertyId: string
  readonly values: Readonly<Record<string, unknown>>
}

export interface PropertyRecordsMutation {
  readonly kind: 'records'
  readonly propertyId: string
  readonly key: string
  readonly values?: Readonly<Record<string, unknown>>
  readonly set?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly remove?: readonly string[]
}

export interface CreateOwnerPropertiesMutation {
  readonly kind: 'create-owner-properties'
  readonly ownerElementId: string
  readonly ownerElementType: string
  readonly definitions: readonly PropertyDefinition[]
  readonly data: Readonly<Record<string, unknown>>
  readonly propertyIds?: Readonly<Record<string, string>>
}

export interface CreateExactPropertyGraphMutation {
  readonly kind: 'create-exact-property-graph'
  readonly ownerRelations: readonly ElementPropertyRelation[]
  readonly components: readonly PropertyComponentRawData[]
}

export interface RemoveExactOrphanPropertyGraphsMutation {
  readonly kind: 'remove-exact-orphan-property-graphs'
  readonly orphanRootPropertyIds: readonly string[]
  readonly retainedRootPropertyIds: readonly string[]
}

export type PropertyMutation =
  | PropertyValuesMutation
  | PropertyRecordsMutation
  | CreateOwnerPropertiesMutation
  | CreateExactPropertyGraphMutation
  | RemoveExactOrphanPropertyGraphsMutation

export interface PropertyMutationBatchRequest {
  readonly operations: readonly PropertyMutation[]
  readonly options?: EVENT_OPTIONS
}

export interface PreparedPropertyMutationBatch {
  readonly kind: 'prepared-property-mutation-batch'
  readonly owners: readonly CanonicalPropertyDeliveryOwner[]
  readonly ownerRelations: readonly ElementPropertyRelation[]
  readonly orderedPropertyIds: readonly string[]
}

export interface PropertyMutationBatchResult {
  readonly owners: readonly CanonicalPropertyDeliveryOwner[]
  readonly ownerRelations: readonly ElementPropertyRelation[]
  readonly orderedPropertyIds: readonly string[]
  readonly evidence: readonly PropsChange[]
}

interface PreparedPropertyMutationComponent {
  readonly instance: PropertyComponentInstanceTypes
  readonly before: PropertyComponentRawData
  readonly after: PropertyComponentRawData
}

interface PreparedInactivePropertyCreation {
  readonly instance: PropertyComponentInstanceTypes
  readonly before: PropertyComponentRawData
}

interface PreparedRelationshipChildrenRead {
  readonly ownerId: string
  readonly present: boolean
  readonly childIds: readonly string[]
}

interface PreparedRelationshipOwnersRead {
  readonly childId: string
  readonly present: boolean
  readonly ownerIds: readonly string[]
}

interface PreparedSharedRetentionRead {
  readonly childId: string
  readonly preparedRemovedOwnerIds: readonly string[]
}

interface PreparedRetainedRootIdentityRead {
  readonly propertyId: string
  readonly instance: PropertyComponentInstanceTypes
}

interface PreparedRetainedRootRelationshipRead {
  readonly propertyId: string
  readonly instance: PropertyComponentInstanceTypes
  readonly relationKey: string
  readonly rawChildIds: readonly string[]
  readonly indexedChildIds: readonly string[]
}

interface PreparedOwnerDefinitionContract {
  readonly ownerElementType: string
  readonly ownerPropertyName: string
  readonly definition: PropertyDefinition
}

interface PreparedPropertyMutationArtifact {
  readonly owners: readonly CanonicalPropertyDeliveryOwner[]
  readonly ownerRelations: readonly ElementPropertyRelation[]
  readonly orderedPropertyIds: readonly string[]
  readonly registrationContracts: readonly PropertyCreationTypeContract[]
  readonly ownerDefinitionContracts: readonly PreparedOwnerDefinitionContract[]
  readonly readComponents: readonly {
    readonly instance: PropertyComponentInstanceTypes
    readonly before: PropertyComponentRawData
  }[]
  readonly existingComponents: readonly PreparedPropertyMutationComponent[]
  readonly createdComponents: readonly PropertyComponentRawData[]
  readonly reactivatedComponents: readonly PreparedInactivePropertyCreation[]
  readonly removedComponents: readonly PropertyComponentInstanceTypes[]
  readonly relationshipChildrenReads: readonly PreparedRelationshipChildrenRead[]
  readonly relationshipOwnersReads: readonly PreparedRelationshipOwnersRead[]
  readonly sharedRetentionReads: readonly PreparedSharedRetentionRead[]
  readonly retainedRootIdentityReads: readonly PreparedRetainedRootIdentityRead[]
  readonly retainedRootRelationshipReads: readonly PreparedRetainedRootRelationshipRead[]
  readonly evidence: readonly PropsChange[]
  readonly transactionEvents: readonly PreparedPropsTransactionEvent[]
}

class PropsManager {
  _components: Map<string, PropertyComponentInstanceTypes> = new Map()
  _deletedMap: Map<string, PropertyComponentInstanceTypes> = new Map()
  changes: PropsChange[] = []
  private validatedLoadArtifacts = new WeakMap<
    PropsLoadValidationResult,
    PropsComponentRawData
  >()
  private validatedRestoreArtifacts = new WeakMap<
    PreparedPropsRestore,
    {
      snapshot: PropsRestoreSnapshot
    }
  >()
  private validatedPropertyCreationArtifacts = new WeakMap<
    PreparedPropertyCreationBatch,
    {
      components: readonly PropertyComponentRawData[]
      registrationContracts: readonly PropertyCreationTypeContract[]
      parentFirstDeclarativeComponentIds: readonly string[]
      sourceSemantics: PropertyCreationSourceSemantics
    }
  >()
  private validatedOrdinaryPropertyCreationArtifacts = new WeakMap<
    PreparedOrdinaryPropertyCreationBatch,
    {
      roots: readonly PreparedOrdinaryPropertyRoot[]
      registrationContracts: readonly PropertyCreationTypeContract[]
    }
  >()
  private validatedActivePropertyArtifacts = new WeakMap<
    PreparedActivePropertyBatch,
    {
      components: readonly PropertyComponentRawData[]
      instances: readonly PropertyComponentInstanceTypes[]
    }
  >()
  private validatedPropertyMutationArtifacts = new WeakMap<
    PreparedPropertyMutationBatch,
    PreparedPropertyMutationArtifact
  >()
  private readonly componentAccessor: PropertyComponentAccessor
  private propertyCreationBatch: PropertyCreationBatchState | null = null
  private activePropertyBatch: ActivePropertyBatchState | null = null
  private propertyMutationStagedById: Map<
    string,
    PropertyComponentInstanceTypes
  > | null = null
  private propertyMutationApplyActive = false
  private readonly relationshipChildIdsByOwnerId = new Map<
    string,
    readonly string[]
  >()
  private readonly relationshipOwnerIdsByChildId = new Map<
    string,
    Set<string>
  >()
  private propertyStateRevision = 0

  constructor() {
    this.componentAccessor = {
      getPropertyById: (propertyId) =>
        this.resolvePropertyForComponent(propertyId),
      addToMap: (component) => this.addToMap(component),
      createComponent: (data) =>
        this.createPropertyInternal(
          data as Partial<PropertyComponentRawData>,
          'relationship-child'
        ),
      addChange: (change) =>
        this.addChange({
          action: PROPS_ACTIONS.UPDATE_PROPERTY,
          eventName: EventTypes.UPDATE_PROPERTY,
          ...change
        })
    }
    setComponentAccessor(this.componentAccessor)
  }

  private advancePropertyStateRevision(): void {
    this.propertyStateRevision += 1
  }

  private prepareRelationshipIndexEntry(
    component: PropertyComponentInstanceTypes,
    sourceSnapshot?: PropertyComponentRawData
  ): readonly string[] | undefined {
    const propertyId = component.get('id')
    const type = component.get('type')
    const relation =
      typeof type === 'string'
        ? getPropertyComponentCanonicalChildRelation(type)
        : undefined
    if (!relation) {
      return
    }
    if (
      sourceSnapshot &&
      (sourceSnapshot.id !== propertyId || sourceSnapshot.type !== type)
    ) {
      throw new Error(
        `[PropsManager] Property relationship index received inexact owner "${propertyId}"`
      )
    }
    const value = sourceSnapshot
      ? (sourceSnapshot as unknown as Readonly<Record<string, unknown>>)[
          relation.key
        ]
      : (
          component as unknown as {
            data: Readonly<Record<string, unknown>>
          }
        ).data[relation.key]
    if (
      !Array.isArray(value) ||
      value.some((childId) => typeof childId !== 'string') ||
      new Set(value).size !== value.length
    ) {
      return Object.freeze([])
    }
    return Object.freeze([...(value as string[])])
  }

  private replaceRelationshipOwnerEdges(
    ownerId: string,
    nextChildIds: readonly string[] | undefined
  ): void {
    const hasPreviousOwner = this.relationshipChildIdsByOwnerId.has(ownerId)
    const previousChildIds =
      this.relationshipChildIdsByOwnerId.get(ownerId) ?? []
    if (
      (!hasPreviousOwner && nextChildIds === undefined) ||
      (hasPreviousOwner &&
        nextChildIds !== undefined &&
        previousChildIds.length === nextChildIds.length &&
        previousChildIds.every(
          (childId, index) => childId === nextChildIds[index]
        ))
    ) {
      return
    }
    previousChildIds.forEach((childId) => {
      const ownerIds = this.relationshipOwnerIdsByChildId.get(childId)
      ownerIds?.delete(ownerId)
      if (ownerIds?.size === 0) {
        this.relationshipOwnerIdsByChildId.delete(childId)
      }
    })
    if (nextChildIds === undefined) {
      this.relationshipChildIdsByOwnerId.delete(ownerId)
      return
    }
    const retainedChildIds = Object.freeze([...nextChildIds])
    this.relationshipChildIdsByOwnerId.set(ownerId, retainedChildIds)
    retainedChildIds.forEach((childId) => {
      const ownerIds =
        this.relationshipOwnerIdsByChildId.get(childId) ?? new Set<string>()
      ownerIds.add(ownerId)
      this.relationshipOwnerIdsByChildId.set(childId, ownerIds)
    })
  }

  private refreshRelationshipOwnerEdges(
    component: PropertyComponentInstanceTypes,
    sourceSnapshot?: PropertyComponentRawData
  ): void {
    this.replaceRelationshipOwnerEdges(
      component.get('id'),
      this.prepareRelationshipIndexEntry(component, sourceSnapshot)
    )
  }

  private registerActiveComponent(
    component: PropertyComponentInstanceTypes,
    relationshipChildIds: readonly string[] | undefined
  ): void {
    const propertyId = component.get('id')
    this._components.set(propertyId, component)
    this.replaceRelationshipOwnerEdges(propertyId, relationshipChildIds)
  }

  private unregisterActiveComponent(
    propertyId: string
  ): PropertyComponentInstanceTypes | undefined {
    const component = this._components.get(propertyId)
    this._components.delete(propertyId)
    this.replaceRelationshipOwnerEdges(propertyId, undefined)
    return component
  }

  private createLoadValidationResult(
    data: PropsComponentRawData,
    diagnostics: PropsLoadDiagnostic[]
  ): PropsLoadValidationResult {
    const validatedSnapshot = cloneLoadData(data)
    const result = {
      data: cloneLoadData(validatedSnapshot),
      diagnostics
    }
    this.validatedLoadArtifacts.set(result, validatedSnapshot)
    return result
  }

  validateLoadData(data: unknown): PropsLoadValidationResult {
    const diagnostics: PropsLoadDiagnostic[] = []
    const sanitized: PropsComponentRawData = {}

    if (!isRecord(data)) {
      diagnostics.push({
        path: 'props',
        message: 'Expected object map for props data'
      })
      return this.createLoadValidationResult(sanitized, diagnostics)
    }

    Object.entries(data).forEach(([componentId, rawComponent]) => {
      if (!isRecord(rawComponent)) {
        diagnostics.push({
          path: `props.${componentId}`,
          message: 'Skipped non-object property component during load'
        })
        return
      }

      const rawType = rawComponent.type
      if (typeof rawType !== 'string' || rawType.length === 0) {
        diagnostics.push({
          path: `props.${componentId}.type`,
          message: 'Skipped property component with invalid type during load'
        })
        return
      }
      if (!getPropertyComponent(rawType)) {
        diagnostics.push({
          path: `props.${componentId}.type`,
          message: `Skipped unregistered property component type "${rawType}" during load`
        })
        return
      }

      const normalizedId =
        typeof rawComponent.id === 'string' && rawComponent.id.length > 0
          ? rawComponent.id
          : componentId

      sanitized[normalizedId] = {
        ...rawComponent,
        id: normalizedId,
        type: rawType
      } as PropertyComponentRawData
    })

    return this.createLoadValidationResult(sanitized, diagnostics)
  }

  applyValidatedLoad(result: PropsLoadValidationResult): void {
    const validated = this.validatedLoadArtifacts.get(result)
    if (!validated) {
      throw new Error(
        '[PropsManager] Expected an owner-issued one-shot validated load artifact'
      )
    }
    this.validatedLoadArtifacts.delete(result)
    this.dispose()

    Object.keys(validated).forEach((componentId) => {
      const newProperty = createProperty(
        validated[componentId]
      ) as PropertyComponentInstanceTypes
      this.addToMap(newProperty)
    })
  }

  load(data: PropsComponentRawData | unknown) {
    const result = this.validateLoadData(data)
    this.applyValidatedLoad(result)
  }

  save(): PropsComponentRawData {
    const data = {} as PropsComponentRawData
    this._components.forEach((component, componentId) => {
      data[componentId] = component.save()
    })

    return data
  }

  preflightElementPropertyValues(
    definitions: readonly PropertyDefinition[],
    data: Readonly<Record<string, unknown>>
  ): void {
    definitions.forEach((definition) => {
      assertRuntimePropertyFields(
        data,
        definition.schema ?? getRegisteredPropertySchema(definition.type),
        definition.name
      )
    })
  }

  addChange(change: PropsChange) {
    if (
      isUpdatePropertyChange(change) &&
      (Object.prototype.hasOwnProperty.call(change, 'ownerElementId') ||
        Object.prototype.hasOwnProperty.call(change, 'ownerPropertyName'))
    ) {
      throw new Error(
        '[PropsManager] Property-source evidence cannot accept an initiating owner'
      )
    }
    if (this.activePropertyBatch) {
      const activeBatch = this.activePropertyBatch
      if (isUpdatePropertyChange(change)) {
        this.restoreActivePropertyBatch(activeBatch, change)
        throw new Error(
          `[PropsManager] Active property reuse batch cannot update active property "${change.id}"`
        )
      }
      throw new Error(
        '[PropsManager] Active property reuse batch cannot record property changes'
      )
    }
    if (
      this.propertyMutationStagedById &&
      isUpdatePropertyChange(change) &&
      !this._components.has(change.id)
    ) {
      return
    }
    if (
      this.propertyCreationBatch &&
      isUpdatePropertyChange(change) &&
      this.propertyCreationBatch.componentIds.has(change.id)
    ) {
      if (change.options !== undefined) {
        throw new Error(
          '[PropsManager] Canonical property creation batch received an incompatible update'
        )
      }
      return
    }
    if (this.propertyCreationBatch && isUpdatePropertyChange(change)) {
      this.propertyCreationBatch.existingUpdates.push(change)
    }
    let relationshipChildIds: readonly string[] | undefined
    let updatesRelationshipIndex = false
    if (isUpdatePropertyChange(change)) {
      const component = this._components.get(change.id)
      const type = component?.get('type')
      const relation =
        typeof type === 'string'
          ? getPropertyComponentCanonicalChildRelation(type)
          : undefined
      if (component && relation?.key === change.key) {
        relationshipChildIds = this.prepareRelationshipIndexEntry(component)
        updatesRelationshipIndex = true
      }
    }
    this.changes.push(change)
    if (updatesRelationshipIndex && isUpdatePropertyChange(change)) {
      this.replaceRelationshipOwnerEdges(change.id, relationshipChildIds)
    }
    this.advancePropertyStateRevision()
  }

  cleanChanges() {
    this.changes = []
  }

  getPropertyById(
    propertyId: string
  ): PropertyComponentInstanceTypes | undefined {
    return this.resolvePropertyForComponent(propertyId)
  }

  resolvePropertyAncestorIds(
    propertyIds: readonly string[]
  ): readonly string[] {
    const orderedIds: string[] = []
    const emittedIds = new Set<string>()
    const completedIds = new Set<string>()
    const visitingIds = new Set<string>()

    const visit = (propertyId: string): void => {
      if (completedIds.has(propertyId)) {
        return
      }
      if (visitingIds.has(propertyId)) {
        throw new Error(
          `[PropsManager] Property ancestor resolution found a relationship cycle at "${propertyId}"`
        )
      }
      if (!this._components.has(propertyId)) {
        throw new Error(
          `[PropsManager] Property ancestor resolution requires active property "${propertyId}"`
        )
      }

      visitingIds.add(propertyId)
      if (!emittedIds.has(propertyId)) {
        emittedIds.add(propertyId)
        orderedIds.push(propertyId)
      }
      this.relationshipOwnerIdsByChildId.get(propertyId)?.forEach((ownerId) => {
        if (
          !this.relationshipChildIdsByOwnerId.get(ownerId)?.includes(propertyId)
        ) {
          throw new Error(
            `[PropsManager] Property ancestor resolution found an inconsistent relationship "${ownerId}:${propertyId}"`
          )
        }
        visit(ownerId)
      })
      visitingIds.delete(propertyId)
      completedIds.add(propertyId)
    }

    propertyIds.forEach((propertyId) => {
      if (typeof propertyId !== 'string' || propertyId.length === 0) {
        throw new Error(
          '[PropsManager] Property ancestor resolution requires valid property ids'
        )
      }
      visit(propertyId)
    })

    return Object.freeze(orderedIds)
  }

  private resolvePropertyForComponent(
    propertyId: string
  ): PropertyComponentInstanceTypes | undefined {
    const active = this._components.get(propertyId)
    if (active) {
      return active
    }
    return (
      this.propertyMutationStagedById?.get(propertyId) ??
      this.propertyCreationBatch?.stagedById.get(propertyId)
    )
  }

  getPropertyIdsByType(type: string): string[] {
    const ids = new Set<string>()
    const collect = (
      components: Map<string, PropertyComponentInstanceTypes>
    ): void => {
      components.forEach((component, id) => {
        if (component.get('type') === type) {
          ids.add(id)
        }
      })
    }

    collect(this._components)
    collect(this._deletedMap)
    return Array.from(ids)
  }

  addToMap(component: PropertyComponentInstanceTypes) {
    const comId = component.get('id')
    if (!component || !comId) {
      return
    }
    const active = this._components.get(comId)
    if (this.propertyMutationStagedById) {
      if (active === component) {
        return
      }
      const staged = this.propertyMutationStagedById.get(comId)
      if (
        (staged !== undefined && staged !== component) ||
        active !== undefined ||
        this._deletedMap.has(comId)
      ) {
        throw new Error(
          `[PropsManager] Property mutation cannot stage property "${comId}"`
        )
      }
      this.propertyMutationStagedById.set(comId, component)
      return
    }
    if (this.activePropertyBatch) {
      if (
        !this.activePropertyBatch.componentIds.has(comId) ||
        active !== component
      ) {
        throw new Error(
          `[PropsManager] Active property reuse batch cannot register property "${comId}"`
        )
      }
      return
    }
    if (
      this.propertyCreationBatch &&
      active !== undefined &&
      active !== component
    ) {
      throw new Error(
        `[PropsManager] Canonical property creation batch cannot replace active property "${comId}"`
      )
    }
    if (
      this.propertyCreationBatch &&
      active === component &&
      !this.propertyCreationBatch.componentIds.has(comId)
    ) {
      throw new Error(
        `[PropsManager] Canonical property creation batch cannot register active owner property "${comId}"`
      )
    }
    if (this.propertyCreationBatch) {
      if (this.propertyCreationBatch.stagedById.get(comId) !== component) {
        throw new Error(
          `[PropsManager] Canonical property creation batch cannot stage property "${comId}"`
        )
      }
      return
    }

    const relationshipChildIds = this.prepareRelationshipIndexEntry(component)
    this.removeFromDeletedMap(comId)
    this.registerActiveComponent(component, relationshipChildIds)
    if (active !== component) {
      this.advancePropertyStateRevision()
    }
  }

  removeFromMap(componentId: string) {
    if (this.activePropertyBatch) {
      throw new Error(
        `[PropsManager] Active property reuse batch cannot remove property "${componentId}"`
      )
    }
    const component = this.getPropertyById(componentId)
    if (!component) {
      return
    }

    this.addToDeletedMap(component)
    this.unregisterActiveComponent(componentId)
    this.advancePropertyStateRevision()
  }

  addToDeletedMap(component: PropertyComponentInstanceTypes) {
    this._deletedMap.set(component.get('id'), component)
  }

  removeFromDeletedMap(componentId: string) {
    this._deletedMap.delete(componentId)
  }

  getRestoreComponentById(componentId: string) {
    return this._deletedMap.get(componentId)
  }

  private capturePropertyCreationTypeContract(
    type: string,
    registrationContractByType: Map<string, PropertyCreationTypeContract>
  ): PropertyCreationTypeContract {
    const existing = registrationContractByType.get(type)
    if (existing) {
      return existing
    }

    const constructor = getPropertyComponent(type)
    if (!type || !constructor) {
      throw new Error(
        `[PropsManager] Property creation has an unregistered type "${type}"`
      )
    }
    const componentRegistrationRevision =
      getPropertyComponentRegistrationRevision(type)
    const schemaRegistrationRevision =
      getPropertySchemaRegistrationRevision(type)
    const childRelation = snapshotPropertyChildRelation(
      getPropertyComponentCanonicalChildRelation(type)
    )
    const batchRebindableRelation =
      getPropertyComponentBatchRebindableRelation(constructor)
    if (
      batchRebindableRelation &&
      !arePropertyChildRelationsEqual(batchRebindableRelation, childRelation)
    ) {
      throw new Error(
        `[PropsManager] Property creation has incoherent relationship registration for "${type}"`
      )
    }
    const schema = snapshotPropertySchema(getRegisteredPropertySchema(type))
    if (
      getPropertyComponentRegistrationRevision(type) !==
        componentRegistrationRevision ||
      getPropertySchemaRegistrationRevision(type) !== schemaRegistrationRevision
    ) {
      throw new Error(
        `[PropsManager] Property creation registration changed for "${type}"`
      )
    }

    const contract = Object.freeze({
      type,
      constructor,
      childRelation,
      schema,
      componentRegistrationRevision,
      schemaRegistrationRevision
    })
    registrationContractByType.set(type, contract)
    return contract
  }

  preflightOrdinaryPropertyCreationBatch(
    sourceOwners: unknown
  ): PreparedOrdinaryPropertyCreationBatch {
    return measurePropertyBatchPhase(
      'props-manager:ordinary-creation-preflight',
      () => {
        if (!Array.isArray(sourceOwners) || sourceOwners.length === 0) {
          throw new Error(
            '[PropsManager] Ordinary property creation requires element owners'
          )
        }

        const roots: PreparedOrdinaryPropertyRoot[] = []
        const reservedNewComponentIds = new Set<string>()
        const preparedRootTypesById = new Map<string, string>()
        const relationshipDescriptors: {
          value: unknown
          contract: PropertyCreationTypeContract
          ownerLabel: string
        }[] = []
        const registrationContractByType = new Map<
          string,
          PropertyCreationTypeContract
        >()
        const capturedRelationshipContractTypes = new Set<string>()
        const captureRelationshipContracts = (
          type: string,
          visiting = new Set<string>()
        ): void => {
          if (
            capturedRelationshipContractTypes.has(type) ||
            visiting.has(type)
          ) {
            return
          }
          visiting.add(type)
          const contract = this.capturePropertyCreationTypeContract(
            type,
            registrationContractByType
          )
          if (contract.childRelation) {
            captureRelationshipContracts(
              contract.childRelation.childType,
              visiting
            )
          }
          visiting.delete(type)
          capturedRelationshipContractTypes.add(type)
        }
        const explicitDescriptorChildTypes = new Map<string, string>()
        const preflightRelationshipDescriptor = (
          value: unknown,
          contract: PropertyCreationTypeContract,
          ownerLabel: string
        ): void => {
          const childRelation = contract.childRelation
          if (!childRelation) {
            return
          }
          const preflightDescriptorEntry = (
            item: unknown,
            label: string,
            keyedChildId: string | undefined
          ): void => {
            if (typeof item === 'string' && keyedChildId === undefined) {
              const activeChild = this._components.get(item)
              const preparedChildType =
                explicitDescriptorChildTypes.get(item) ??
                preparedRootTypesById.get(item)
              const childType = activeChild?.get('type') ?? preparedChildType
              if (!childType) {
                throw new Error(
                  `[PropsManager] Ordinary property creation is missing relationship child "${item}"`
                )
              }
              if (childType !== childRelation.childType) {
                throw new Error(
                  `[PropsManager] Ordinary property creation relationship child "${item}" has the wrong type`
                )
              }
              return
            }
            if (
              (keyedChildId !== undefined && keyedChildId.length === 0) ||
              (childRelation.mode ?? 'ids') !== 'ids-or-objects' ||
              !isRecord(item)
            ) {
              throw new Error(
                `[PropsManager] Ordinary property creation has an invalid relationship descriptor for "${label}"`
              )
            }

            const itemChildId =
              typeof item.id === 'string' && item.id.length > 0
                ? item.id
                : undefined
            if (
              keyedChildId !== undefined &&
              itemChildId !== undefined &&
              itemChildId !== keyedChildId
            ) {
              throw new Error(
                `[PropsManager] Ordinary property creation relationship child "${keyedChildId}" has conflicting canonical ids`
              )
            }
            let explicitChildId = keyedChildId ?? itemChildId
            let mappedChild: Record<string, unknown> | null
            try {
              mappedChild = childRelation.toChildData
                ? childRelation.toChildData(item, explicitChildId)
                : item
            } catch {
              mappedChild = null
            }
            if (!isRecord(mappedChild)) {
              throw new Error(
                `[PropsManager] Ordinary property creation has an invalid relationship descriptor for "${label}"`
              )
            }
            const normalizedChild: Record<string, unknown> = {
              ...mappedChild,
              type: childRelation.childType
            }
            if (
              typeof normalizedChild.id === 'string' &&
              normalizedChild.id.length > 0
            ) {
              if (explicitChildId && normalizedChild.id !== explicitChildId) {
                throw new Error(
                  `[PropsManager] Ordinary property creation relationship child "${explicitChildId}" changed its canonical id`
                )
              }
              explicitChildId = normalizedChild.id
            }
            if (!explicitChildId) {
              delete normalizedChild.id
              explicitChildId = undefined
            }
            if (explicitChildId) {
              const activeChild = this._components.get(explicitChildId)
              if (activeChild) {
                if (activeChild.get('type') !== childRelation.childType) {
                  throw new Error(
                    `[PropsManager] Ordinary property creation relationship child "${explicitChildId}" has the wrong type`
                  )
                }
                if (
                  Object.keys(normalizedChild).some(
                    (key) => key !== 'id' && key !== 'type'
                  )
                ) {
                  throw new Error(
                    `[PropsManager] Ordinary property creation cannot apply an active relationship child override for "${explicitChildId}"`
                  )
                }
              } else if (reservedNewComponentIds.has(explicitChildId)) {
                throw new Error(
                  `[PropsManager] Ordinary property creation relationship child "${explicitChildId}" conflicts with a reserved property id`
                )
              } else if (this._deletedMap.has(explicitChildId)) {
                throw new Error(
                  `[PropsManager] Ordinary property creation has a duplicate relationship child "${explicitChildId}"`
                )
              } else {
                reservedNewComponentIds.add(explicitChildId)
                explicitDescriptorChildTypes.set(
                  explicitChildId,
                  childRelation.childType
                )
              }
            }

            const childContract = registrationContractByType.get(
              childRelation.childType
            )
            if (!childContract) {
              throw new Error(
                `[PropsManager] Ordinary property creation has an unregistered relationship child type "${childRelation.childType}"`
              )
            }
            const excludedChildKeys = childContract.childRelation
              ? new Set([childContract.childRelation.key])
              : undefined
            assertRuntimePropertyFields(
              normalizedChild,
              childContract.schema,
              label,
              excludedChildKeys
            )
            if (
              childContract.childRelation &&
              Object.prototype.hasOwnProperty.call(
                normalizedChild,
                childContract.childRelation.key
              )
            ) {
              preflightRelationshipDescriptor(
                normalizedChild[childContract.childRelation.key],
                childContract,
                label
              )
            }
          }

          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              preflightDescriptorEntry(
                item,
                `${ownerLabel}[${index}]`,
                undefined
              )
            })
            return
          }
          if (
            childRelation.collection === 'array-or-record' &&
            isRecord(value)
          ) {
            Object.keys(value).forEach((childId) => {
              preflightDescriptorEntry(
                value[childId],
                `${ownerLabel}.${childId}`,
                childId
              )
            })
            return
          }
          throw new Error(
            `[PropsManager] Ordinary property creation has an invalid relationship descriptor for "${ownerLabel}"`
          )
        }

        sourceOwners.forEach((sourceOwner, ownerIndex) => {
          if (
            !isRecord(sourceOwner) ||
            !Array.isArray(sourceOwner.definitions) ||
            !isRecord(sourceOwner.data) ||
            (sourceOwner.propertyIds !== undefined &&
              !isRecord(sourceOwner.propertyIds))
          ) {
            throw new Error(
              `[PropsManager] Ordinary property creation has an invalid owner at index ${ownerIndex}`
            )
          }

          const ownerData = sourceOwner.data as Readonly<
            Record<string, unknown>
          >
          const ownerPropertyIds = sourceOwner.propertyIds as
            Readonly<Record<string, unknown>> | undefined
          const observedNames = new Set<string>()
          sourceOwner.definitions.forEach((sourceDefinition) => {
            if (
              !isRecord(sourceDefinition) ||
              typeof sourceDefinition.name !== 'string' ||
              sourceDefinition.name.length === 0 ||
              typeof sourceDefinition.type !== 'string' ||
              sourceDefinition.type.length === 0 ||
              observedNames.has(sourceDefinition.name)
            ) {
              throw new Error(
                `[PropsManager] Ordinary property creation has an invalid definition for owner ${ownerIndex}`
              )
            }
            observedNames.add(sourceDefinition.name)
            captureRelationshipContracts(sourceDefinition.type)
            const contract = registrationContractByType.get(
              sourceDefinition.type
            ) as PropertyCreationTypeContract
            const definitionSchema =
              isRecord(sourceDefinition.schema) &&
              typeof sourceDefinition.schema.type === 'string' &&
              Array.isArray(sourceDefinition.schema.fields)
                ? snapshotPropertySchema(
                    sourceDefinition.schema as unknown as PropertySchema
                  )
                : contract.schema
            const relationKey =
              contract.childRelation?.key === sourceDefinition.name
                ? contract.childRelation.key
                : undefined
            const excludedRelationKeys = relationKey
              ? new Set([relationKey])
              : undefined
            assertRuntimePropertyFields(
              ownerData,
              definitionSchema,
              sourceDefinition.name,
              excludedRelationKeys
            )
            let defaultCreationValue: unknown
            if (sourceDefinition.defaultValue !== undefined) {
              defaultCreationValue = deepFreezePropertyContract(
                clonePropsValue(sourceDefinition.defaultValue)
              )
              const defaultData = {
                [sourceDefinition.name]: defaultCreationValue
              }
              assertRuntimePropertyFields(
                defaultData,
                contract.schema,
                sourceDefinition.name,
                excludedRelationKeys
              )
              if (relationKey) {
                relationshipDescriptors.push({
                  value: defaultCreationValue,
                  contract,
                  ownerLabel: `${sourceDefinition.name}.default`
                })
              }
            }

            const requestedId = ownerPropertyIds?.[sourceDefinition.name]
            const activeComponent =
              typeof requestedId === 'string'
                ? this._components.get(requestedId)
                : undefined
            const activeMutationKeys = new Set([
              sourceDefinition.name,
              ...(Array.isArray(sourceDefinition.alias)
                ? sourceDefinition.alias.filter(
                    (alias): alias is string => typeof alias === 'string'
                  )
                : []),
              ...(definitionSchema?.fields.map(({ key }) => key) ?? [])
            ])
            const creationData: Record<string, unknown> = {}
            if (sourceDefinition.defaultValue !== undefined) {
              creationData[sourceDefinition.name] = defaultCreationValue
            }
            activeMutationKeys.forEach((key) => {
              if (Object.prototype.hasOwnProperty.call(ownerData, key)) {
                creationData[key] = ownerData[key]
              }
            })
            const frozenCreationData = Object.freeze(creationData)
            if (
              relationKey &&
              Object.prototype.hasOwnProperty.call(ownerData, relationKey)
            ) {
              relationshipDescriptors.push({
                value: frozenCreationData[relationKey],
                contract,
                ownerLabel: sourceDefinition.name
              })
            }
            if (
              requestedId !== undefined &&
              (typeof requestedId !== 'string' ||
                requestedId.length === 0 ||
                this._deletedMap.has(requestedId) ||
                (activeComponent !== undefined &&
                  activeComponent.get('type') !== sourceDefinition.type) ||
                (activeComponent === undefined &&
                  reservedNewComponentIds.has(requestedId)))
            ) {
              throw new Error(
                `[PropsManager] Ordinary property creation has an unavailable property id for "${sourceDefinition.name}"`
              )
            }
            if (
              activeComponent &&
              [...activeMutationKeys].some((key) =>
                Object.prototype.hasOwnProperty.call(ownerData, key)
              )
            ) {
              throw new Error(
                `[PropsManager] Ordinary property creation cannot apply an active owner override for "${sourceDefinition.name}"`
              )
            }
            if (requestedId && !activeComponent) {
              reservedNewComponentIds.add(requestedId)
              preparedRootTypesById.set(requestedId, sourceDefinition.type)
            }
            roots.push(
              Object.freeze({
                name: sourceDefinition.name,
                type: sourceDefinition.type,
                requestedId:
                  typeof requestedId === 'string' ? requestedId : undefined,
                activeComponent,
                creationData: frozenCreationData
              })
            )
          })
        })
        relationshipDescriptors.forEach(({ value, contract, ownerLabel }) => {
          preflightRelationshipDescriptor(value, contract, ownerLabel)
        })

        const prepared = Object.freeze({
          kind: 'prepared-ordinary-property-creation-batch' as const,
          ownerCount: sourceOwners.length,
          rootPropertyCount: roots.length
        })
        this.validatedOrdinaryPropertyCreationArtifacts.set(prepared, {
          roots: Object.freeze(roots),
          registrationContracts: Object.freeze([
            ...registrationContractByType.values()
          ])
        })
        return prepared
      }
    )
  }

  preflightPropertyCreationBatch(
    sourceComponents: unknown,
    sourceRootComponentIds: unknown
  ): PreparedPropertyCreationBatch {
    return measurePropertyBatchPhase('props-manager:creation-preflight', () =>
      this.preflightPropertyCreationBatchUnmeasured(
        sourceComponents,
        sourceRootComponentIds,
        'exact'
      )
    )
  }

  preflightNormalizedPropertyCreationBatch(
    sourceComponents: unknown,
    sourceRootComponentIds: unknown
  ): PreparedPropertyCreationBatch {
    return measurePropertyBatchPhase('props-manager:creation-preflight', () =>
      this.preflightPropertyCreationBatchUnmeasured(
        sourceComponents,
        sourceRootComponentIds,
        'normalize-partial'
      )
    )
  }

  private preflightPropertyCreationBatchUnmeasured(
    sourceComponents: unknown,
    sourceRootComponentIds: unknown,
    sourceSemantics: PropertyCreationSourceSemantics
  ): PreparedPropertyCreationBatch {
    if (
      !Array.isArray(sourceComponents) ||
      sourceComponents.length === 0 ||
      !Array.isArray(sourceRootComponentIds) ||
      sourceRootComponentIds.length === 0
    ) {
      throw new Error(
        '[PropsManager] Canonical property creation requires components and owner roots'
      )
    }

    const components = clonePropsValue(
      sourceComponents as PropertyComponentRawData[]
    )
    const rootComponentIds = clonePropsValue(sourceRootComponentIds as string[])
    const componentIds = components.map(({ id }) => id)
    if (
      componentIds.some(
        (componentId) =>
          typeof componentId !== 'string' || componentId.length === 0
      ) ||
      new Set(componentIds).size !== componentIds.length
    ) {
      throw new Error(
        '[PropsManager] Canonical property creation has duplicate or invalid component ids'
      )
    }
    if (
      rootComponentIds.some(
        (componentId) =>
          typeof componentId !== 'string' || componentId.length === 0
      )
    ) {
      throw new Error(
        '[PropsManager] Canonical property creation has invalid owner roots'
      )
    }
    const uniqueRootComponentIds = [...new Set(rootComponentIds)]

    const componentById = new Map(
      components.map((component) => [component.id, component] as const)
    )
    const sourceIndexById = new Map(
      componentIds.map((componentId, index) => [componentId, index] as const)
    )
    const registrationContractByType = new Map<
      string,
      PropertyCreationTypeContract
    >()
    components.forEach((component) => {
      const type =
        isRecord(component) && typeof component.type === 'string'
          ? component.type
          : ''
      let registrationContract = registrationContractByType.get(type)
      const constructor =
        registrationContract?.constructor ?? getPropertyComponent(type)
      if (!isRecord(component) || !type || !constructor) {
        throw new Error(
          `[PropsManager] Canonical property creation has invalid component "${component.id ?? ''}"`
        )
      }
      if (!registrationContract) {
        const componentRegistrationRevision =
          getPropertyComponentRegistrationRevision(type)
        const schemaRegistrationRevision =
          getPropertySchemaRegistrationRevision(type)
        const childRelation = snapshotPropertyChildRelation(
          getPropertyComponentCanonicalChildRelation(type)
        )
        const batchRebindableRelation =
          getPropertyComponentBatchRebindableRelation(constructor)
        if (
          batchRebindableRelation &&
          !arePropertyChildRelationsEqual(
            batchRebindableRelation,
            childRelation
          )
        ) {
          throw new Error(
            `[PropsManager] Canonical property creation has incoherent relationship registration for "${type}"`
          )
        }
        const schema = snapshotPropertySchema(getRegisteredPropertySchema(type))
        if (
          getPropertyComponentRegistrationRevision(type) !==
            componentRegistrationRevision ||
          getPropertySchemaRegistrationRevision(type) !==
            schemaRegistrationRevision
        ) {
          throw new Error(
            `[PropsManager] Canonical property creation registration changed for "${type}"`
          )
        }
        registrationContract = {
          type,
          constructor,
          childRelation,
          schema,
          componentRegistrationRevision,
          schemaRegistrationRevision
        }
        registrationContractByType.set(type, registrationContract)
      }
      assertRuntimePropertyFields(
        component as Readonly<Record<string, unknown>>,
        registrationContract.schema,
        component.id
      )
      if (
        this._components.has(component.id) ||
        this._deletedMap.has(component.id)
      ) {
        throw new Error(
          `[PropsManager] Canonical property creation component "${component.id}" is already registered`
        )
      }
    })
    uniqueRootComponentIds.forEach((componentId) => {
      if (!componentById.has(componentId)) {
        throw new Error(
          `[PropsManager] Canonical property creation is missing owner root "${componentId}"`
        )
      }
    })

    const reachableComponentIds = new Set<string>()
    const visitingComponentIds = new Set<string>()
    const parentFirstDeclarativeComponentIds = new Set<string>()
    const requiresDeferredRebindById = new Map<string, boolean>()
    const visit = (componentId: string): boolean => {
      if (visitingComponentIds.has(componentId)) {
        throw new Error(
          `[PropsManager] Canonical property creation has a relationship cycle at "${componentId}"`
        )
      }
      if (requiresDeferredRebindById.has(componentId)) {
        return requiresDeferredRebindById.get(componentId) as boolean
      }
      const component = componentById.get(componentId)
      if (!component) {
        return false
      }
      visitingComponentIds.add(componentId)
      reachableComponentIds.add(componentId)
      const registrationContract = registrationContractByType.get(
        component.type
      )
      const childRelation = registrationContract?.childRelation
      if (!childRelation) {
        visitingComponentIds.delete(componentId)
        requiresDeferredRebindById.set(componentId, false)
        return false
      }
      const childIds = (component as Record<string, unknown>)[childRelation.key]
      if (childIds === undefined && sourceSemantics === 'normalize-partial') {
        const componentConstructor = registrationContract?.constructor
        const requiresDeferredRebind = Boolean(
          componentConstructor &&
          isPropertyComponentBatchRebindable(
            componentConstructor,
            childRelation
          )
        )
        visitingComponentIds.delete(componentId)
        requiresDeferredRebindById.set(componentId, requiresDeferredRebind)
        if (requiresDeferredRebind) {
          parentFirstDeclarativeComponentIds.add(componentId)
        }
        return requiresDeferredRebind
      }
      if (
        !Array.isArray(childIds) ||
        childIds.some((childId) => typeof childId !== 'string') ||
        new Set(childIds).size !== childIds.length
      ) {
        throw new Error(
          `[PropsManager] Canonical property creation has malformed child relation for "${componentId}"`
        )
      }
      let requiresDeferredRebind = false
      childIds.forEach((childId) => {
        const sourceChild = componentById.get(childId)
        const childType =
          sourceChild?.type ?? this.getPropertyById(childId)?.get('type')
        if (!childType) {
          throw new Error(
            `[PropsManager] Canonical property creation is missing relation child "${childId}"`
          )
        }
        if (childType !== childRelation.childType) {
          throw new Error(
            `[PropsManager] Canonical property creation child "${childId}" has the wrong type`
          )
        }
        if (sourceChild) {
          const childRequiresDeferredRebind = visit(childId)
          if (
            (sourceIndexById.get(childId) as number) >=
              (sourceIndexById.get(componentId) as number) ||
            childRequiresDeferredRebind
          ) {
            const componentConstructor = registrationContract?.constructor
            if (
              !componentConstructor ||
              !isPropertyComponentBatchRebindable(
                componentConstructor,
                childRelation
              )
            ) {
              throw new Error(
                `[PropsManager] Canonical property creation requires child-first order for "${childId}"`
              )
            }
            requiresDeferredRebind = true
          }
        }
      })
      visitingComponentIds.delete(componentId)
      requiresDeferredRebindById.set(componentId, requiresDeferredRebind)
      if (requiresDeferredRebind) {
        parentFirstDeclarativeComponentIds.add(componentId)
      }
      return requiresDeferredRebind
    }
    uniqueRootComponentIds.forEach(visit)
    if (reachableComponentIds.size !== components.length) {
      throw new Error(
        '[PropsManager] Canonical property creation contains an unowned property'
      )
    }

    const prepared = Object.freeze({
      kind: 'prepared-property-creation-batch' as const,
      componentIds: Object.freeze([...componentIds]),
      rootComponentIds: Object.freeze([...uniqueRootComponentIds])
    })
    this.validatedPropertyCreationArtifacts.set(prepared, {
      components: Object.freeze(components.map((component) => component)),
      registrationContracts: Object.freeze([
        ...registrationContractByType.values()
      ]),
      parentFirstDeclarativeComponentIds: Object.freeze([
        ...parentFirstDeclarativeComponentIds
      ]),
      sourceSemantics
    })
    return prepared
  }

  applyPropertyCreationBatch(
    prepared: PreparedPropertyCreationBatch
  ): readonly string[] {
    if (!this.propertyCreationBatch) {
      throw new Error(
        '[PropsManager] Applying a prepared property creation batch requires an active property creation batch'
      )
    }
    const artifact = this.validatedPropertyCreationArtifacts.get(prepared)
    if (!artifact) {
      throw new Error(
        '[PropsManager] Expected an owner-issued one-shot prepared property creation batch'
      )
    }
    this.validatedPropertyCreationArtifacts.delete(prepared)

    const components = this.createAndRegisterPropertyBatch(
      artifact.components,
      artifact.registrationContracts,
      artifact.parentFirstDeclarativeComponentIds,
      artifact.sourceSemantics
    )
    if (artifact.sourceSemantics === 'exact') {
      measurePropertyBatchPhase('props-manager:creation-exact', () => {
        components.forEach((component, index) => {
          const sourceComponent = artifact.components[index]
          if (!isEqual(component.save(), sourceComponent)) {
            throw new Error(
              '[PropsManager] Canonical property creation changed exact component data'
            )
          }
        })
      })
    }
    return Object.freeze(components.map((component) => component.get('id')))
  }

  preflightActivePropertyBatch(
    sourceComponents: unknown,
    sourceRootComponentIds: unknown
  ): PreparedActivePropertyBatch {
    return measurePropertyBatchPhase('props-manager:active-preflight', () =>
      this.preflightActivePropertyBatchUnmeasured(
        sourceComponents,
        sourceRootComponentIds
      )
    )
  }

  private preflightActivePropertyBatchUnmeasured(
    sourceComponents: unknown,
    sourceRootComponentIds: unknown
  ): PreparedActivePropertyBatch {
    if (
      !Array.isArray(sourceComponents) ||
      sourceComponents.length === 0 ||
      !Array.isArray(sourceRootComponentIds) ||
      sourceRootComponentIds.length === 0
    ) {
      throw new Error(
        '[PropsManager] Active property batch requires components and owner roots'
      )
    }

    const finishClone = beginPropertyBatchPhase(
      'props-manager:active-preflight-clone'
    )
    const components = clonePropsValue(
      sourceComponents as PropertyComponentRawData[]
    )
    const rootComponentIds = clonePropsValue(sourceRootComponentIds as string[])
    finishClone()

    const finishExact = beginPropertyBatchPhase(
      'props-manager:active-preflight-exact'
    )
    if (components.some((component) => !isRecord(component))) {
      throw new Error(
        '[PropsManager] Active property batch has invalid component data'
      )
    }
    const componentIds = components.map(({ id }) => id)
    if (
      componentIds.some(
        (componentId) =>
          typeof componentId !== 'string' || componentId.length === 0
      ) ||
      new Set(componentIds).size !== componentIds.length
    ) {
      throw new Error(
        '[PropsManager] Active property batch has duplicate or invalid component ids'
      )
    }
    if (
      rootComponentIds.some(
        (componentId) =>
          typeof componentId !== 'string' || componentId.length === 0
      )
    ) {
      throw new Error(
        '[PropsManager] Active property batch has invalid owner roots'
      )
    }
    const uniqueRootComponentIds = [...new Set(rootComponentIds)]
    const componentById = new Map(
      components.map((component) => [component.id, component] as const)
    )
    const instances = components.map((component) => {
      if (
        typeof component.type !== 'string' ||
        component.type.length === 0 ||
        !getPropertyComponent(component.type)
      ) {
        throw new Error(
          `[PropsManager] Active property batch has invalid component "${component.id ?? ''}"`
        )
      }
      const active = this.getPropertyById(component.id)
      if (
        !active ||
        active.get('type') !== component.type ||
        !isEqual(active.save(), component)
      ) {
        throw new Error(
          `[PropsManager] Active property batch changed exact component data for "${component.id}"`
        )
      }
      return active
    })

    uniqueRootComponentIds.forEach((componentId) => {
      if (!componentById.has(componentId)) {
        throw new Error(
          `[PropsManager] Active property batch is missing owner root "${componentId}"`
        )
      }
    })
    finishExact()

    const finishRelations = beginPropertyBatchPhase(
      'props-manager:active-preflight-relations'
    )
    const visitedComponentIds = new Set<string>()
    const visit = (componentId: string): void => {
      if (visitedComponentIds.has(componentId)) {
        return
      }
      const component = componentById.get(componentId)
      if (!component) {
        return
      }
      visitedComponentIds.add(componentId)
      const childRelation = getPropertyComponentCanonicalChildRelation(
        component.type
      )
      if (!childRelation) {
        return
      }
      const childIds = (component as Record<string, unknown>)[childRelation.key]
      if (
        !Array.isArray(childIds) ||
        childIds.some((childId) => typeof childId !== 'string') ||
        new Set(childIds).size !== childIds.length
      ) {
        throw new Error(
          `[PropsManager] Active property batch has malformed child relation for "${componentId}"`
        )
      }
      childIds.forEach((childId) => {
        const sourceChild = componentById.get(childId)
        const activeChild = this.getPropertyById(childId)
        if (!activeChild) {
          throw new Error(
            `[PropsManager] Active property batch is missing relation child "${childId}"`
          )
        }
        if (
          activeChild.get('type') !== childRelation.childType ||
          (sourceChild && sourceChild.type !== childRelation.childType)
        ) {
          throw new Error(
            `[PropsManager] Active property batch child "${childId}" has the wrong type`
          )
        }
        if (sourceChild) {
          visit(childId)
        }
      })
    }
    uniqueRootComponentIds.forEach(visit)
    componentIds.forEach(visit)
    finishRelations()

    const prepared = Object.freeze({
      kind: 'prepared-active-property-batch' as const,
      componentIds: Object.freeze([...componentIds]),
      rootComponentIds: Object.freeze([...uniqueRootComponentIds])
    })
    this.validatedActivePropertyArtifacts.set(prepared, {
      components: Object.freeze(components.map((component) => component)),
      instances: Object.freeze([...instances])
    })
    return prepared
  }

  private restoreActivePropertyBatch(
    batch: ActivePropertyBatchState,
    rejectedUpdate?: UpdatePropertyChange
  ) {
    const shouldRestoreBatch = this.activePropertyBatch === batch
    if (shouldRestoreBatch) {
      this.activePropertyBatch = null
    }
    try {
      if (rejectedUpdate) {
        const rejectedComponent = this._components.get(rejectedUpdate.id)
        if (rejectedComponent) {
          rejectedComponent.load({
            ...rejectedComponent.save(),
            [rejectedUpdate.key]: clonePropsValue(rejectedUpdate.before)
          })
        }
      }
      batch.components.forEach((component, index) => {
        const snapshot = batch.snapshots[index]
        if (!snapshot) {
          return
        }
        component.load(clonePropsValue(snapshot))
        const relationshipChildIds = this.prepareRelationshipIndexEntry(
          component,
          snapshot
        )
        if (this._components.get(snapshot.id) !== component) {
          this.registerActiveComponent(component, relationshipChildIds)
        } else {
          this.replaceRelationshipOwnerEdges(snapshot.id, relationshipChildIds)
        }
      })
      this.changes.splice(batch.changeStart)
    } finally {
      if (shouldRestoreBatch) {
        this.activePropertyBatch = batch
      }
    }
  }

  private assertActivePropertyBatchCanStart() {
    if (this.propertyCreationBatch || this.activePropertyBatch) {
      throw new Error(
        '[PropsManager] Active property reuse batch cannot nest inside another property batch'
      )
    }
  }

  runWithActivePropertyBatch<T>(
    sourceComponents: unknown,
    sourceRootComponentIds: unknown,
    operation: () => T
  ): T {
    this.assertActivePropertyBatchCanStart()
    const prepared = this.preflightActivePropertyBatch(
      sourceComponents,
      sourceRootComponentIds
    )
    return this.consumeActivePropertyBatch(prepared, operation, false)
  }

  runInActivePropertyBatch<T>(
    prepared: PreparedActivePropertyBatch,
    operation: () => T
  ): T {
    return this.consumeActivePropertyBatch(prepared, operation, true)
  }

  private consumeActivePropertyBatch<T>(
    prepared: PreparedActivePropertyBatch,
    operation: () => T,
    verifyEntryExact: boolean
  ): T {
    this.assertActivePropertyBatchCanStart()
    const artifact = this.validatedActivePropertyArtifacts.get(prepared)
    if (!artifact) {
      throw new Error(
        '[PropsManager] Expected an owner-issued one-shot prepared active property batch'
      )
    }
    this.validatedActivePropertyArtifacts.delete(prepared)
    if (verifyEntryExact) {
      measurePropertyBatchPhase('props-manager:active-enter-exact', () => {
        artifact.components.forEach((snapshot, index) => {
          const instance = artifact.instances[index]
          if (
            !instance ||
            this.getPropertyById(snapshot.id) !== instance ||
            !isEqual(instance.save(), snapshot)
          ) {
            throw new Error(
              `[PropsManager] Active property batch changed exact component data for "${snapshot.id}"`
            )
          }
        })
      })
    }

    const batch: ActivePropertyBatchState = {
      changeStart: this.changes.length,
      componentIds: new Set(prepared.componentIds),
      components: artifact.instances,
      snapshots: artifact.components
    }
    this.activePropertyBatch = batch
    try {
      measurePropertyBatchPhase('props-manager:active-rebind-relations', () => {
        batch.components.forEach((component, index) => {
          const snapshot = batch.snapshots[index]
          if (
            snapshot &&
            getPropertyComponentCanonicalChildRelation(snapshot.type)
          ) {
            component.load(clonePropsValue(snapshot))
            this.refreshRelationshipOwnerEdges(component, snapshot)
          }
        })
      })
      const result = measurePropertyBatchPhase(
        'props-manager:active-operation',
        () =>
          runWithPropertyComponentAccessor(this.componentAccessor, operation)
      )
      const changed = measurePropertyBatchPhase(
        'props-manager:active-exit-exact',
        () =>
          this.changes.length !== batch.changeStart ||
          batch.components.some(
            (component, index) =>
              this.getPropertyById(prepared.componentIds[index]) !==
                component || !isEqual(component.save(), batch.snapshots[index])
          )
      )
      if (changed) {
        this.restoreActivePropertyBatch(batch)
        throw new Error(
          '[PropsManager] Active property reuse batch cannot update active property'
        )
      }
      return result
    } catch (error) {
      this.restoreActivePropertyBatch(batch)
      throw error
    } finally {
      if (this.activePropertyBatch === batch) {
        this.activePropertyBatch = null
      }
    }
  }

  preflightRestoreProperties(
    snapshot: unknown,
    ownerRelations: unknown
  ): PreparedPropsRestore {
    if (
      !isRecord(snapshot) ||
      !Array.isArray(snapshot.components) ||
      !Array.isArray(ownerRelations)
    ) {
      throw new Error(
        '[PropsManager] Invalid property restore: exact snapshot and owner relations are required'
      )
    }

    const validatedSnapshot = clonePropsValue(
      snapshot as unknown as PropsRestoreSnapshot
    )
    const validatedRelations = clonePropsValue(
      ownerRelations as ElementPropertyRelation[]
    )
    const components = validatedSnapshot.components
    const componentIds = components.map(({ id }) => id)
    if (
      componentIds.some((componentId) => typeof componentId !== 'string') ||
      new Set(componentIds).size !== componentIds.length
    ) {
      throw new Error(
        '[PropsManager] Invalid property restore: duplicate or invalid component id'
      )
    }

    const componentById = new Map(
      components.map((component) => [component.id, component] as const)
    )
    components.forEach((component) => {
      if (
        !isRecord(component) ||
        typeof component.id !== 'string' ||
        component.id.length === 0 ||
        typeof component.type !== 'string' ||
        component.type.length === 0
      ) {
        throw new Error(
          '[PropsManager] Invalid property restore: malformed component data'
        )
      }
      if (!getPropertyComponent(component.type)) {
        throw new Error(
          `[PropsManager] Invalid property restore: unregistered property type "${component.type}"`
        )
      }
      if (this.getPropertyById(component.id)) {
        throw new Error(
          `[PropsManager] Invalid property restore: active property "${component.id}" already exists`
        )
      }
    })

    const relationKeys = new Set<string>()
    validatedRelations.forEach((relation) => {
      if (
        !isRecord(relation) ||
        typeof relation.ownerElementId !== 'string' ||
        typeof relation.ownerElementType !== 'string' ||
        typeof relation.ownerPropertyName !== 'string' ||
        typeof relation.componentId !== 'string'
      ) {
        throw new Error(
          '[PropsManager] Invalid property restore: malformed owner relation'
        )
      }
      const relationKey = `${relation.ownerElementId}:${relation.ownerPropertyName}`
      if (relationKeys.has(relationKey)) {
        throw new Error(
          `[PropsManager] Invalid property restore: duplicate owner relation "${relationKey}"`
        )
      }
      relationKeys.add(relationKey)
      const component = componentById.get(relation.componentId)
      if (!component) {
        throw new Error(
          `[PropsManager] Invalid property restore: missing owner data for "${relation.componentId}"`
        )
      }
      const definition = elementPropertyRegistry.getForComponent(
        relation.ownerElementType,
        relation.ownerPropertyName
      )
      if (!definition || definition.type !== component.type) {
        throw new Error(
          `[PropsManager] Invalid property restore: malformed owner relation for "${relation.componentId}"`
        )
      }
    })

    const reachableSnapshotIds = new Set<string>()
    const visit = (componentId: string): void => {
      if (reachableSnapshotIds.has(componentId)) return
      const component = componentById.get(componentId)
      if (!component) return
      reachableSnapshotIds.add(componentId)
      const childRelation = getPropertyComponentCanonicalChildRelation(
        component.type
      )
      if (!childRelation) return
      const childIds = (component as unknown as Record<string, unknown>)[
        childRelation.key
      ]
      if (
        !Array.isArray(childIds) ||
        childIds.some((childId) => typeof childId !== 'string') ||
        new Set(childIds).size !== childIds.length
      ) {
        throw new Error(
          `[PropsManager] Invalid property restore: malformed child relation for "${componentId}"`
        )
      }
      childIds.forEach((childId) => {
        const snapshotChild = componentById.get(childId)
        const activeChild = this.getPropertyById(childId)
        const childType = snapshotChild?.type ?? activeChild?.get('type')
        if (!childType) {
          throw new Error(
            `[PropsManager] Invalid property restore: missing relation child "${childId}"`
          )
        }
        if (childType !== childRelation.childType) {
          throw new Error(
            `[PropsManager] Invalid property restore: malformed child relation type for "${childId}"`
          )
        }
        if (snapshotChild) visit(childId)
      })
    }
    validatedRelations.forEach(({ componentId }) => visit(componentId))
    if (reachableSnapshotIds.size !== components.length) {
      throw new Error(
        '[PropsManager] Invalid property restore: missing owner relation for snapshot component data'
      )
    }

    const preparedEntries = components.map((component) => {
      const tombstone = this._deletedMap.get(component.id)
      let strategy: PropsRestoreStrategy = 'materialize'
      if (tombstone) {
        if (
          tombstone.get('type') !== component.type ||
          !isEqual(tombstone.save(), component)
        ) {
          throw new Error(
            `[PropsManager] Invalid property restore: incompatible tombstone for "${component.id}"`
          )
        }
        strategy = 'reuse'
      }
      return Object.freeze({ componentId: component.id, strategy })
    })
    const prepared: PreparedPropsRestore = Object.freeze({
      kind: 'prepared-props-restore',
      entries: Object.freeze(preparedEntries),
      ownerRelations: Object.freeze(
        validatedRelations.map((relation) => Object.freeze(relation))
      )
    })
    this.validatedRestoreArtifacts.set(prepared, {
      snapshot: validatedSnapshot
    })
    return prepared
  }

  applyRestoreProperties(
    prepared: PreparedPropsRestore,
    options?: EVENT_OPTIONS
  ): readonly string[] {
    const artifact = this.validatedRestoreArtifacts.get(prepared)
    if (!artifact) {
      throw new Error(
        '[PropsManager] Expected an owner-issued one-shot prepared property restore'
      )
    }
    this.validatedRestoreArtifacts.delete(prepared)

    const snapshotById = new Map(
      artifact.snapshot.components.map(
        (component) => [component.id, component] as const
      )
    )
    const materialized = new Map<string, PropertyComponentInstanceTypes>()
    try {
      prepared.entries.forEach(({ componentId, strategy }) => {
        const data = snapshotById.get(componentId)
        if (!data || this.getPropertyById(componentId)) {
          throw new Error(
            `[PropsManager] Cannot apply property restore: stale component "${componentId}"`
          )
        }
        if (strategy === 'reuse') {
          const tombstone = this.getRestoreComponentById(componentId)
          if (
            !tombstone ||
            tombstone.get('type') !== data.type ||
            !isEqual(tombstone.save(), data)
          ) {
            throw new Error(
              `[PropsManager] Cannot apply property restore: stale tombstone "${componentId}"`
            )
          }
          materialized.set(componentId, tombstone)
          return
        }
        if (strategy !== 'materialize') {
          throw new Error(
            `[PropsManager] Cannot apply property restore: invalid strategy for "${componentId}"`
          )
        }
        const component = runWithPropertyComponentAccessor(
          this.componentAccessor,
          () => createProperty(data)
        )
        if (
          component.get('id') !== componentId ||
          !isEqual(component.save(), data)
        ) {
          ;(component as unknown as { dispose?: () => void }).dispose?.()
          throw new Error(
            `[PropsManager] Cannot apply property restore: exact materialization failed for "${componentId}"`
          )
        }
        materialized.set(componentId, component)
      })
    } catch (error) {
      materialized.forEach((component, componentId) => {
        if (!this._deletedMap.has(componentId)) {
          ;(component as unknown as { dispose?: () => void }).dispose?.()
        }
      })
      throw error
    }

    const appliedIds: string[] = []
    const changeStart = this.changes.length
    try {
      prepared.entries.forEach(({ componentId }) => {
        const component = materialized.get(componentId)
        const data = snapshotById.get(componentId)
        if (!component || !data) {
          throw new Error(
            `[PropsManager] Cannot apply property restore: missing prepared component "${componentId}"`
          )
        }
        this.addToMap(component)
        appliedIds.push(componentId)
        runWithPropertyComponentAccessor(this.componentAccessor, () =>
          component.load(data)
        )
        this.refreshRelationshipOwnerEdges(component, data)
        if (!isEqual(component.save(), data)) {
          throw new Error(
            `[PropsManager] Cannot apply property restore: exact data changed for "${componentId}"`
          )
        }
        this.addChangeForAddProperty(component)
      })
    } catch (error) {
      this.changes.splice(changeStart)
      appliedIds.reverse().forEach((componentId) => {
        const component = this.unregisterActiveComponent(componentId)
        const strategy = prepared.entries.find(
          (entry) => entry.componentId === componentId
        )?.strategy
        if (component && strategy === 'reuse') {
          this._deletedMap.set(componentId, component)
        } else {
          ;(component as unknown as { dispose?: () => void }).dispose?.()
        }
      })
      throw error
    }

    if (appliedIds.length > 0) {
      acknowledgeTransactionReplayApplied()
      this.commitChanges(options)
    }
    return Object.freeze([...appliedIds])
  }

  addChangeForAddProperty(property: PropertyComponentInstanceTypes) {
    this.addChange({
      eventName: EventTypes.ADD_PROPERTY,
      data: [clonePropsValue(property.save())],
      action: PROPS_ACTIONS.ADD_PROPERTY,
      undoType: EventTypes.REMOVE_PROPERTY,
      undoAction: EventTypes.REMOVE_PROPERTY
    })
  }

  private addChangeForAddProperties(
    properties: readonly PropertyComponentInstanceTypes[],
    detachSnapshots = true
  ) {
    const snapshots = measurePropertyBatchPhase(
      'props-manager:creation-evidence-save',
      () => properties.map((property) => property.save())
    )
    const data = detachSnapshots
      ? measurePropertyBatchPhase('props-manager:creation-evidence-clone', () =>
          clonePropsValue(snapshots)
        )
      : snapshots
    this.addChange({
      eventName: EventTypes.ADD_PROPERTY,
      data,
      action: PROPS_ACTIONS.ADD_PROPERTY,
      undoType: EventTypes.REMOVE_PROPERTY,
      undoAction: EventTypes.REMOVE_PROPERTY
    })
  }

  addChangeForRemoveProperty(property: PropertyComponentInstanceTypes) {
    this.addChange({
      eventName: EventTypes.REMOVE_PROPERTY,
      data: [clonePropsValue(property.save())],
      action: PROPS_ACTIONS.REMOVE_PROPERTY,
      undoType: EventTypes.ADD_PROPERTY,
      undoAction: EventTypes.ADD_PROPERTY
    })
  }

  private instantiateProperty(
    propData: Partial<PropertyComponentRawData>,
    constructor?: PropertyComponentConstructor
  ): PropertyComponentInstanceTypes {
    if (!propData.type) {
      throw new Error('Type is required!')
    }

    const data = {
      ...propData,
      type: propData.type as PropertyType
    }
    return constructor
      ? createPropertyWithConstructor(data, constructor)
      : (createProperty(data) as PropertyComponentInstanceTypes)
  }

  private stagePropertyCreation(
    newProperty: PropertyComponentInstanceTypes,
    componentAccessReady = true
  ): void {
    const batch = this.propertyCreationBatch
    if (!batch) {
      throw new Error(
        '[PropsManager] Canonical property creation requires an active property creation batch'
      )
    }
    const propertyId = newProperty.get('id')
    if (
      typeof propertyId !== 'string' ||
      propertyId.length === 0 ||
      batch.componentIds.has(propertyId) ||
      this._components.has(propertyId) ||
      this._deletedMap.has(propertyId)
    ) {
      ;(newProperty as unknown as { dispose?: () => void }).dispose?.()
      throw new Error(
        `[PropsManager] Canonical property creation batch has duplicate property "${propertyId}"`
      )
    }
    batch.componentIds.add(propertyId)
    batch.components.push(newProperty)
    if (componentAccessReady) {
      batch.stagedById.set(propertyId, newProperty)
    }
  }

  private assertPropertyCreationRegistrationReadiness(
    registrationContracts: readonly PropertyCreationTypeContract[],
    deferredTypes: ReadonlySet<string>
  ): void {
    registrationContracts.forEach((registrationContract) => {
      const currentChildRelation = snapshotPropertyChildRelation(
        getPropertyComponentCanonicalChildRelation(registrationContract.type)
      )
      if (
        getPropertyComponentRegistrationRevision(registrationContract.type) !==
          registrationContract.componentRegistrationRevision ||
        getPropertySchemaRegistrationRevision(registrationContract.type) !==
          registrationContract.schemaRegistrationRevision ||
        getPropertyComponent(registrationContract.type) !==
          registrationContract.constructor ||
        !arePropertyChildRelationsEqual(
          currentChildRelation,
          registrationContract.childRelation
        ) ||
        !isEqual(
          snapshotPropertySchema(
            getRegisteredPropertySchema(registrationContract.type)
          ),
          registrationContract.schema
        ) ||
        (deferredTypes.has(registrationContract.type) &&
          (!registrationContract.childRelation ||
            !isPropertyComponentBatchRebindable(
              registrationContract.constructor,
              registrationContract.childRelation
            )))
      ) {
        throw new Error(
          `[PropsManager] Canonical property creation registration changed for "${registrationContract.type}"`
        )
      }
    })
  }

  private getNormalizedPropertyRelationshipRebindOrder(
    components: readonly PropertyComponentInstanceTypes[],
    registrationContracts: readonly PropertyCreationTypeContract[],
    deferredComponentIds: ReadonlySet<string>
  ): readonly string[] {
    const componentById = new Map(
      components.map((component) => [component.get('id'), component] as const)
    )
    const registrationContractByType = new Map(
      registrationContracts.map(
        (registrationContract) =>
          [registrationContract.type, registrationContract] as const
      )
    )
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const ordered: string[] = []
    const visit = (componentId: string): void => {
      if (visited.has(componentId)) {
        return
      }
      if (visiting.has(componentId)) {
        throw new Error(
          `[PropsManager] Canonical property creation has a relationship cycle at "${componentId}"`
        )
      }
      const component = componentById.get(componentId)
      if (!component) {
        throw new Error(
          `[PropsManager] Canonical property creation batch cannot rebind property "${componentId}"`
        )
      }
      const type = component.get('type')
      const childRelation =
        typeof type === 'string'
          ? registrationContractByType.get(type)?.childRelation
          : undefined
      if (!childRelation) {
        throw new Error(
          `[PropsManager] Canonical property creation batch cannot rebind property "${componentId}"`
        )
      }

      visiting.add(componentId)
      const saved = component.save() as Record<string, unknown>
      const savedChildIds = saved[childRelation.key]
      const childIds = savedChildIds === undefined ? [] : savedChildIds
      if (
        !Array.isArray(childIds) ||
        childIds.some((childId) => typeof childId !== 'string') ||
        new Set(childIds).size !== childIds.length
      ) {
        throw new Error(
          `[PropsManager] Canonical property creation has malformed child relation for "${componentId}"`
        )
      }
      childIds.forEach((childId) => {
        const sourceChild = componentById.get(childId)
        const childType =
          sourceChild?.get('type') ?? this.getPropertyById(childId)?.get('type')
        if (!childType) {
          throw new Error(
            `[PropsManager] Canonical property creation is missing relation child "${childId}"`
          )
        }
        if (childType !== childRelation.childType) {
          throw new Error(
            `[PropsManager] Canonical property creation child "${childId}" has the wrong type`
          )
        }
        if (sourceChild && deferredComponentIds.has(childId)) {
          visit(childId)
        }
      })
      visiting.delete(componentId)
      visited.add(componentId)
      ordered.push(componentId)
    }

    deferredComponentIds.forEach(visit)
    return Object.freeze(ordered)
  }

  private createAndRegisterPropertyBatch(
    sourceComponents: readonly Partial<PropertyComponentRawData>[],
    registrationContracts: readonly PropertyCreationTypeContract[],
    parentFirstDeclarativeComponentIds: readonly string[],
    sourceSemantics: PropertyCreationSourceSemantics
  ): readonly PropertyComponentInstanceTypes[] {
    const batch = this.propertyCreationBatch
    if (!batch) {
      throw new Error(
        '[PropsManager] Canonical property batch requires an active property creation batch'
      )
    }
    if (sourceComponents.length === 0) {
      throw new Error(
        '[PropsManager] Canonical property batch requires property components'
      )
    }

    const parentFirstIds = new Set(parentFirstDeclarativeComponentIds)
    const registrationContractByType = new Map(
      registrationContracts.map(
        (registrationContract) =>
          [registrationContract.type, registrationContract] as const
      )
    )
    const resolveBatchPropertySchema = (
      type: string
    ): PropertySchema | undefined => {
      const registrationContract = registrationContractByType.get(type)
      return registrationContract
        ? registrationContract.schema
        : getRegisteredPropertySchema(type)
    }
    const deferredTypes = new Set(
      sourceComponents.flatMap((sourceComponent) =>
        typeof sourceComponent.id === 'string' &&
        parentFirstIds.has(sourceComponent.id) &&
        typeof sourceComponent.type === 'string'
          ? [sourceComponent.type]
          : []
      )
    )
    measurePropertyBatchPhase('props-manager:creation-registry-readiness', () =>
      this.assertPropertyCreationRegistrationReadiness(
        registrationContracts,
        deferredTypes
      )
    )
    const components = measurePropertyBatchPhase(
      'props-manager:creation-materialize',
      () =>
        runWithPropertySchemaResolver(resolveBatchPropertySchema, () =>
          sourceComponents.map((sourceComponent) => {
            const registrationContract =
              typeof sourceComponent.type === 'string'
                ? registrationContractByType.get(sourceComponent.type)
                : undefined
            if (!registrationContract) {
              throw new Error(
                `[PropsManager] Canonical property creation registration changed for "${sourceComponent.id ?? ''}"`
              )
            }
            const component = this.instantiateProperty(
              sourceComponent,
              registrationContract.constructor
            )
            this.stagePropertyCreation(
              component,
              typeof sourceComponent.id !== 'string' ||
                !parentFirstIds.has(sourceComponent.id)
            )
            return component
          })
        )
    )
    measurePropertyBatchPhase(
      'props-manager:creation-post-materialize-readiness',
      () =>
        this.assertPropertyCreationRegistrationReadiness(
          registrationContracts,
          deferredTypes
        )
    )
    measurePropertyBatchPhase(
      'props-manager:creation-relationship-rebind',
      () =>
        runWithPropertySchemaResolver(resolveBatchPropertySchema, () => {
          const relationshipRebindIds =
            sourceSemantics === 'normalize-partial'
              ? this.getNormalizedPropertyRelationshipRebindOrder(
                  components,
                  registrationContracts,
                  parentFirstIds
                )
              : parentFirstDeclarativeComponentIds
          const sourceIndexById = new Map(
            sourceComponents.map((sourceComponent, index) => [
              sourceComponent.id,
              index
            ])
          )
          relationshipRebindIds.forEach((componentId) => {
            const index = sourceIndexById.get(componentId)
            if (index === undefined) {
              throw new Error(
                `[PropsManager] Canonical property creation batch cannot rebind property "${componentId}"`
              )
            }
            const sourceComponent = sourceComponents[index]
            if (!sourceComponent || typeof sourceComponent.id !== 'string') {
              throw new Error(
                `[PropsManager] Canonical property creation batch cannot rebind property "${componentId}"`
              )
            }
            const component = components[index]
            if (!component || component.get('id') !== componentId) {
              throw new Error(
                `[PropsManager] Canonical property creation batch cannot rebind property "${componentId}"`
              )
            }
            component.load(sourceComponent as PropertyComponentRawData)
            batch.stagedById.set(componentId, component)
          })
        })
    )
    measurePropertyBatchPhase(
      'props-manager:creation-pre-register-readiness',
      () =>
        this.assertPropertyCreationRegistrationReadiness(
          registrationContracts,
          deferredTypes
        )
    )
    measurePropertyBatchPhase('props-manager:creation-register', () =>
      this.registerMany(components)
    )
    return Object.freeze([...components])
  }

  registerMany(
    components: readonly PropertyComponentInstanceTypes[],
    trustedStagedBatch?: PropertyCreationBatchState
  ): void {
    const batch = this.propertyCreationBatch
    const trustsStagedOwner =
      trustedStagedBatch !== undefined &&
      trustedStagedBatch === batch &&
      components === batch.components
    if (trustedStagedBatch !== undefined && !trustsStagedOwner) {
      throw new Error(
        '[PropsManager] Trusted property registration requires the active staged owner batch'
      )
    }
    if (!trustsStagedOwner) {
      const observedIds = new Set<string>()
      components.forEach((component) => {
        const propertyId = component.get('id')
        if (
          typeof propertyId !== 'string' ||
          propertyId.length === 0 ||
          observedIds.has(propertyId) ||
          (batch !== null && batch.stagedById.get(propertyId) !== component) ||
          this._components.has(propertyId) ||
          this._deletedMap.has(propertyId)
        ) {
          throw new Error(
            `[PropsManager] Canonical property creation batch cannot register property "${propertyId}"`
          )
        }
        observedIds.add(propertyId)
      })
    }
    const relationshipEntries = components.map((component) =>
      this.prepareRelationshipIndexEntry(component)
    )
    components.forEach((component, index) => {
      this.registerActiveComponent(component, relationshipEntries[index])
    })
    if (components.length > 0) {
      this.advancePropertyStateRevision()
    }
  }

  private finalizeOrdinaryPropertyCreationBatch(
    batch: PropertyCreationBatchState
  ): void {
    if (batch.components.length > 0) {
      this.registerMany(batch.components, batch)
    }
  }

  private createPropertyInternal(
    propData: Partial<PropertyComponentRawData>,
    source: 'owner-root' | 'relationship-child'
  ) {
    if (this.activePropertyBatch) {
      throw new Error(
        '[PropsManager] Active property reuse batch cannot create property'
      )
    }

    const batch = this.propertyCreationBatch
    let materializationData = propData
    if (batch && source === 'owner-root') {
      const preparedRoot =
        batch.ordinaryRootCreations[batch.ordinaryRootCreationIndex]
      if (preparedRoot) {
        if (propData.type !== preparedRoot.type) {
          throw new Error(
            `[PropsManager] Ordinary property creation materialized an unexpected root for "${preparedRoot.name}"`
          )
        }
        batch.ordinaryRootCreationIndex += 1
        materializationData = {
          ...propData,
          ...preparedRoot.creationData,
          type: preparedRoot.type
        } as Partial<PropertyComponentRawData>
      }
    }

    const create = () => this.instantiateProperty(materializationData)
    const newProperty = this.propertyCreationBatch
      ? create()
      : runWithPropertyComponentAccessor(this.componentAccessor, create)
    if (this.propertyCreationBatch) {
      this.stagePropertyCreation(newProperty)
      if (typeof materializationData.id === 'string') {
        this.propertyCreationBatch.explicitCreationIdByComponent.set(
          newProperty,
          materializationData.id
        )
      }
    } else {
      this.addChangeForAddProperty(newProperty)
    }
    return newProperty
  }

  createProperty(propData: Partial<PropertyComponentRawData>) {
    return this.createPropertyInternal(propData, 'owner-root')
  }

  private rollbackPropertyCreationBatch(batch: PropertyCreationBatchState) {
    runWithPropertySchemaResolver(
      (type) =>
        batch.activeSchemaByType.has(type)
          ? batch.activeSchemaByType.get(type)
          : getRegisteredPropertySchema(type),
      () => {
        batch.existingUpdates
          .slice()
          .reverse()
          .forEach((change) => {
            const component = this._components.get(change.id)
            if (!component) {
              return
            }
            component.load({
              ...component.save(),
              [change.key]: clonePropsValue(change.before)
            })
            this.refreshRelationshipOwnerEdges(component)
            component.emitChange({
              id: change.id,
              key: change.key,
              before: clonePropsValue(change.after),
              after: clonePropsValue(change.before)
            })
          })
      }
    )
    batch.components
      .slice()
      .reverse()
      .forEach((component) => {
        const propertyId = component.get('id')
        if (this._components.get(propertyId) === component) {
          this.unregisterActiveComponent(propertyId)
        }
        ;(component as unknown as { dispose?: () => void }).dispose?.()
      })
    this.changes.splice(batch.changeStart)
  }

  runInPropertyCreationBatch<T>(
    operation: () => T,
    preparedOrdinaryBatch?: PreparedOrdinaryPropertyCreationBatch
  ): PropertyCreationBatchReceipt<T> {
    if (this.propertyCreationBatch) {
      if (preparedOrdinaryBatch) {
        throw new Error(
          '[PropsManager] A prepared ordinary property creation batch cannot enter a nested creation batch'
        )
      }
      return Object.freeze({
        result: operation(),
        rollback: () => undefined,
        complete: () => undefined
      })
    }

    const ordinaryArtifact = preparedOrdinaryBatch
      ? this.validatedOrdinaryPropertyCreationArtifacts.get(
          preparedOrdinaryBatch
        )
      : undefined
    if (preparedOrdinaryBatch && !ordinaryArtifact) {
      throw new Error(
        '[PropsManager] Expected an owner-issued one-shot prepared ordinary property creation batch'
      )
    }
    if (preparedOrdinaryBatch) {
      this.validatedOrdinaryPropertyCreationArtifacts.delete(
        preparedOrdinaryBatch
      )
    }
    if (ordinaryArtifact) {
      this.assertPropertyCreationRegistrationReadiness(
        ordinaryArtifact.registrationContracts,
        new Set()
      )
      ordinaryArtifact.roots.forEach(({ requestedId, activeComponent }) => {
        if (
          requestedId &&
          (this._components.get(requestedId) !== activeComponent ||
            this._deletedMap.has(requestedId))
        ) {
          throw new Error(
            `[PropsManager] Ordinary property creation property "${requestedId}" is no longer available`
          )
        }
      })
    }

    const activeSchemaByType = new Map<string, PropertySchema | undefined>()
    if (!ordinaryArtifact) {
      this._components.forEach((component) => {
        const type = component.get('type')
        if (typeof type === 'string' && !activeSchemaByType.has(type)) {
          activeSchemaByType.set(
            type,
            snapshotPropertySchema(getRegisteredPropertySchema(type))
          )
        }
      })
    }
    const batch: PropertyCreationBatchState = {
      changeStart: this.changes.length,
      components: [],
      componentIds: new Set(),
      stagedById: new Map(),
      rootComponents: [],
      rootComponentIds: new Set(),
      explicitCreationIdByComponent: new Map(),
      existingUpdates: [],
      activeSchemaByType,
      ordinaryRootCreations:
        ordinaryArtifact?.roots.filter(
          ({ activeComponent }) => !activeComponent
        ) ?? Object.freeze([]),
      ordinaryRootCreationIndex: 0
    }
    this.propertyCreationBatch = batch
    try {
      const result = measurePropertyBatchPhase(
        'props-manager:creation-operation',
        () =>
          runWithPropertyComponentAccessor(this.componentAccessor, operation)
      )
      measurePropertyBatchPhase('props-manager:creation-finalize', () => {
        const operationChanges = this.changes.slice(batch.changeStart)
        if (
          operationChanges.length !== batch.existingUpdates.length ||
          operationChanges.some(
            (change, index) => change !== batch.existingUpdates[index]
          )
        ) {
          throw new Error(
            '[PropsManager] Canonical property creation batch produced incompatible pending changes'
          )
        }
        if (ordinaryArtifact) {
          this.finalizeOrdinaryPropertyCreationBatch(batch)
        } else {
          const stagedComponents = batch.components.filter(
            (component) =>
              this._components.get(component.get('id')) !== component
          )
          if (stagedComponents.length > 0) {
            this.registerMany(stagedComponents)
          }
        }
        batch.components.forEach((component) => {
          const propertyId = component.get('id')
          if (this._components.get(propertyId) !== component) {
            throw new Error(
              `[PropsManager] Canonical property creation batch did not register property "${propertyId}"`
            )
          }
        })
      })
      if (batch.components.length > 0) {
        measurePropertyBatchPhase('props-manager:creation-evidence', () => {
          this.addChangeForAddProperties(batch.components, !ordinaryArtifact)
        })
      }
      let active = true
      return Object.freeze({
        result,
        rollback: () => {
          if (!active) {
            return
          }
          active = false
          this.rollbackPropertyCreationBatch(batch)
        },
        complete: () => {
          active = false
        }
      })
    } catch (error) {
      this.propertyCreationBatch = null
      this.rollbackPropertyCreationBatch(batch)
      throw error
    } finally {
      if (this.propertyCreationBatch === batch) {
        this.propertyCreationBatch = null
      }
    }
  }

  addProperty(
    propComponents: readonly PropertyComponentInstanceTypes[]
  ): Record<PropertyType, string> {
    if (this.propertyCreationBatch) {
      const components = propComponents.filter(
        (component): component is PropertyComponentInstanceTypes =>
          Boolean(component)
      )
      components.forEach((component) => {
        const componentId = component.get('id')
        if (
          this.propertyCreationBatch?.stagedById.get(componentId) !==
            component ||
          this.propertyCreationBatch.rootComponentIds.has(componentId)
        ) {
          throw new Error(
            `[PropsManager] Canonical property creation batch cannot register active owner property "${componentId}"`
          )
        }
      })
      const result = components.reduce(
        (propertyIds, component) => {
          propertyIds[component.get('type')] = component.get('id')
          return propertyIds
        },
        {} as Record<PropertyType, string>
      )
      components.forEach((component) => {
        this.propertyCreationBatch?.rootComponents.push(component)
        this.propertyCreationBatch?.rootComponentIds.add(component.get('id'))
      })
      return result
    }

    return propComponents.reduce(
      (acc, com) => {
        if (!com) {
          return acc
        }

        this.addToMap(com)
        acc[com.get('type')] = com.get('id')
        return acc
      },
      {} as Record<PropertyType, string>
    )
  }

  removeProperty(propComponentIds: string[], _options?: EVENT_OPTIONS) {
    propComponentIds.forEach((propComponentId) => {
      const component = this.getPropertyById(propComponentId)
      if (!component) {
        return
      }

      this.addChangeForRemoveProperty(component)
      this.removeFromMap(propComponentId)
    })
  }

  preparePropertyMutationBatch(
    sourceRequest: unknown
  ): PreparedPropertyMutationBatch {
    if (
      !isRecord(sourceRequest) ||
      !Array.isArray(sourceRequest.operations) ||
      (sourceRequest.options !== undefined && !isRecord(sourceRequest.options))
    ) {
      throw new Error(
        '[PropsManager] Property mutation batch requires an operations request'
      )
    }
    if (sourceRequest.operations.length > 0 && this.changes.length > 0) {
      throw new Error(
        '[PropsManager] Property mutation batch cannot start with pending property evidence'
      )
    }

    const mutations = [...sourceRequest.operations] as readonly unknown[]
    const mutationOptions =
      sourceRequest.options === undefined
        ? undefined
        : (clonePropertyDefinitionValue(sourceRequest.options) as EVENT_OPTIONS)
    const activeById = this._components
    const originalSnapshots = new Map<string, PropertyComponentRawData>()
    const workingSnapshots = new Map<string, PropertyComponentRawData>()
    const registrationContractByType = new Map<
      string,
      PropertyCreationTypeContract
    >()
    const ownerDefinitionContractByKey = new Map<
      string,
      PreparedOwnerDefinitionContract
    >()
    const fieldByType = new Map<
      string,
      ReadonlyMap<string, PropertyFieldSchema>
    >()
    const configByType = new Map<
      string,
      ReturnType<typeof getPropertyComponentConfigDefinition>
    >()
    const persistKeysByType = new Map<string, ReadonlySet<string>>()
    const defaultsByType = new Map<string, Readonly<Record<string, unknown>>>()
    const orderedPropertyIds: string[] = []
    const requestedPropertyIds = new Set<string>()
    const touchedPropertyIds: string[] = []
    const touchedPropertyIdSet = new Set<string>()
    const createdComponents = new Map<string, PropertyComponentRawData>()
    const reservedCreationTypesById = new Map<string, string>()
    const reactivatedComponents = new Map<
      string,
      PreparedInactivePropertyCreation
    >()
    const removedCandidateIds: string[] = []
    const removedCandidateIdSet = new Set<string>()
    const exactOrphanCandidateIds = new Set<string>()
    const retainedRootPropertyIdSet = new Set<string>()
    const retainedRootIdentityReads: PreparedRetainedRootIdentityRead[] = []
    const retainedRootRelationshipReads = new Map<
      string,
      PreparedRetainedRootRelationshipRead
    >()
    let hasExactOrphanRemovalMutation = false
    const relationshipMutationRootIds = new Set<string>()
    const updateEvidence: UpdatePropertyChange[] = []
    const replaceLatestHistoryEvidence: UpdatePropertyChange[] = []
    const orderedOwnerIds: string[] = []
    const rootPropertyIdsByOwnerId = new Map<string, string[]>()
    const canonicalOwnerIdSetByPropertyId = new Map<string, Set<string>>()
    const canonicalPropertyIdsByOwnerId = new Map<string, string[]>()
    const ownerRelations: ElementPropertyRelation[] = []

    const reserveCreationIdentity = (
      propertyId: string,
      propertyType: string
    ): void => {
      const reservedType = reservedCreationTypesById.get(propertyId)
      if (reservedType !== undefined && reservedType !== propertyType) {
        throw new Error(
          `[PropsManager] Property mutation reserves conflicting types for "${propertyId}"`
        )
      }
      reservedCreationTypesById.set(propertyId, propertyType)
    }
    mutations.forEach((sourceMutation) => {
      if (!isRecord(sourceMutation)) {
        return
      }
      if (
        sourceMutation.kind === 'create-owner-properties' &&
        Array.isArray(sourceMutation.definitions) &&
        isRecord(sourceMutation.propertyIds)
      ) {
        const propertyIds = sourceMutation.propertyIds
        sourceMutation.definitions.forEach((definition) => {
          if (
            !isRecord(definition) ||
            typeof definition.name !== 'string' ||
            typeof definition.type !== 'string'
          ) {
            return
          }
          const propertyId = propertyIds[definition.name]
          if (typeof propertyId === 'string' && propertyId.length > 0) {
            reserveCreationIdentity(propertyId, definition.type)
          }
        })
        return
      }
      if (
        sourceMutation.kind === 'create-exact-property-graph' &&
        Array.isArray(sourceMutation.components)
      ) {
        sourceMutation.components.forEach((component) => {
          if (
            isRecord(component) &&
            typeof component.id === 'string' &&
            component.id.length > 0 &&
            typeof component.type === 'string' &&
            component.type.length > 0
          ) {
            reserveCreationIdentity(component.id, component.type)
          }
        })
      }
    })

    const captureContract = (type: string): PropertyCreationTypeContract =>
      this.capturePropertyCreationTypeContract(type, registrationContractByType)
    const captureOwnerDefinition = (
      ownerElementType: string,
      ownerPropertyName: string,
      expectedPropertyType: string
    ): PropertyDefinition => {
      const key = `${ownerElementType}:${ownerPropertyName}`
      const current = elementPropertyRegistry.getForComponent(
        ownerElementType,
        ownerPropertyName
      )
      if (
        !current ||
        current.name !== ownerPropertyName ||
        current.type !== expectedPropertyType
      ) {
        throw new Error(
          `[PropsManager] Detached property creation has an invalid owner relation for "${key}"`
        )
      }
      const existing = ownerDefinitionContractByKey.get(key)
      if (existing) {
        if (!isEqual(existing.definition, current)) {
          throw new Error(
            `[PropsManager] Detached property creation owner definition registration changed for "${key}"`
          )
        }
        return existing.definition
      }
      const definition = deepFreezePropertyContract(
        clonePropertyDefinitionValue(current) as PropertyDefinition
      )
      ownerDefinitionContractByKey.set(
        key,
        Object.freeze({
          ownerElementType,
          ownerPropertyName,
          definition
        })
      )
      return definition
    }
    const captureActiveSnapshot = (
      propertyId: string
    ): PropertyComponentRawData | undefined => {
      const existing = workingSnapshots.get(propertyId)
      if (existing) {
        return existing
      }
      const component = activeById.get(propertyId)
      if (!component) {
        return
      }
      const snapshot = deepFreezePropertyContract(
        clonePropsValue(component.save())
      )
      originalSnapshots.set(propertyId, snapshot)
      const workingSnapshot = clonePropsValue(snapshot)
      workingSnapshots.set(propertyId, workingSnapshot)
      return workingSnapshot
    }
    const getFieldByKey = (
      contract: PropertyCreationTypeContract
    ): ReadonlyMap<string, PropertyFieldSchema> => {
      const existing = fieldByType.get(contract.type)
      if (existing) {
        return existing
      }
      const fields = new Map(
        contract.schema?.fields.map((field) => [field.key, field] as const) ??
          []
      )
      fieldByType.set(contract.type, fields)
      return fields
    }
    const getComponentConfig = (
      type: string
    ): ReturnType<typeof getPropertyComponentConfigDefinition> => {
      if (!configByType.has(type)) {
        configByType.set(type, getPropertyComponentConfigDefinition(type))
      }
      return configByType.get(type)
    }
    const getPersistKeys = (type: string): ReadonlySet<string> => {
      const existing = persistKeysByType.get(type)
      if (existing) {
        return existing
      }
      const config = getComponentConfig(type)
      const keys = new Set(
        config ? resolvePropertyComponentConfigRoles(config).persistKeys : []
      )
      persistKeysByType.set(type, keys)
      return keys
    }
    const getDefaultValues = (
      contract: PropertyCreationTypeContract
    ): Readonly<Record<string, unknown>> => {
      const existing = defaultsByType.get(contract.type)
      if (existing) {
        return existing
      }
      const values: Record<string, unknown> = {}
      const config = getComponentConfig(contract.type)
      const defaults = config?.defaults
      getPersistKeys(contract.type).forEach((key) => {
        if (
          defaults &&
          Object.prototype.hasOwnProperty.call(defaults, key) &&
          defaults[key] !== undefined
        ) {
          values[key] = clonePropsValue(defaults[key])
        }
      })
      if (!config) {
        contract.schema?.fields.forEach((field) => {
          if (
            !Object.prototype.hasOwnProperty.call(values, field.key) &&
            field.defaultValue !== undefined
          ) {
            values[field.key] = clonePropsValue(field.defaultValue)
          }
        })
      }
      const frozen = deepFreezePropertyContract(values)
      defaultsByType.set(contract.type, frozen)
      return frozen
    }
    const touchExisting = (propertyId: string): void => {
      if (!touchedPropertyIdSet.has(propertyId)) {
        touchedPropertyIdSet.add(propertyId)
        touchedPropertyIds.push(propertyId)
      }
    }
    const associatePropertyWithOwner = (
      propertyId: string,
      orderedId: string
    ): void => {
      let ownerIdSet = canonicalOwnerIdSetByPropertyId.get(propertyId)
      if (!ownerIdSet) {
        ownerIdSet = new Set()
        canonicalOwnerIdSetByPropertyId.set(propertyId, ownerIdSet)
      }
      if (!ownerIdSet.has(orderedId)) {
        ownerIdSet.add(orderedId)
        const propertyIds = canonicalPropertyIdsByOwnerId.get(orderedId) ?? []
        propertyIds.push(propertyId)
        canonicalPropertyIdsByOwnerId.set(orderedId, propertyIds)
      }
    }
    const captureMutationOwner = (
      propertyId: string,
      orderedId = propertyId
    ): string => {
      let rootPropertyIds = rootPropertyIdsByOwnerId.get(orderedId)
      if (!rootPropertyIds) {
        orderedOwnerIds.push(orderedId)
        rootPropertyIds = []
        rootPropertyIdsByOwnerId.set(orderedId, rootPropertyIds)
      }
      if (!rootPropertyIds.includes(propertyId)) {
        rootPropertyIds.push(propertyId)
      }
      associatePropertyWithOwner(propertyId, orderedId)
      return orderedId
    }
    const addRemovedCandidate = (
      propertyId: string,
      orderedId: string
    ): void => {
      associatePropertyWithOwner(propertyId, orderedId)
      if (!removedCandidateIdSet.has(propertyId)) {
        removedCandidateIdSet.add(propertyId)
        removedCandidateIds.push(propertyId)
      }
    }
    const readRelationIds = (
      snapshot: Readonly<Record<string, unknown>>,
      relation: PropertyChildRelationDefinition,
      ownerLabel: string
    ): string[] => {
      const value = snapshot[relation.key]
      if (
        !Array.isArray(value) ||
        value.some((childId) => typeof childId !== 'string') ||
        new Set(value).size !== value.length
      ) {
        throw new Error(
          `[PropsManager] Property mutation has an invalid relationship "${ownerLabel}.${relation.key}"`
        )
      }
      return [...(value as string[])]
    }
    const assertField = (
      snapshot: Readonly<Record<string, unknown>>,
      contract: PropertyCreationTypeContract,
      propertyId: string,
      key: string,
      value: unknown
    ): void => {
      if (key === 'id' || key === 'type') {
        throw new Error(
          `[PropsManager] Property mutation cannot replace canonical field "${propertyId}.${key}"`
        )
      }
      const field = getFieldByKey(contract).get(key)
      if (!Object.prototype.hasOwnProperty.call(snapshot, key) && !field) {
        throw new Error(
          `[PropsManager] Property mutation has an unknown field "${propertyId}.${key}"`
        )
      }
      if (field && !isRuntimePropertyFieldValueValid(field, value)) {
        throw new Error(
          `[PropsManager] Invalid runtime property field "${propertyId}.${key}" (received ${describeInvalidRuntimePropertyFieldValue(value)})`
        )
      }
    }
    const resolveChildSnapshot = (
      childId: string
    ): PropertyComponentRawData | undefined =>
      createdComponents.get(childId) ?? captureActiveSnapshot(childId)
    const assertRelationIds = (
      childIds: readonly string[],
      relation: PropertyChildRelationDefinition,
      ownerLabel: string,
      identityOnlyChildIds?: ReadonlySet<string>
    ): void => {
      childIds.forEach((childId) => {
        if (identityOnlyChildIds?.has(childId)) {
          const child = activeById.get(childId)
          if (!child || child.get('type') !== relation.childType) {
            throw new Error(
              `[PropsManager] Property mutation "${ownerLabel}" has an invalid relationship child "${childId}"`
            )
          }
          return
        }
        const child = resolveChildSnapshot(childId)
        if (!child || child.type !== relation.childType) {
          throw new Error(
            `[PropsManager] Property mutation "${ownerLabel}" has an invalid relationship child "${childId}"`
          )
        }
      })
    }
    const addUpdateEvidence = (
      propertyId: string,
      key: string,
      before: unknown,
      after: unknown
    ): void => {
      if (isEqual(before, after)) {
        return
      }
      updateEvidence.push({
        action: PROPS_ACTIONS.UPDATE_PROPERTY,
        eventName: EventTypes.UPDATE_PROPERTY,
        id: propertyId,
        key,
        before: clonePropsValue(before) as UpdatePropertyChange['before'],
        after: clonePropsValue(after) as UpdatePropertyChange['after']
      })
    }
    const addReplaceLatestHistoryEvidence = (
      propertyId: string,
      key: string,
      before: unknown,
      after: unknown
    ): void => {
      if (mutationOptions?.history?.mode !== 'replace-latest') {
        return
      }
      replaceLatestHistoryEvidence.push({
        action: PROPS_ACTIONS.UPDATE_PROPERTY,
        eventName: EventTypes.UPDATE_PROPERTY,
        id: propertyId,
        key,
        before: clonePropsValue(before) as UpdatePropertyChange['before'],
        after: clonePropsValue(after) as UpdatePropertyChange['after']
      })
    }
    const creationRelationsByMutationIndex = new Map<
      number,
      readonly ElementPropertyRelation[]
    >()
    const creationOwnerRelationKeys = new Set<string>()
    const reserveCreationOwnerRelation = (
      ownerElementId: string,
      ownerPropertyName: string
    ): void => {
      const key = JSON.stringify([ownerElementId, ownerPropertyName])
      if (creationOwnerRelationKeys.has(key)) {
        throw new Error(
          `[PropsManager] Detached property creation has a duplicate owner relation "${ownerElementId}.${ownerPropertyName}"`
        )
      }
      creationOwnerRelationKeys.add(key)
    }
    const captureCreationActive = (
      propertyId: string
    ): PropertyComponentInstanceTypes | undefined => {
      const component = activeById.get(propertyId)
      if (component) {
        captureActiveSnapshot(propertyId)
      }
      return component
    }
    const prepareCreationRecord = (
      sourceData: Readonly<Record<string, unknown>>,
      expectedType: string,
      ownerLabel: string,
      exact: boolean
    ): PropertyComponentRawData => {
      const contract = captureContract(expectedType)
      const data = clonePropertyDefinitionValue(
        sourceData
      ) as PropertyComponentRawData
      if (
        typeof data.type !== 'string' ||
        data.type !== expectedType ||
        (data.id !== undefined &&
          (typeof data.id !== 'string' || data.id.length === 0))
      ) {
        throw new Error(
          `[PropsManager] Detached property creation has invalid canonical data for "${ownerLabel}"`
        )
      }
      const hasExplicitPropertyId =
        typeof data.id === 'string' && data.id.length > 0
      let propertyId = hasExplicitPropertyId
        ? (data.id as string)
        : id(IDTypes.PROPS)
      while (
        activeById.has(propertyId) ||
        this._deletedMap.has(propertyId) ||
        createdComponents.has(propertyId) ||
        (!hasExplicitPropertyId && reservedCreationTypesById.has(propertyId))
      ) {
        if (hasExplicitPropertyId) {
          throw new Error(
            `[PropsManager] Detached property creation has duplicate or unavailable property id "${data.id}"`
          )
        }
        propertyId = id(IDTypes.PROPS)
      }
      data.id = propertyId
      if (
        activeById.has(propertyId) ||
        this._deletedMap.has(propertyId) ||
        createdComponents.has(propertyId)
      ) {
        throw new Error(
          `[PropsManager] Detached property creation has duplicate or unavailable property id "${propertyId}"`
        )
      }
      assertRuntimePropertyFields(
        data as Readonly<Record<string, unknown>>,
        contract.schema,
        propertyId
      )

      let preparedRecord = data as unknown as Record<string, unknown>
      if (!exact) {
        const config = getComponentConfig(expectedType)
        const sourceRecord = data as unknown as Record<string, unknown>
        preparedRecord = {
          ...(getDefaultValues(contract) as Record<string, unknown>)
        }
        if (config) {
          getPersistKeys(expectedType).forEach((key) => {
            if (
              Object.prototype.hasOwnProperty.call(sourceRecord, key) &&
              sourceRecord[key] !== undefined
            ) {
              preparedRecord[key] = sourceRecord[key]
            }
          })
          if (config.allowDynamicKeys === true) {
            const fixedKeys = new Set([
              ...Object.keys(isRecord(config.defaults) ? config.defaults : {}),
              ...(config.children ? [config.children.key] : [])
            ])
            const reservedKeys = new Set([
              'id',
              'type',
              ...fixedKeys,
              ...(config.dynamicReservedKeys ?? [])
            ])
            Object.entries(sourceRecord).forEach(([key, value]) => {
              if (!reservedKeys.has(key) && value !== undefined) {
                preparedRecord[key] = value
              }
            })
          }
        } else {
          Object.assign(preparedRecord, sourceRecord)
        }
        preparedRecord.id = propertyId
        preparedRecord.type = expectedType
      }
      const relation = contract.childRelation
      if (!exact && relation && preparedRecord[relation.key] === undefined) {
        preparedRecord[relation.key] = []
      }
      const preparedData = preparedRecord as unknown as PropertyComponentRawData
      const prepared = deepFreezePropertyContract(preparedData)
      createdComponents.set(propertyId, prepared)
      return prepared
    }
    const normalizeOrdinaryRelation = (
      value: unknown,
      ownerContract: PropertyCreationTypeContract,
      ownerLabel: string
    ): readonly string[] => {
      const relation = ownerContract.childRelation
      if (!relation) {
        throw new Error(
          `[PropsManager] Detached property creation has an invalid relationship for "${ownerLabel}"`
        )
      }
      let entries:
        | {
            item: unknown
            keyedId: string | undefined
            label: string
          }[]
        | undefined
      if (Array.isArray(value)) {
        entries = value.map((item, index) => ({
          item,
          keyedId: undefined as string | undefined,
          label: `${ownerLabel}[${index}]`
        }))
      } else if (relation.collection === 'array-or-record' && isRecord(value)) {
        entries = Object.entries(value).map(([keyedId, item]) => ({
          item,
          keyedId,
          label: `${ownerLabel}.${keyedId}`
        }))
      }
      if (!entries) {
        throw new Error(
          `[PropsManager] Detached property creation has an invalid relationship descriptor for "${ownerLabel}"`
        )
      }
      const childIds = entries.map(({ item, keyedId, label }) => {
        if (typeof item === 'string' && keyedId === undefined) {
          const child =
            createdComponents.get(item) ?? captureActiveSnapshot(item)
          const reservedType = reservedCreationTypesById.get(item)
          if (!child && reservedType === undefined) {
            throw new Error(
              `[PropsManager] Detached property creation is missing relationship child "${item}"`
            )
          }
          if ((child?.type ?? reservedType) !== relation.childType) {
            throw new Error(
              `[PropsManager] Detached property creation relationship child "${item}" has the wrong type`
            )
          }
          return item
        }
        if (
          (relation.mode ?? 'ids') !== 'ids-or-objects' ||
          !isRecord(item) ||
          (keyedId !== undefined && keyedId.length === 0)
        ) {
          throw new Error(
            `[PropsManager] Detached property creation has an invalid relationship descriptor for "${label}"`
          )
        }
        const itemId =
          typeof item.id === 'string' && item.id.length > 0
            ? item.id
            : undefined
        if (keyedId && itemId && keyedId !== itemId) {
          throw new Error(
            `[PropsManager] Detached property creation relationship child "${keyedId}" has conflicting canonical ids`
          )
        }
        const explicitId = keyedId ?? itemId
        const existing = explicitId
          ? (createdComponents.get(explicitId) ??
            captureActiveSnapshot(explicitId))
          : undefined
        const reservedType = explicitId
          ? reservedCreationTypesById.get(explicitId)
          : undefined
        if (existing || reservedType !== undefined) {
          if ((existing?.type ?? reservedType) !== relation.childType) {
            throw new Error(
              `[PropsManager] Detached property creation relationship child "${explicitId}" has the wrong type`
            )
          }
          if (Object.keys(item).some((key) => key !== 'id' && key !== 'type')) {
            throw new Error(
              `[PropsManager] Detached property creation cannot override relationship child "${explicitId}"`
            )
          }
          return explicitId as string
        }
        let mapped: Record<string, unknown> | null
        try {
          mapped = relation.toChildData
            ? relation.toChildData(
                clonePropertyDefinitionValue(item) as Record<string, unknown>,
                explicitId
              )
            : (clonePropertyDefinitionValue(item) as Record<string, unknown>)
        } catch {
          mapped = null
        }
        if (!isRecord(mapped)) {
          throw new Error(
            `[PropsManager] Detached property creation has an invalid relationship descriptor for "${label}"`
          )
        }
        const mappedId =
          typeof mapped.id === 'string' && mapped.id.length > 0
            ? mapped.id
            : undefined
        if (explicitId && mappedId && explicitId !== mappedId) {
          throw new Error(
            `[PropsManager] Detached property creation relationship child "${explicitId}" changed its canonical id`
          )
        }
        const canonicalId = explicitId ?? mappedId
        const childContract = captureContract(relation.childType)
        const childData: Record<string, unknown> = {
          ...mapped,
          ...(canonicalId ? { id: canonicalId } : {}),
          type: relation.childType
        }
        if (!canonicalId && childData.id === '') {
          delete childData.id
        }
        if (
          childContract.childRelation &&
          Object.prototype.hasOwnProperty.call(
            childData,
            childContract.childRelation.key
          )
        ) {
          childData[childContract.childRelation.key] =
            normalizeOrdinaryRelation(
              childData[childContract.childRelation.key],
              childContract,
              label
            )
        }
        return prepareCreationRecord(
          childData,
          relation.childType,
          label,
          false
        ).id
      })
      if (new Set(childIds).size !== childIds.length) {
        throw new Error(
          `[PropsManager] Detached property creation has duplicate relationship children for "${ownerLabel}"`
        )
      }
      return childIds
    }
    const prepareOrdinaryCreation = (
      sourceMutation: Readonly<Record<string, unknown>>,
      mutationIndex: number
    ): void => {
      if (
        typeof sourceMutation.ownerElementId !== 'string' ||
        sourceMutation.ownerElementId.length === 0 ||
        typeof sourceMutation.ownerElementType !== 'string' ||
        sourceMutation.ownerElementType.length === 0 ||
        !Array.isArray(sourceMutation.definitions) ||
        sourceMutation.definitions.length === 0 ||
        !isRecord(sourceMutation.data) ||
        (sourceMutation.propertyIds !== undefined &&
          !isRecord(sourceMutation.propertyIds))
      ) {
        throw new Error(
          `[PropsManager] Detached property creation has an invalid owner at item ${mutationIndex}`
        )
      }
      const definitions = sourceMutation.definitions
      const data = sourceMutation.data
      const propertyIds = sourceMutation.propertyIds
      const names = new Set<string>()
      const preparedDefinitions = definitions.map(
        (sourceDefinition, definitionIndex) => {
          if (
            !isRecord(sourceDefinition) ||
            typeof sourceDefinition.name !== 'string' ||
            sourceDefinition.name.length === 0 ||
            typeof sourceDefinition.type !== 'string' ||
            sourceDefinition.type.length === 0 ||
            names.has(sourceDefinition.name)
          ) {
            throw new Error(
              `[PropsManager] Detached property creation has an invalid definition at item ${mutationIndex}:${definitionIndex}`
            )
          }
          names.add(sourceDefinition.name)
          const registered = captureOwnerDefinition(
            sourceMutation.ownerElementType as string,
            sourceDefinition.name,
            sourceDefinition.type
          )
          if (!isEqual(registered, sourceDefinition)) {
            throw new Error(
              `[PropsManager] Detached property creation has an invalid owner relation for "${sourceDefinition.name}"`
            )
          }
          reserveCreationOwnerRelation(
            sourceMutation.ownerElementId as string,
            sourceDefinition.name
          )
          const contract = captureContract(sourceDefinition.type)
          const schema =
            isRecord(sourceDefinition.schema) &&
            Array.isArray(sourceDefinition.schema.fields)
              ? (sourceDefinition.schema as unknown as PropertySchema)
              : contract.schema
          const keys = new Set([
            sourceDefinition.name,
            ...(Array.isArray(sourceDefinition.alias)
              ? sourceDefinition.alias.filter(
                  (alias): alias is string =>
                    typeof alias === 'string' && alias.length > 0
                )
              : []),
            ...(schema?.fields.map(({ key }) => key) ?? [])
          ])
          return {
            definition: sourceDefinition as unknown as PropertyDefinition,
            contract,
            keys
          }
        }
      )
      if (
        propertyIds &&
        Object.keys(propertyIds).some((name) => !names.has(name))
      ) {
        throw new Error(
          `[PropsManager] Detached property creation has an invalid requested property id`
        )
      }
      const valuesByName = new Map<string, Record<string, unknown>>(
        preparedDefinitions.map(({ definition }) => [definition.name, {}])
      )
      Object.entries(data).forEach(([key, value]) => {
        const matches = preparedDefinitions.filter(({ keys }) => keys.has(key))
        if (matches.length > 1) {
          throw new Error(
            `[PropsManager] Detached property creation has an ambiguous owner field "${key}"`
          )
        }
        const match = matches[0]
        if (match) {
          ;(valuesByName.get(match.definition.name) as Record<string, unknown>)[
            key
          ] = clonePropertyDefinitionValue(value)
        }
      })
      const relations: ElementPropertyRelation[] = []
      preparedDefinitions.forEach(({ definition, contract }) => {
        const requestedId = propertyIds?.[definition.name]
        if (
          requestedId !== undefined &&
          (typeof requestedId !== 'string' || requestedId.length === 0)
        ) {
          throw new Error(
            `[PropsManager] Detached property creation has an invalid requested property id for "${definition.name}"`
          )
        }
        const mappedValues = valuesByName.get(definition.name) ?? {}
        const active = requestedId
          ? captureCreationActive(requestedId)
          : undefined
        let propertyId: string
        if (active) {
          if (
            active.get('type') !== definition.type ||
            Object.keys(mappedValues).length > 0
          ) {
            throw new Error(
              `[PropsManager] Detached property creation cannot override active property "${requestedId}"`
            )
          }
          propertyId = requestedId as string
        } else {
          const raw: Record<string, unknown> = {
            ...(requestedId ? { id: requestedId } : {}),
            type: definition.type,
            ...(definition.defaultValue !== undefined
              ? {
                  [definition.name]: clonePropertyDefinitionValue(
                    definition.defaultValue
                  )
                }
              : {}),
            ...mappedValues
          }
          if (
            contract.childRelation &&
            Object.prototype.hasOwnProperty.call(
              raw,
              contract.childRelation.key
            )
          ) {
            raw[contract.childRelation.key] = normalizeOrdinaryRelation(
              raw[contract.childRelation.key],
              contract,
              requestedId ??
                `${sourceMutation.ownerElementId}.${definition.name}`
            )
          }
          propertyId = prepareCreationRecord(
            raw,
            definition.type,
            requestedId ??
              `${sourceMutation.ownerElementId}.${definition.name}`,
            false
          ).id
        }
        if (!requestedPropertyIds.has(propertyId)) {
          requestedPropertyIds.add(propertyId)
          orderedPropertyIds.push(propertyId)
        }
        captureMutationOwner(
          propertyId,
          sourceMutation.ownerElementId as string
        )
        relations.push({
          ownerElementId: sourceMutation.ownerElementId as string,
          ownerElementType: sourceMutation.ownerElementType as string,
          ownerPropertyName: definition.name,
          componentId: propertyId
        })
      })
      creationRelationsByMutationIndex.set(
        mutationIndex,
        Object.freeze(relations)
      )
    }
    const prepareExactCreation = (
      sourceMutation: Readonly<Record<string, unknown>>,
      mutationIndex: number
    ): void => {
      if (
        !Array.isArray(sourceMutation.ownerRelations) ||
        sourceMutation.ownerRelations.length === 0 ||
        !Array.isArray(sourceMutation.components)
      ) {
        throw new Error(
          `[PropsManager] Exact property creation requires owner relations and a components array at item ${mutationIndex}`
        )
      }
      const relations = clonePropertyDefinitionValue(
        sourceMutation.ownerRelations
      ) as ElementPropertyRelation[]
      const sourceComponents = sourceMutation.components
      if (
        sourceComponents.some(
          (component) =>
            !isRecord(component) ||
            typeof component.id !== 'string' ||
            component.id.length === 0 ||
            typeof component.type !== 'string' ||
            component.type.length === 0
        )
      ) {
        throw new Error(
          '[PropsManager] Exact property creation has duplicate or invalid component ids'
        )
      }
      const components = sourceComponents as readonly PropertyComponentRawData[]
      const componentIds = components.map((component) => component.id)
      if (new Set(componentIds).size !== componentIds.length) {
        throw new Error(
          '[PropsManager] Exact property creation has duplicate or invalid component ids'
        )
      }
      const componentById = new Map(
        components.map((component) => [component.id, component] as const)
      )
      const resolveOwnerRoot = (
        propertyId: string
      ): PropertyComponentRawData => {
        const detached =
          componentById.get(propertyId) ?? createdComponents.get(propertyId)
        if (detached) {
          return detached
        }
        const active = captureCreationActive(propertyId)
        const activeSnapshot = active
          ? captureActiveSnapshot(propertyId)
          : undefined
        if (!active || !activeSnapshot) {
          throw new Error(
            `[PropsManager] Exact property creation is missing active root "${propertyId}"`
          )
        }
        const activeType = activeSnapshot.type
        const contract =
          typeof activeType === 'string'
            ? captureContract(activeType)
            : undefined
        if (
          activeSnapshot.id !== propertyId ||
          active.get('id') !== propertyId ||
          active.get('type') !== activeType ||
          !contract ||
          !(active instanceof contract.constructor)
        ) {
          throw new Error(
            `[PropsManager] Exact property creation has an invalid active root "${propertyId}"`
          )
        }
        return activeSnapshot
      }
      components.forEach((component) => {
        if (
          !isRecord(component) ||
          typeof component.type !== 'string' ||
          component.type.length === 0 ||
          activeById.has(component.id) ||
          createdComponents.has(component.id)
        ) {
          throw new Error(
            `[PropsManager] Exact property creation has duplicate or invalid component ids`
          )
        }
        const contract = captureContract(component.type)
        const inactive = this._deletedMap.get(component.id)
        if (!inactive) {
          return
        }
        const inactiveSnapshot = clonePropsValue(inactive.save())
        if (
          inactive.get('type') !== component.type ||
          !(inactive instanceof contract.constructor) ||
          !isEqual(inactiveSnapshot, component)
        ) {
          throw new Error(
            `[PropsManager] Exact property creation has incompatible inactive data for "${component.id}"`
          )
        }
        reactivatedComponents.set(
          component.id,
          Object.freeze({
            instance: inactive,
            before: deepFreezePropertyContract(inactiveSnapshot)
          })
        )
      })
      const ownerTypeById = new Map<string, string>()
      relations.forEach((relation) => {
        if (
          !isRecord(relation) ||
          typeof relation.ownerElementId !== 'string' ||
          relation.ownerElementId.length === 0 ||
          typeof relation.ownerElementType !== 'string' ||
          relation.ownerElementType.length === 0 ||
          typeof relation.ownerPropertyName !== 'string' ||
          relation.ownerPropertyName.length === 0 ||
          typeof relation.componentId !== 'string' ||
          relation.componentId.length === 0
        ) {
          throw new Error(
            '[PropsManager] Exact property creation has an invalid owner relation'
          )
        }
        reserveCreationOwnerRelation(
          relation.ownerElementId,
          relation.ownerPropertyName
        )
        const knownOwnerType = ownerTypeById.get(relation.ownerElementId)
        if (
          knownOwnerType !== undefined &&
          knownOwnerType !== relation.ownerElementType
        ) {
          throw new Error(
            `[PropsManager] Exact property creation has an invalid owner relation for "${relation.ownerElementId}"`
          )
        }
        ownerTypeById.set(relation.ownerElementId, relation.ownerElementType)
        const root = resolveOwnerRoot(relation.componentId)
        captureContract(root.type)
        const registeredDefinition = elementPropertyRegistry.getForComponent(
          relation.ownerElementType,
          relation.ownerPropertyName
        )
        if (!registeredDefinition) {
          throw new Error(
            `[PropsManager] Exact property creation has an invalid owner relation for "${relation.componentId}"`
          )
        }
        const definition = captureOwnerDefinition(
          relation.ownerElementType,
          relation.ownerPropertyName,
          registeredDefinition.type
        )
        if (root.type !== definition.type) {
          throw new Error(
            `[PropsManager] Exact property creation owner root "${relation.componentId}" has the wrong type`
          )
        }
      })
      const visiting = new Set<string>()
      const visited = new Set<string>()
      const childFirstIds: string[] = []
      const visit = (propertyId: string): void => {
        if (visited.has(propertyId)) {
          return
        }
        if (visiting.has(propertyId)) {
          throw new Error(
            `[PropsManager] Exact property creation has a relationship cycle at "${propertyId}"`
          )
        }
        const component = componentById.get(propertyId)
        if (!component) {
          return
        }
        visiting.add(propertyId)
        const contract = captureContract(component.type)
        const relation = contract.childRelation
        if (relation) {
          const childIds = (
            component as unknown as Readonly<Record<string, unknown>>
          )[relation.key]
          if (
            !Array.isArray(childIds) ||
            childIds.some((childId) => typeof childId !== 'string') ||
            new Set(childIds).size !== childIds.length
          ) {
            throw new Error(
              `[PropsManager] Exact property creation has a malformed child relation for "${propertyId}"`
            )
          }
          ;(childIds as string[]).forEach((childId) => {
            const localChild = componentById.get(childId)
            const activeChild = localChild
              ? undefined
              : (createdComponents.get(childId) ??
                captureActiveSnapshot(childId))
            if (!localChild && !activeChild) {
              throw new Error(
                `[PropsManager] Exact property creation is missing relation child "${childId}"`
              )
            }
            if (
              (localChild?.type ?? activeChild?.type) !== relation.childType
            ) {
              throw new Error(
                `[PropsManager] Exact property creation child "${childId}" has the wrong type`
              )
            }
            if (localChild) {
              visit(childId)
            }
          })
        }
        visiting.delete(propertyId)
        visited.add(propertyId)
        childFirstIds.push(propertyId)
      }
      relations.forEach(({ componentId }) => visit(componentId))
      if (visited.size !== components.length) {
        throw new Error(
          '[PropsManager] Exact property creation contains an unowned property'
        )
      }
      childFirstIds.forEach((propertyId) => {
        const component = componentById.get(propertyId)
        if (!component) {
          throw new Error(
            `[PropsManager] Exact property creation is missing component "${propertyId}"`
          )
        }
        if (reactivatedComponents.has(propertyId)) {
          createdComponents.set(
            propertyId,
            deepFreezePropertyContract(
              clonePropertyDefinitionValue(
                component
              ) as PropertyComponentRawData
            )
          )
          return
        }
        prepareCreationRecord(
          component as unknown as Readonly<Record<string, unknown>>,
          component.type,
          propertyId,
          true
        )
      })
      relations.forEach((relation) => {
        if (!requestedPropertyIds.has(relation.componentId)) {
          requestedPropertyIds.add(relation.componentId)
          orderedPropertyIds.push(relation.componentId)
        }
        captureMutationOwner(relation.componentId, relation.ownerElementId)
      })
      creationRelationsByMutationIndex.set(
        mutationIndex,
        Object.freeze(relations)
      )
    }
    mutations.forEach((sourceMutation, mutationIndex) => {
      if (!isRecord(sourceMutation)) {
        return
      }
      if (sourceMutation.kind === 'create-owner-properties') {
        prepareOrdinaryCreation(sourceMutation, mutationIndex)
      } else if (sourceMutation.kind === 'create-exact-property-graph') {
        prepareExactCreation(sourceMutation, mutationIndex)
      }
    })

    mutations.forEach((sourceMutation, mutationIndex) => {
      if (!isRecord(sourceMutation)) {
        throw new Error(
          `[PropsManager] Property mutation item ${mutationIndex} is invalid`
        )
      }
      const creationRelations =
        creationRelationsByMutationIndex.get(mutationIndex)
      if (creationRelations) {
        ownerRelations.push(...creationRelations)
        return
      }
      if (sourceMutation.kind === 'remove-exact-orphan-property-graphs') {
        const orphanRootPropertyIds = sourceMutation.orphanRootPropertyIds
        const retainedRootPropertyIds = sourceMutation.retainedRootPropertyIds
        if (
          hasExactOrphanRemovalMutation ||
          !Array.isArray(orphanRootPropertyIds) ||
          !Array.isArray(retainedRootPropertyIds) ||
          orphanRootPropertyIds.length === 0 ||
          orphanRootPropertyIds.some(
            (propertyId) =>
              typeof propertyId !== 'string' || propertyId.length === 0
          ) ||
          retainedRootPropertyIds.some(
            (propertyId) =>
              typeof propertyId !== 'string' || propertyId.length === 0
          ) ||
          new Set(orphanRootPropertyIds).size !==
            orphanRootPropertyIds.length ||
          new Set(retainedRootPropertyIds).size !==
            retainedRootPropertyIds.length
        ) {
          throw new Error(
            '[PropsManager] Exact orphan property graph removal requires explicit deduplicated root-id sets for orphan and retained roots'
          )
        }
        const detachedOrphanRootPropertyIds = [...orphanRootPropertyIds]
        const detachedRetainedRootPropertyIds = [...retainedRootPropertyIds]
        const detachedOrphanRootPropertyIdSet = new Set(
          detachedOrphanRootPropertyIds
        )
        if (
          detachedRetainedRootPropertyIds.some((propertyId) =>
            detachedOrphanRootPropertyIdSet.has(propertyId)
          )
        ) {
          throw new Error(
            '[PropsManager] Exact orphan and retained root-id sets must be disjoint'
          )
        }
        hasExactOrphanRemovalMutation = true
        detachedRetainedRootPropertyIds.forEach((propertyId) => {
          const instance = activeById.get(propertyId)
          if (!instance) {
            throw new Error(
              `[PropsManager] Exact orphan property graph removal is missing active retained root "${propertyId}"`
            )
          }
          const type = instance.get('type')
          const contract =
            typeof type === 'string' ? captureContract(type) : undefined
          if (!contract || !(instance instanceof contract.constructor)) {
            throw new Error(
              `[PropsManager] Exact orphan property graph removal has an invalid active retained root "${propertyId}"`
            )
          }
          retainedRootPropertyIdSet.add(propertyId)
          retainedRootIdentityReads.push(
            Object.freeze({
              propertyId,
              instance
            })
          )
        })
        detachedOrphanRootPropertyIds.forEach((propertyId) => {
          if (requestedPropertyIds.has(propertyId)) {
            throw new Error(
              `[PropsManager] Exact orphan property graph removal has a duplicate root "${propertyId}"`
            )
          }
          const component = activeById.get(propertyId)
          const snapshot = captureActiveSnapshot(propertyId)
          if (!component || !snapshot) {
            throw new Error(
              `[PropsManager] Exact orphan property graph removal is missing active root "${propertyId}"`
            )
          }
          const contract = captureContract(snapshot.type)
          if (
            !(component instanceof contract.constructor) ||
            component.get('type') !== snapshot.type
          ) {
            throw new Error(
              `[PropsManager] Exact orphan property graph removal has an invalid active root "${propertyId}"`
            )
          }
          requestedPropertyIds.add(propertyId)
          orderedPropertyIds.push(propertyId)
          const orderedId = captureMutationOwner(propertyId)
          addRemovedCandidate(propertyId, orderedId)
          exactOrphanCandidateIds.add(propertyId)
          relationshipMutationRootIds.add(propertyId)
        })
        return
      }
      const propertyId = sourceMutation.propertyId
      if (
        typeof propertyId !== 'string' ||
        propertyId.length === 0 ||
        requestedPropertyIds.has(propertyId)
      ) {
        throw new Error(
          `[PropsManager] Property mutation item ${mutationIndex} has a duplicate or invalid property id`
        )
      }
      const component = activeById.get(propertyId)
      const snapshot = captureActiveSnapshot(propertyId)
      if (!component || !snapshot) {
        throw new Error(
          `[PropsManager] Property mutation is missing active property "${propertyId}"`
        )
      }
      const contract = captureContract(snapshot.type)
      if (
        !(component instanceof contract.constructor) ||
        component.get('type') !== snapshot.type
      ) {
        throw new Error(
          `[PropsManager] Property mutation has an invalid active instance "${propertyId}"`
        )
      }
      if (
        Object.prototype.hasOwnProperty.call(sourceMutation, 'owner') ||
        Object.prototype.hasOwnProperty.call(
          sourceMutation,
          'ownerElementId'
        ) ||
        Object.prototype.hasOwnProperty.call(
          sourceMutation,
          'ownerPropertyName'
        )
      ) {
        throw new Error(
          `[PropsManager] Property-source mutation "${propertyId}" cannot accept an initiating owner`
        )
      }
      const orderedId = captureMutationOwner(propertyId)
      requestedPropertyIds.add(propertyId)
      orderedPropertyIds.push(propertyId)

      if (sourceMutation.kind === 'values') {
        if (!isRecord(sourceMutation.values)) {
          throw new Error(
            `[PropsManager] Property mutation "${propertyId}" requires value replacements`
          )
        }
        const nextSnapshot = clonePropsValue(snapshot)
        Object.entries(sourceMutation.values).forEach(([key, value]) => {
          assertField(
            snapshot as unknown as Readonly<Record<string, unknown>>,
            contract,
            propertyId,
            key,
            value
          )
          if (contract.childRelation?.key === key) {
            relationshipMutationRootIds.add(propertyId)
            if (
              !Array.isArray(value) ||
              value.some((childId) => typeof childId !== 'string') ||
              new Set(value).size !== value.length
            ) {
              throw new Error(
                `[PropsManager] Property mutation has an invalid relationship "${propertyId}.${key}"`
              )
            }
            const nextChildIds = [...(value as string[])]
            const nextChildIdSet = new Set(nextChildIds)
            assertRelationIds(nextChildIds, contract.childRelation, propertyId)
            const previousChildIds = readRelationIds(
              snapshot as Readonly<Record<string, unknown>>,
              contract.childRelation,
              propertyId
            )
            previousChildIds.forEach((childId) => {
              if (!nextChildIdSet.has(childId)) {
                addRemovedCandidate(childId, orderedId)
              }
            })
          }
          const before = (
            nextSnapshot as unknown as Readonly<Record<string, unknown>>
          )[key]
          ;(nextSnapshot as unknown as Record<string, unknown>)[key] =
            clonePropsValue(value)
          addReplaceLatestHistoryEvidence(propertyId, key, before, value)
          addUpdateEvidence(propertyId, key, before, value)
        })
        assertRuntimePropertyFields(
          nextSnapshot as unknown as Readonly<Record<string, unknown>>,
          contract.schema,
          propertyId
        )
        workingSnapshots.set(propertyId, nextSnapshot)
        if (!isEqual(snapshot, nextSnapshot)) {
          touchExisting(propertyId)
        }
        return
      }

      if (sourceMutation.kind !== 'records') {
        throw new Error(
          `[PropsManager] Property mutation "${propertyId}" has an invalid kind`
        )
      }
      const relation = contract.childRelation
      if (
        !relation ||
        typeof sourceMutation.key !== 'string' ||
        sourceMutation.key !== relation.key ||
        (relation.collection ?? 'array') !== 'array-or-record'
      ) {
        throw new Error(
          `[PropsManager] Property mutation "${propertyId}" has an invalid record relationship`
        )
      }
      relationshipMutationRootIds.add(propertyId)
      const replacementValues =
        sourceMutation.values === undefined ? {} : sourceMutation.values
      if (!isRecord(replacementValues)) {
        throw new Error(
          `[PropsManager] Property mutation "${propertyId}" has invalid value replacements`
        )
      }
      const setRecords =
        sourceMutation.set === undefined ? {} : sourceMutation.set
      const removeIds =
        sourceMutation.remove === undefined ? [] : sourceMutation.remove
      if (
        !isRecord(setRecords) ||
        !Array.isArray(removeIds) ||
        removeIds.some(
          (childId) => typeof childId !== 'string' || childId.length === 0
        ) ||
        new Set(removeIds).size !== removeIds.length
      ) {
        throw new Error(
          `[PropsManager] Property mutation "${propertyId}" has invalid record operations`
        )
      }
      const setEntries = Object.entries(setRecords)
      const removeIdSet = new Set(removeIds)
      if (
        setEntries.some(
          ([childId, values]) =>
            childId.length === 0 ||
            !isRecord(values) ||
            removeIdSet.has(childId)
        )
      ) {
        throw new Error(
          `[PropsManager] Property mutation "${propertyId}" has conflicting record operations`
        )
      }

      const previousChildIds = readRelationIds(
        snapshot as Readonly<Record<string, unknown>>,
        relation,
        propertyId
      )
      const previousChildIdSet = new Set(previousChildIds)
      removeIds.forEach((childId) => {
        if (!previousChildIdSet.has(childId)) {
          throw new Error(
            `[PropsManager] Property mutation "${propertyId}" cannot unlink missing record "${childId}"`
          )
        }
        addRemovedCandidate(childId, orderedId)
      })
      const nextChildIds = previousChildIds.filter(
        (childId) => !removeIdSet.has(childId)
      )
      const nextChildIdSet = new Set(nextChildIds)

      setEntries.forEach(([childId, sourceValues]) => {
        const mappedValues = relation.toChildData
          ? relation.toChildData(
              sourceValues as Record<string, unknown>,
              childId
            )
          : sourceValues
        if (!isRecord(mappedValues)) {
          throw new Error(
            `[PropsManager] Property mutation has invalid record "${childId}"`
          )
        }
        if (
          (mappedValues.id !== undefined && mappedValues.id !== childId) ||
          (mappedValues.type !== undefined &&
            mappedValues.type !== relation.childType)
        ) {
          throw new Error(
            `[PropsManager] Property mutation has invalid canonical record "${childId}"`
          )
        }
        const childContract = captureContract(relation.childType)
        const childValues = Object.entries(mappedValues).reduce<
          Record<string, unknown>
        >((values, [key, value]) => {
          if (key !== 'id' && key !== 'type') {
            values[key] = clonePropsValue(value)
          }
          return values
        }, {})
        const existingChild = resolveChildSnapshot(childId)
        associatePropertyWithOwner(childId, orderedId)
        if (existingChild) {
          const isCreatedChild = createdComponents.has(childId)
          if (existingChild.type !== relation.childType) {
            throw new Error(
              `[PropsManager] Property mutation record "${childId}" has the wrong type`
            )
          }
          const nextChild = clonePropsValue(existingChild)
          Object.entries(childValues).forEach(([key, value]) => {
            assertField(
              existingChild as unknown as Readonly<Record<string, unknown>>,
              childContract,
              childId,
              key,
              value
            )
            const before = (
              nextChild as unknown as Readonly<Record<string, unknown>>
            )[key]
            ;(nextChild as unknown as Record<string, unknown>)[key] =
              clonePropsValue(value)
            addReplaceLatestHistoryEvidence(childId, key, before, value)
            if (childContract.childRelation?.key === key) {
              relationshipMutationRootIds.add(childId)
            }
            if (!isCreatedChild) {
              addUpdateEvidence(childId, key, before, value)
            }
          })
          assertRuntimePropertyFields(
            nextChild as unknown as Readonly<Record<string, unknown>>,
            childContract.schema,
            childId
          )
          if (isCreatedChild) {
            createdComponents.set(childId, nextChild)
          } else {
            workingSnapshots.set(childId, nextChild)
            if (!isEqual(existingChild, nextChild)) {
              touchExisting(childId)
            }
          }
        } else {
          const inactiveChild = this._deletedMap.get(childId)
          if (
            createdComponents.has(childId) ||
            (inactiveChild && getTransactionReplayMode() === null)
          ) {
            throw new Error(
              `[PropsManager] Property mutation record "${childId}" conflicts with an existing canonical id`
            )
          }
          const childConfig = getComponentConfig(relation.childType)
          const configuredPersistKeys = getPersistKeys(relation.childType)
          if (
            childConfig &&
            !childConfig.allowDynamicKeys &&
            Object.keys(childValues).some(
              (key) => !configuredPersistKeys.has(key)
            )
          ) {
            throw new Error(
              `[PropsManager] Property mutation has an unknown field "${childId}"`
            )
          }
          const normalizedChildValues = clonePropsValue(
            getDefaultValues(childContract)
          ) as Record<string, unknown>
          Object.assign(normalizedChildValues, childValues)
          const created = {
            id: childId,
            type: relation.childType,
            ...normalizedChildValues
          } as PropertyComponentRawData
          assertRuntimePropertyFields(
            created as unknown as Readonly<Record<string, unknown>>,
            childContract.schema,
            childId
          )
          if (inactiveChild) {
            const inactiveSnapshot = clonePropsValue(inactiveChild.save())
            if (
              inactiveChild.get('type') !== relation.childType ||
              !(inactiveChild instanceof childContract.constructor) ||
              !isEqual(inactiveSnapshot, created)
            ) {
              throw new Error(
                `[PropsManager] Property mutation record "${childId}" has incompatible inactive data`
              )
            }
            reactivatedComponents.set(
              childId,
              Object.freeze({
                instance: inactiveChild,
                before: deepFreezePropertyContract(inactiveSnapshot)
              })
            )
          }
          createdComponents.set(childId, created)
        }
        if (!nextChildIdSet.has(childId)) {
          nextChildIds.push(childId)
          nextChildIdSet.add(childId)
        }
      })

      assertRelationIds(nextChildIds, relation, propertyId)
      const nextParent = clonePropsValue(snapshot)
      Object.entries(replacementValues).forEach(([key, value]) => {
        if (key === relation.key) {
          throw new Error(
            `[PropsManager] Property mutation "${propertyId}" cannot replace its record relationship`
          )
        }
        assertField(
          snapshot as unknown as Readonly<Record<string, unknown>>,
          contract,
          propertyId,
          key,
          value
        )
        const before = (
          nextParent as unknown as Readonly<Record<string, unknown>>
        )[key]
        ;(nextParent as unknown as Record<string, unknown>)[key] =
          clonePropsValue(value)
        addReplaceLatestHistoryEvidence(propertyId, key, before, value)
        addUpdateEvidence(propertyId, key, before, value)
      })
      ;(nextParent as unknown as Record<string, unknown>)[relation.key] =
        clonePropsValue(nextChildIds)
      assertRuntimePropertyFields(
        nextParent as unknown as Readonly<Record<string, unknown>>,
        contract.schema,
        propertyId
      )
      addUpdateEvidence(
        propertyId,
        relation.key,
        previousChildIds,
        nextChildIds
      )
      workingSnapshots.set(propertyId, nextParent)
      if (!isEqual(snapshot, nextParent)) {
        touchExisting(propertyId)
      }
    })

    const workingChildIdsByOwnerId = new Map<string, readonly string[]>()
    const workingOwnerIdsByChildId = new Map<string, Set<string>>()
    const untrackedWorkingOwnerIds = new Set<string>()
    const relationshipChildrenReads = new Map<
      string,
      PreparedRelationshipChildrenRead
    >()
    const relationshipOwnersReads = new Map<
      string,
      PreparedRelationshipOwnersRead
    >()
    const sharedRetentionReads = new Map<string, PreparedSharedRetentionRead>()
    const readActiveChildIds = (
      ownerId: string
    ): readonly string[] | undefined => {
      const captured = relationshipChildrenReads.get(ownerId)
      if (captured) {
        return captured.present ? captured.childIds : undefined
      }
      const current = this.relationshipChildIdsByOwnerId.get(ownerId)
      relationshipChildrenReads.set(
        ownerId,
        Object.freeze({
          ownerId,
          present: current !== undefined,
          childIds: Object.freeze([...(current ?? [])])
        })
      )
      return current
    }
    const readActiveOwnerIds = (childId: string): ReadonlySet<string> => {
      const captured = relationshipOwnersReads.get(childId)
      if (captured) {
        return new Set(captured.ownerIds)
      }
      const current = this.relationshipOwnerIdsByChildId.get(childId)
      const ownerIds = [...(current ?? [])].sort()
      relationshipOwnersReads.set(
        childId,
        Object.freeze({
          childId,
          present: current !== undefined,
          ownerIds: Object.freeze(ownerIds)
        })
      )
      return new Set(ownerIds)
    }
    const getWorkingChildIds = (
      ownerId: string
    ): readonly string[] | undefined =>
      workingChildIdsByOwnerId.get(ownerId) ?? readActiveChildIds(ownerId)
    const getWorkingOwnerIds = (childId: string): ReadonlySet<string> => {
      const existing = workingOwnerIdsByChildId.get(childId)
      if (existing) {
        if (untrackedWorkingOwnerIds.has(childId)) {
          readActiveOwnerIds(childId)
          untrackedWorkingOwnerIds.delete(childId)
        }
        return existing
      }
      return readActiveOwnerIds(childId)
    }
    const getMutableWorkingOwnerIds = (
      childId: string,
      captureDependency = true
    ): Set<string> => {
      const existing = workingOwnerIdsByChildId.get(childId)
      if (existing) {
        if (captureDependency && untrackedWorkingOwnerIds.has(childId)) {
          readActiveOwnerIds(childId)
          untrackedWorkingOwnerIds.delete(childId)
        }
        return existing
      }
      const ownerIds = new Set(
        captureDependency
          ? readActiveOwnerIds(childId)
          : (this.relationshipOwnerIdsByChildId.get(childId) ?? [])
      )
      workingOwnerIdsByChildId.set(childId, ownerIds)
      if (!captureDependency) {
        untrackedWorkingOwnerIds.add(childId)
      }
      return ownerIds
    }
    const replaceWorkingOwnerEdges = (
      ownerId: string,
      nextChildIds: readonly string[],
      captureReverseDependencies = true
    ): void => {
      const previousChildIds = getWorkingChildIds(ownerId) ?? []
      const previousChildIdSet = new Set(previousChildIds)
      const nextChildIdSet = new Set(nextChildIds)
      previousChildIds.forEach((childId) => {
        if (!nextChildIdSet.has(childId)) {
          getMutableWorkingOwnerIds(childId, captureReverseDependencies).delete(
            ownerId
          )
        }
      })
      nextChildIds.forEach((childId) => {
        if (!previousChildIdSet.has(childId)) {
          getMutableWorkingOwnerIds(childId, captureReverseDependencies).add(
            ownerId
          )
        }
      })
      workingChildIdsByOwnerId.set(ownerId, Object.freeze([...nextChildIds]))
    }
    const indexWorkingOwner = (
      ownerId: string,
      snapshot: PropertyComponentRawData,
      requireExactActiveIndex = false
    ): void => {
      const relation = captureContract(snapshot.type).childRelation
      if (!relation) {
        return
      }
      const isActiveOwner = activeById.has(ownerId)
      const hasPreparedEdges = workingChildIdsByOwnerId.has(ownerId)
      const requiresActiveIndexMatch =
        requireExactActiveIndex &&
        isActiveOwner &&
        !hasPreparedEdges &&
        !touchedPropertyIdSet.has(ownerId)
      const childIds = readRelationIds(
        snapshot as unknown as Readonly<Record<string, unknown>>,
        relation,
        ownerId
      )
      assertRelationIds(
        childIds,
        relation,
        ownerId,
        requireExactActiveIndex ? retainedRootPropertyIdSet : undefined
      )
      if (requiresActiveIndexMatch) {
        const indexedChildIds = readActiveChildIds(ownerId)
        if (
          indexedChildIds === undefined ||
          !isEqual(indexedChildIds, childIds)
        ) {
          throw new Error(
            `[PropsManager] Property mutation has an inconsistent forward relationship index for "${ownerId}"`
          )
        }
      }
      if (requiresActiveIndexMatch) {
        childIds.forEach((childId) => {
          if (!getWorkingOwnerIds(childId).has(ownerId)) {
            throw new Error(
              `[PropsManager] Property mutation has an inconsistent reverse relationship index for "${ownerId}:${childId}"`
            )
          }
        })
      }
      replaceWorkingOwnerEdges(ownerId, childIds, isActiveOwner)
      if (requireExactActiveIndex) {
        childIds.forEach((childId) => {
          if (!getWorkingOwnerIds(childId).has(ownerId)) {
            throw new Error(
              `[PropsManager] Property mutation cannot establish relationship index for "${ownerId}:${childId}"`
            )
          }
        })
      }
    }
    if (relationshipMutationRootIds.size > 0 || createdComponents.size > 0) {
      new Set([
        ...relationshipMutationRootIds,
        ...createdComponents.keys()
      ]).forEach((propertyId) => {
        const snapshot =
          createdComponents.get(propertyId) ??
          workingSnapshots.get(propertyId) ??
          captureActiveSnapshot(propertyId)
        if (!snapshot) {
          throw new Error(
            `[PropsManager] Property mutation cannot snapshot relationship owner "${propertyId}"`
          )
        }
        indexWorkingOwner(
          propertyId,
          snapshot,
          exactOrphanCandidateIds.has(propertyId)
        )
      })

      const visiting = new Set<string>()
      const ordinarilyVisited = new Set<string>()
      const exactlyVisited = new Set<string>()
      const visitRelationshipGraph = (propertyId: string): void => {
        const requiresExactRelationshipSet =
          exactOrphanCandidateIds.has(propertyId)
        if (
          requiresExactRelationshipSet
            ? exactlyVisited.has(propertyId)
            : ordinarilyVisited.has(propertyId) ||
              exactlyVisited.has(propertyId)
        ) {
          return
        }
        if (visiting.has(propertyId)) {
          throw new Error(
            `[PropsManager] Property mutation has a relationship cycle at "${propertyId}"`
          )
        }
        const snapshot =
          createdComponents.get(propertyId) ??
          workingSnapshots.get(propertyId) ??
          captureActiveSnapshot(propertyId)
        if (!snapshot) {
          throw new Error(
            `[PropsManager] Property mutation cannot snapshot relationship graph property "${propertyId}"`
          )
        }
        const contract = captureContract(snapshot.type)
        const active = activeById.get(propertyId)
        if (
          active &&
          (!(active instanceof contract.constructor) ||
            active.get('type') !== snapshot.type)
        ) {
          throw new Error(
            `[PropsManager] Property mutation has an invalid relationship graph instance "${propertyId}"`
          )
        }
        indexWorkingOwner(propertyId, snapshot, requiresExactRelationshipSet)
        visiting.add(propertyId)
        getWorkingChildIds(propertyId)?.forEach((childId) => {
          if (
            requiresExactRelationshipSet &&
            retainedRootPropertyIdSet.has(childId)
          ) {
            return
          }
          if (requiresExactRelationshipSet) {
            exactOrphanCandidateIds.add(childId)
          }
          visitRelationshipGraph(childId)
        })
        visiting.delete(propertyId)
        if (requiresExactRelationshipSet) {
          exactlyVisited.add(propertyId)
        } else {
          ordinarilyVisited.add(propertyId)
        }
      }
      new Set([
        ...relationshipMutationRootIds,
        ...removedCandidateIds,
        ...createdComponents.keys()
      ]).forEach(visitRelationshipGraph)
    }

    if (exactOrphanCandidateIds.size > 0) {
      activeById.forEach((component, ownerId) => {
        const type = component.get('type')
        const relation =
          typeof type === 'string'
            ? getPropertyComponentCanonicalChildRelation(type)
            : undefined
        const indexedChildIds = this.relationshipChildIdsByOwnerId.get(ownerId)
        const indexedAffected =
          indexedChildIds?.some((childId) =>
            exactOrphanCandidateIds.has(childId)
          ) ?? false
        const rawChildIds = relation
          ? (
              component as unknown as {
                data: Readonly<Record<string, unknown>>
              }
            ).data[relation.key]
          : undefined
        const rawAffected =
          Array.isArray(rawChildIds) &&
          rawChildIds.some(
            (childId) =>
              typeof childId === 'string' &&
              exactOrphanCandidateIds.has(childId)
          )
        if (!indexedAffected && !rawAffected) {
          return
        }
        if (
          !relation ||
          !Array.isArray(rawChildIds) ||
          rawChildIds.some((childId) => typeof childId !== 'string') ||
          new Set(rawChildIds).size !== rawChildIds.length ||
          indexedChildIds === undefined ||
          !isEqual(indexedChildIds, rawChildIds)
        ) {
          throw new Error(
            `[PropsManager] Exact orphan property graph has an inconsistent forward relationship for "${ownerId}"`
          )
        }
        ;(rawChildIds as string[]).forEach((childId) => {
          if (
            exactOrphanCandidateIds.has(childId) &&
            !this.relationshipOwnerIdsByChildId.get(childId)?.has(ownerId)
          ) {
            throw new Error(
              `[PropsManager] Exact orphan property graph has an inconsistent reverse relationship for "${ownerId}:${childId}"`
            )
          }
        })
        if (retainedRootPropertyIdSet.has(ownerId)) {
          retainedRootRelationshipReads.set(
            ownerId,
            Object.freeze({
              propertyId: ownerId,
              instance: component,
              relationKey: relation.key,
              rawChildIds: Object.freeze([...(rawChildIds as string[])]),
              indexedChildIds: Object.freeze([...indexedChildIds])
            })
          )
          return
        }
        const ownerSnapshot =
          workingSnapshots.get(ownerId) ?? captureActiveSnapshot(ownerId)
        if (!ownerSnapshot) {
          throw new Error(
            `[PropsManager] Exact orphan property graph cannot snapshot affected owner "${ownerId}"`
          )
        }
        indexWorkingOwner(ownerId, ownerSnapshot, true)
      })
    }

    orderedOwnerIds.forEach((orderedId) => {
      const visited = new Set<string>()
      const visitCreatedDescendants = (propertyId: string): void => {
        if (visited.has(propertyId)) {
          return
        }
        visited.add(propertyId)
        getWorkingChildIds(propertyId)?.forEach((childId) => {
          if (createdComponents.has(childId)) {
            associatePropertyWithOwner(childId, orderedId)
          }
          if (
            createdComponents.has(childId) ||
            relationshipMutationRootIds.has(childId)
          ) {
            visitCreatedDescendants(childId)
          }
        })
      }
      ;(rootPropertyIdsByOwnerId.get(orderedId) ?? []).forEach(
        visitCreatedDescendants
      )
    })

    const removedIds = new Set<string>()
    const orderedRemovedIds: string[] = []
    const pendingRemovalIds = [...removedCandidateIds]
    const queuedRemovalIds = new Set(pendingRemovalIds)
    let removalIndex = 0
    while (removalIndex < pendingRemovalIds.length) {
      const candidateId = pendingRemovalIds[removalIndex++]
      queuedRemovalIds.delete(candidateId)
      const candidateOwnerIds = canonicalOwnerIdSetByPropertyId.get(candidateId)
      if (!candidateOwnerIds || candidateOwnerIds.size === 0) {
        throw new Error(
          `[PropsManager] Property mutation cannot resolve canonical owner for removed record "${candidateId}"`
        )
      }
      const workingOwnerIds = [...getWorkingOwnerIds(candidateId)]
      if (exactOrphanCandidateIds.has(candidateId)) {
        workingOwnerIds.forEach((ownerId) => {
          if (retainedRootPropertyIdSet.has(ownerId)) {
            const retainedRelationshipRead =
              retainedRootRelationshipReads.get(ownerId)
            if (
              !retainedRelationshipRead ||
              !retainedRelationshipRead.rawChildIds.includes(candidateId)
            ) {
              throw new Error(
                `[PropsManager] Exact orphan property graph has a missing retained owner relationship "${ownerId}:${candidateId}"`
              )
            }
            return
          }
          const ownerSnapshot =
            createdComponents.get(ownerId) ??
            workingSnapshots.get(ownerId) ??
            captureActiveSnapshot(ownerId)
          if (!ownerSnapshot) {
            throw new Error(
              `[PropsManager] Exact orphan property graph has a missing retaining owner "${ownerId}"`
            )
          }
          indexWorkingOwner(ownerId, ownerSnapshot, true)
          if (!(getWorkingChildIds(ownerId) ?? []).includes(candidateId)) {
            throw new Error(
              `[PropsManager] Exact orphan property graph has an inconsistent retaining owner "${ownerId}:${candidateId}"`
            )
          }
        })
      }
      const hasLiveOwner = workingOwnerIds.some(
        (ownerId) => !removedIds.has(ownerId)
      )
      if (hasLiveOwner && !exactOrphanCandidateIds.has(candidateId)) {
        const activeOwnerRead = relationshipOwnersReads.get(candidateId)
        const workingOwnerIdSet = new Set(workingOwnerIds)
        const preparedRemovedOwnerIds = new Set(
          (activeOwnerRead?.ownerIds ?? []).filter(
            (ownerId) => !workingOwnerIdSet.has(ownerId)
          )
        )
        workingOwnerIds.forEach((ownerId) => {
          if (removedIds.has(ownerId)) {
            preparedRemovedOwnerIds.add(ownerId)
          }
        })
        if (preparedRemovedOwnerIds.size > 0) {
          sharedRetentionReads.set(
            candidateId,
            Object.freeze({
              childId: candidateId,
              preparedRemovedOwnerIds: Object.freeze(
                [...preparedRemovedOwnerIds].sort()
              )
            })
          )
        }
      }
      if (
        removedIds.has(candidateId) ||
        createdComponents.has(candidateId) ||
        hasLiveOwner
      ) {
        continue
      }
      const candidate = activeById.get(candidateId)
      const candidateSnapshot = captureActiveSnapshot(candidateId)
      if (!candidate || !candidateSnapshot) {
        throw new Error(
          `[PropsManager] Property mutation cannot remove missing record "${candidateId}"`
        )
      }
      removedIds.add(candidateId)
      orderedRemovedIds.push(candidateId)
      const childIds = getWorkingChildIds(candidateId) ?? []
      replaceWorkingOwnerEdges(candidateId, [])
      childIds.forEach((childId) => {
        if (retainedRootPropertyIdSet.has(childId)) {
          return
        }
        if (exactOrphanCandidateIds.has(candidateId)) {
          exactOrphanCandidateIds.add(childId)
        }
        candidateOwnerIds.forEach((orderedId) =>
          associatePropertyWithOwner(childId, orderedId)
        )
        if (
          getWorkingOwnerIds(childId).size === 0 &&
          !queuedRemovalIds.has(childId)
        ) {
          queuedRemovalIds.add(childId)
          pendingRemovalIds.push(childId)
        }
      })
    }

    const orderedCreatedIds: string[] = []
    const orderedCreatedIdSet = new Set<string>()
    const orderCreatedChildFirst = (propertyId: string): void => {
      if (orderedCreatedIdSet.has(propertyId)) {
        return
      }
      getWorkingChildIds(propertyId)?.forEach((childId) => {
        if (createdComponents.has(childId)) {
          orderCreatedChildFirst(childId)
        }
      })
      orderedCreatedIdSet.add(propertyId)
      orderedCreatedIds.push(propertyId)
    }
    createdComponents.forEach((_snapshot, propertyId) =>
      orderCreatedChildFirst(propertyId)
    )
    const createdSnapshots = orderedCreatedIds.map((propertyId) => {
      const snapshot = createdComponents.get(propertyId)
      if (!snapshot) {
        throw new Error(
          `[PropsManager] Property mutation cannot order created record "${propertyId}"`
        )
      }
      return deepFreezePropertyContract(snapshot)
    })
    const removedComponents = orderedRemovedIds.map((propertyId) => {
      const component = activeById.get(propertyId)
      if (!component) {
        throw new Error(
          `[PropsManager] Property mutation cannot resolve removed record "${propertyId}"`
        )
      }
      return component
    })
    const evidence: PropsChange[] = []
    if (createdSnapshots.length > 0) {
      evidence.push({
        eventName: EventTypes.ADD_PROPERTY,
        data: [...createdSnapshots],
        action: PROPS_ACTIONS.ADD_PROPERTY,
        undoType: EventTypes.REMOVE_PROPERTY,
        undoAction: EventTypes.REMOVE_PROPERTY
      })
    }
    evidence.push(...updateEvidence)
    if (removedComponents.length > 0) {
      evidence.push({
        eventName: EventTypes.REMOVE_PROPERTY,
        data: orderedRemovedIds.map((propertyId) => {
          const snapshot = workingSnapshots.get(propertyId)
          if (!snapshot) {
            throw new Error(
              `[PropsManager] Property mutation cannot capture removed record "${propertyId}"`
            )
          }
          return deepFreezePropertyContract(snapshot)
        }),
        action: PROPS_ACTIONS.REMOVE_PROPERTY,
        undoType: EventTypes.ADD_PROPERTY,
        undoAction: EventTypes.ADD_PROPERTY
      })
    }

    const owners = deepFreezePropertyContract(
      orderedOwnerIds.map((orderedId) => ({
        orderedId,
        rootPropertyIds: [...(rootPropertyIdsByOwnerId.get(orderedId) ?? [])]
      }))
    )
    const frozenOwnerRelations = deepFreezePropertyContract(ownerRelations)
    const prepared = deepFreezePropertyContract({
      kind: 'prepared-property-mutation-batch' as const,
      owners,
      ownerRelations: frozenOwnerRelations,
      orderedPropertyIds: [...orderedPropertyIds]
    })
    const readComponents = [...originalSnapshots].map(
      ([propertyId, before]) => {
        const instance = activeById.get(propertyId)
        if (!instance) {
          throw new Error(
            `[PropsManager] Property mutation cannot retain read property "${propertyId}"`
          )
        }
        return Object.freeze({
          instance,
          before
        })
      }
    )
    const existingComponents = touchedPropertyIds.map((propertyId) => {
      const instance = activeById.get(propertyId)
      const before = originalSnapshots.get(propertyId)
      const after = workingSnapshots.get(propertyId)
      if (!instance || !before || !after) {
        throw new Error(
          `[PropsManager] Property mutation cannot retain changed property "${propertyId}"`
        )
      }
      return Object.freeze({
        instance,
        before,
        after: deepFreezePropertyContract(after)
      })
    })
    const frozenEvidence = deepFreezePropertyContract(evidence)
    const mutableOrderedOwnerIdsByPropertyId = new Map<string, string[]>()
    orderedOwnerIds.forEach((orderedId) => {
      ;(canonicalPropertyIdsByOwnerId.get(orderedId) ?? []).forEach(
        (propertyId) => {
          const ownerIds =
            mutableOrderedOwnerIdsByPropertyId.get(propertyId) ?? []
          ownerIds.push(orderedId)
          mutableOrderedOwnerIdsByPropertyId.set(propertyId, ownerIds)
        }
      )
    })
    const orderedCanonicalOwnerIdsByPropertyId = new Map<
      string,
      readonly string[]
    >(
      [...mutableOrderedOwnerIdsByPropertyId].map(
        ([propertyId, ownerIds]) =>
          [propertyId, Object.freeze(ownerIds)] as const
      )
    )
    const orderedCanonicalOwnerIds = (
      propertyId: string
    ): readonly string[] => {
      const ownerIds =
        orderedCanonicalOwnerIdsByPropertyId.get(propertyId) ?? []
      if (ownerIds.length === 0) {
        throw new Error(
          `[PropsManager] Property mutation cannot resolve canonical owner for evidence "${propertyId}"`
        )
      }
      return ownerIds
    }
    const createLifecycleCanonicalEvidence = (
      change: AddRemovePropertyChange
    ): NonNullable<UpdateTransactionEvent['canonicalEvidence']> => {
      const affectedOwnerIdSet = new Set<string>()
      const recordsByOwnerIds = new Map<
        string,
        {
          readonly orderedIds: readonly string[]
          readonly data: PropertyComponentRawData[]
        }
      >()
      change.data.forEach((property) => {
        const orderedIds = orderedCanonicalOwnerIds(property.id)
        orderedIds.forEach((orderedId) => affectedOwnerIdSet.add(orderedId))
        const key = JSON.stringify(orderedIds)
        const record = recordsByOwnerIds.get(key)
        if (record) {
          record.data.push(property)
          return
        }
        recordsByOwnerIds.set(key, {
          orderedIds,
          data: [property]
        })
      })
      const orderedIds = orderedOwnerIds.filter((orderedId) =>
        affectedOwnerIdSet.has(orderedId)
      )
      return {
        orderedIds,
        sharedRecords: [...recordsByOwnerIds.values()].map((record) => ({
          orderedIds: record.orderedIds,
          payload: {
            ...change,
            data: record.data
          }
        }))
      }
    }
    const transactionOptions: EVENT_OPTIONS = {
      ...(mutationOptions ?? {}),
      shared: mutationOptions?.shared ?? SharedDataChannelNames.PROPS
    }
    const createTransactionEvent = (
      change: PropsChange
    ): PreparedPropsTransactionEvent => {
      const canonicalEvidence = isUpdatePropertyChange(change)
        ? {
            orderedIds: orderedCanonicalOwnerIds(change.id)
          }
        : createLifecycleCanonicalEvidence(change)
      return {
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: change.eventName,
        payload: change,
        options: transactionOptions,
        canonicalEvidence
      }
    }
    const replaceLatestHistoryEvidenceByKey = new Map<
      string,
      UpdatePropertyChange
    >()
    replaceLatestHistoryEvidence.forEach((change) => {
      const eventKey = JSON.stringify([change.eventName, change.id, change.key])
      const existing = replaceLatestHistoryEvidenceByKey.get(eventKey)
      replaceLatestHistoryEvidenceByKey.set(
        eventKey,
        existing ? { ...change, before: existing.before } : change
      )
    })
    const replaceLatestHistoryCandidate =
      mutationOptions?.history?.mode === 'replace-latest' &&
      frozenEvidence.length > 0 &&
      frozenEvidence.every(isUpdatePropertyChange) &&
      replaceLatestHistoryEvidenceByKey.size > 0
        ? {
            key: mutationOptions.history.key,
            events: [...replaceLatestHistoryEvidenceByKey.values()].map(
              createTransactionEvent
            ),
            eventKeys: [...replaceLatestHistoryEvidenceByKey.keys()]
          }
        : undefined
    const transactionEvents = deepFreezePropertyContract(
      frozenEvidence.map((change, index): PreparedPropsTransactionEvent => ({
        ...createTransactionEvent(change),
        ...(index === 0 && replaceLatestHistoryCandidate
          ? { historyCandidate: replaceLatestHistoryCandidate }
          : {})
      }))
    )
    this.validatedPropertyMutationArtifacts.set(prepared, {
      owners,
      ownerRelations: frozenOwnerRelations,
      orderedPropertyIds: prepared.orderedPropertyIds,
      registrationContracts: Object.freeze([
        ...registrationContractByType.values()
      ]),
      ownerDefinitionContracts: Object.freeze([
        ...ownerDefinitionContractByKey.values()
      ]),
      readComponents: Object.freeze(readComponents),
      existingComponents: Object.freeze(existingComponents),
      createdComponents: Object.freeze(createdSnapshots),
      reactivatedComponents: Object.freeze([...reactivatedComponents.values()]),
      removedComponents: Object.freeze([...removedComponents]),
      relationshipChildrenReads: Object.freeze([
        ...relationshipChildrenReads.values()
      ]),
      relationshipOwnersReads: Object.freeze([
        ...relationshipOwnersReads.values()
      ]),
      sharedRetentionReads: Object.freeze([...sharedRetentionReads.values()]),
      retainedRootIdentityReads: Object.freeze(retainedRootIdentityReads),
      retainedRootRelationshipReads: Object.freeze([
        ...retainedRootRelationshipReads.values()
      ]),
      evidence: frozenEvidence,
      transactionEvents
    })
    return prepared
  }

  applyPreparedPropertyMutationBatch(
    prepared: PreparedPropertyMutationBatch
  ): PropertyMutationBatchResult {
    if (this.propertyMutationApplyActive) {
      throw new Error(
        '[PropsManager] Reentrant canonical property mutation apply is not allowed'
      )
    }
    this.propertyMutationApplyActive = true
    try {
      return this.applyOwnedPropertyMutationBatch(prepared)
    } finally {
      this.propertyMutationApplyActive = false
    }
  }

  private applyOwnedPropertyMutationBatch(
    prepared: PreparedPropertyMutationBatch
  ): PropertyMutationBatchResult {
    const artifact = this.validatedPropertyMutationArtifacts.get(prepared)
    if (!artifact) {
      throw new Error(
        '[PropsManager] Expected an owner-issued one-shot prepared property mutation batch'
      )
    }
    this.validatedPropertyMutationArtifacts.delete(prepared)

    artifact.ownerDefinitionContracts.forEach(
      ({ ownerElementType, ownerPropertyName, definition }) => {
        const current = elementPropertyRegistry.getForComponent(
          ownerElementType,
          ownerPropertyName
        )
        if (!current || !isEqual(current, definition)) {
          throw new Error(
            `[PropsManager] Detached property creation owner definition registration changed for "${ownerElementType}:${ownerPropertyName}"`
          )
        }
      }
    )

    this.assertPropertyCreationRegistrationReadiness(
      artifact.registrationContracts,
      new Set()
    )
    const sharedRetentionReadByChildId = new Map(
      artifact.sharedRetentionReads.map((read) => [read.childId, read] as const)
    )
    const reactivatedComponentById = new Map(
      artifact.reactivatedComponents.map(
        (read) => [read.before.id, read] as const
      )
    )
    const relationshipIndexesMatch =
      artifact.relationshipChildrenReads.every(
        ({ ownerId, present, childIds }) => {
          const current = this.relationshipChildIdsByOwnerId.get(ownerId)
          return (
            (current !== undefined) === present &&
            isEqual(current ?? [], childIds)
          )
        }
      ) &&
      artifact.relationshipOwnersReads.every(
        ({ childId, present, ownerIds }) => {
          const current = this.relationshipOwnerIdsByChildId.get(childId)
          const sharedRetentionRead = sharedRetentionReadByChildId.get(childId)
          if (sharedRetentionRead) {
            const currentOwnerIds = new Set(current ?? [])
            const preparedRemovedOwnerIds = new Set(
              sharedRetentionRead.preparedRemovedOwnerIds
            )
            return (
              sharedRetentionRead.preparedRemovedOwnerIds.every((ownerId) =>
                currentOwnerIds.has(ownerId)
              ) &&
              [...currentOwnerIds].some(
                (ownerId) => !preparedRemovedOwnerIds.has(ownerId)
              )
            )
          }
          return (
            (current !== undefined) === present &&
            isEqual([...(current ?? [])].sort(), ownerIds)
          )
        }
      )
    const retainedRootRelationshipsMatch =
      artifact.retainedRootRelationshipReads.every(
        ({
          propertyId,
          instance,
          relationKey,
          rawChildIds,
          indexedChildIds
        }) => {
          const currentRawChildIds = (
            instance as unknown as {
              data: Readonly<Record<string, unknown>>
            }
          ).data[relationKey]
          return (
            this._components.get(propertyId) === instance &&
            Array.isArray(currentRawChildIds) &&
            currentRawChildIds.every(
              (childId) => typeof childId === 'string'
            ) &&
            isEqual(currentRawChildIds, rawChildIds) &&
            isEqual(
              this.relationshipChildIdsByOwnerId.get(propertyId),
              indexedChildIds
            )
          )
        }
      )
    if (
      artifact.readComponents.some(
        ({ instance, before }) =>
          this._components.get(before.id) !== instance ||
          !isEqual(instance.save(), before)
      ) ||
      artifact.createdComponents.some(({ id }) => {
        const reactivated = reactivatedComponentById.get(id)
        return reactivated
          ? this._components.has(id) ||
              this._deletedMap.get(id) !== reactivated.instance ||
              !isEqual(reactivated.instance.save(), reactivated.before)
          : this._components.has(id) || this._deletedMap.has(id)
      }) ||
      artifact.retainedRootIdentityReads.some(
        ({ propertyId, instance }) =>
          this._components.get(propertyId) !== instance
      ) ||
      !retainedRootRelationshipsMatch ||
      !relationshipIndexesMatch
    ) {
      throw new Error(
        '[PropsManager] Property mutation prepared no longer matches active state'
      )
    }

    if (artifact.evidence.length === 0) {
      return deepFreezePropertyContract({
        owners: [...artifact.owners],
        ownerRelations: [...artifact.ownerRelations],
        orderedPropertyIds: [...artifact.orderedPropertyIds],
        evidence: [] as PropsChange[]
      })
    }

    const changeStart = this.changes.length
    const createdInstances: PropertyComponentInstanceTypes[] = []
    const reactivatedInstances = new Set<PropertyComponentInstanceTypes>()
    const stagedMutationInstances = new Map<
      string,
      PropertyComponentInstanceTypes
    >()
    const removedInstances: PropertyComponentInstanceTypes[] = []
    const removedPropertyIds = new Set(
      artifact.removedComponents.map((component) => component.get('id'))
    )
    let transactionBatchHandoffStarted = false
    try {
      const registrationContractByType = new Map(
        artifact.registrationContracts.map(
          (contract) => [contract.type, contract] as const
        )
      )
      this.propertyMutationStagedById = stagedMutationInstances
      runWithPropertyComponentAccessor(this.componentAccessor, () => {
        artifact.createdComponents.forEach((snapshot) => {
          const contract = registrationContractByType.get(snapshot.type)
          if (!contract) {
            throw new Error(
              `[PropsManager] Property mutation is missing registration for "${snapshot.id}"`
            )
          }
          const reactivated = reactivatedComponentById.get(snapshot.id)
          const component =
            reactivated?.instance ??
            this.propertyMutationStagedById?.get(snapshot.id) ??
            this.instantiateProperty(snapshot, contract.constructor)
          if (reactivated) {
            if (
              this._deletedMap.get(snapshot.id) !== component ||
              !isEqual(component.save(), snapshot)
            ) {
              throw new Error(
                `[PropsManager] Property mutation cannot reactivate changed record "${snapshot.id}"`
              )
            }
            this._deletedMap.delete(snapshot.id)
            reactivatedInstances.add(component)
          }
          createdInstances.push(component)
          this.addToMap(component)
        })
        if (
          this.propertyMutationStagedById?.size !== createdInstances.length ||
          createdInstances.some(
            (component) =>
              this.propertyMutationStagedById?.get(component.get('id')) !==
              component
          )
        ) {
          throw new Error(
            '[PropsManager] Property mutation materialized an inexact record graph'
          )
        }
        if (this.changes.length !== changeStart) {
          throw new Error(
            '[PropsManager] Property mutation materialization emitted property changes'
          )
        }
        this.assertPropertyCreationRegistrationReadiness(
          artifact.registrationContracts,
          new Set()
        )
        this.registerMany(createdInstances)
        this.propertyMutationStagedById = null
        artifact.existingComponents.forEach(({ instance, after }) => {
          instance.load(clonePropsValue(after))
          if (!isEqual(instance.save(), after)) {
            throw new Error(
              `[PropsManager] Property mutation changed exact data for "${after.id}"`
            )
          }
          if (!removedPropertyIds.has(after.id)) {
            this.refreshRelationshipOwnerEdges(instance, after)
          }
        })
        artifact.removedComponents.forEach((component) => {
          const propertyId = component.get('id')
          if (this._components.get(propertyId) !== component) {
            throw new Error(
              `[PropsManager] Property mutation cannot remove changed record "${propertyId}"`
            )
          }
          this.unregisterActiveComponent(propertyId)
          this._deletedMap.set(propertyId, component)
          removedInstances.push(component)
        })
      })

      const evidence = artifact.evidence
      transactionBatchHandoffStarted = true
      updateTransactionBatch(artifact.transactionEvents)
      acknowledgeTransactionReplayApplied()
      this.changes.splice(changeStart)
      this.advancePropertyStateRevision()
      return deepFreezePropertyContract({
        owners: [...artifact.owners],
        ownerRelations: [...artifact.ownerRelations],
        orderedPropertyIds: [...artifact.orderedPropertyIds],
        evidence
      })
    } catch (error) {
      this.propertyMutationStagedById = null
      this.changes.splice(changeStart)
      if (
        transactionBatchHandoffStarted &&
        reportsAcceptedPropertyMutationHandoff(error)
      ) {
        this.advancePropertyStateRevision()
        acknowledgeTransactionReplayApplied()
        throw error
      }
      const attemptCleanup = (operation: () => void): void => {
        try {
          operation()
        } catch {
          // Cleanup is best-effort and cannot replace the canonical apply failure.
        }
      }
      removedInstances.reverse().forEach((component) => {
        attemptCleanup(() => {
          const propertyId = component.get('id')
          this._deletedMap.delete(propertyId)
          this.registerActiveComponent(
            component,
            this.prepareRelationshipIndexEntry(component)
          )
        })
      })
      const restoreSnapshots = new Map<
        PropertyComponentInstanceTypes,
        PropertyComponentRawData
      >()
      artifact.existingComponents.forEach(({ instance, before }) => {
        restoreSnapshots.set(instance, before)
      })
      runWithPropertyComponentAccessor(this.componentAccessor, () => {
        restoreSnapshots.forEach((before, instance) => {
          attemptCleanup(() => {
            instance.load(clonePropsValue(before))
            const propertyId = before.id
            this._deletedMap.delete(propertyId)
            const relationshipChildIds = this.prepareRelationshipIndexEntry(
              instance,
              before
            )
            if (this._components.get(propertyId) !== instance) {
              this.registerActiveComponent(instance, relationshipChildIds)
            } else {
              this.replaceRelationshipOwnerEdges(
                propertyId,
                relationshipChildIds
              )
            }
          })
        })
      })
      new Set([
        ...createdInstances,
        ...stagedMutationInstances.values()
      ]).forEach((component) => {
        attemptCleanup(() => {
          const propertyId = component.get('id')
          if (this._components.get(propertyId) === component) {
            this.unregisterActiveComponent(propertyId)
          }
        })
        if (reactivatedInstances.has(component)) {
          attemptCleanup(() => {
            this._deletedMap.set(component.get('id'), component)
          })
        } else {
          attemptCleanup(() => {
            ;(component as unknown as { dispose?: () => void }).dispose?.()
          })
        }
      })
      throw error
    }
  }

  updateProperties(
    request: PropertyMutationBatchRequest
  ): PropertyMutationBatchResult {
    return this.applyPreparedPropertyMutationBatch(
      this.preparePropertyMutationBatch(request)
    )
  }

  updatePropsData(
    componentId: string,
    key: string,
    data: unknown,
    options?: EvnetOptions
  ) {
    const component = this.getPropertyById(componentId)
    if (!component) {
      return
    }

    runWithPropertyComponentAccessor(this.componentAccessor, () => {
      if (options) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component.set(key as any, data as any, options)
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component.set(key as any, data as any)
    })
  }

  updatePropertyById(
    propertyId: string,
    key: string,
    data: unknown,
    options?: EvnetOptions
  ) {
    this.updatePropsData(propertyId, key, data, options)
  }

  private prepareCanonicalPropertyBatch(): PropsChange[] {
    if (this.changes.length < 2) {
      return this.changes
    }

    const removeChanges = this.changes.filter(isRemovePropertyChange)
    if (removeChanges.length === this.changes.length) {
      const firstRemove = removeChanges[0]
      if (!firstRemove) {
        return this.changes
      }
      const { data: _firstData, ...firstRemoveContract } = firstRemove
      const removedIds = new Set<string>()
      const removedData: PropertyComponentRawData[] = []
      for (const removeChange of removeChanges) {
        const { data: _data, ...removeContract } = removeChange
        if (!isEqual(removeContract, firstRemoveContract)) {
          return this.changes
        }
        for (const propertyData of removeChange.data) {
          const propertyId = propertyData.id
          if (
            typeof propertyId !== 'string' ||
            propertyId.length === 0 ||
            removedIds.has(propertyId)
          ) {
            return this.changes
          }
          removedIds.add(propertyId)
          removedData.push(propertyData)
        }
      }
      return [
        {
          ...firstRemove,
          data: removedData
        }
      ]
    }

    const addChanges = this.changes.filter(isAddPropertyChange)
    if (addChanges.length === 0) {
      return this.changes
    }

    const firstAdd = addChanges[0]
    const { data: _firstData, ...firstAddContract } = firstAdd
    const orderedIds: string[] = []
    const createdIds = new Set<string>()
    const initialSnapshots = new Map<string, PropertyComponentRawData>()
    for (const addChange of addChanges) {
      const { data: _data, ...addContract } = addChange
      if (!isEqual(addContract, firstAddContract)) {
        return this.changes
      }
      for (const propertyData of addChange.data) {
        const propertyId = propertyData.id
        if (
          typeof propertyId !== 'string' ||
          propertyId.length === 0 ||
          createdIds.has(propertyId) ||
          !this.getPropertyById(propertyId)
        ) {
          return this.changes
        }
        createdIds.add(propertyId)
        orderedIds.push(propertyId)
        initialSnapshots.set(propertyId, propertyData)
      }
    }

    const observedAddIds = new Set<string>()
    const updatedIds = new Set<string>()
    const canBatch = this.changes.every((change) => {
      if (isAddPropertyChange(change)) {
        change.data.forEach(({ id }) => observedAddIds.add(id as string))
        return true
      }
      if (!isUpdatePropertyChange(change) || !observedAddIds.has(change.id)) {
        return false
      }
      updatedIds.add(change.id)
      return isEqual(change.options, firstAdd.options)
    })
    if (!canBatch) {
      return this.changes
    }

    const finalData = orderedIds.map((propertyId) => {
      if (!updatedIds.has(propertyId)) {
        const initialSnapshot = initialSnapshots.get(propertyId)
        if (!initialSnapshot) {
          throw new Error(
            `[PropsManager] Canonical property batch is missing initial snapshot "${propertyId}"`
          )
        }
        return initialSnapshot
      }

      const property = this.getPropertyById(propertyId)
      if (!property) {
        throw new Error(
          `[PropsManager] Canonical property batch is missing active property "${propertyId}"`
        )
      }
      return clonePropsValue(property.save())
    })
    return [
      {
        ...firstAdd,
        data: finalData
      }
    ]
  }

  prepareTransactionEvents(
    options?: EVENT_OPTIONS
  ): readonly PreparedPropsTransactionEvent[] {
    return this.prepareCanonicalPropertyBatch().map((change) => {
      const changeOptions = change.options ?? options
      const orderedIds = isUpdatePropertyChange(change)
        ? [change.id]
        : change.data.map(({ id }) => id)
      return {
        type: EventTypes.UPDATE_TRANSACTION,
        eventName: change.eventName,
        payload: change,
        options: {
          ...(changeOptions ?? {}),
          shared: changeOptions?.shared ?? SharedDataChannelNames.PROPS
        },
        canonicalEvidence: Object.freeze({
          orderedIds: Object.freeze(orderedIds)
        })
      }
    })
  }

  prepareCanonicalElementTransactionEvents(
    options?: EVENT_OPTIONS
  ): readonly PreparedPropsTransactionEvent[] {
    return this.prepareTransactionEvents(options)
  }

  createCanonicalPropertyDeliveryRecords(
    change: AddRemovePropertyChange,
    owners: readonly CanonicalPropertyDeliveryOwner[]
  ): readonly CanonicalPropertyDeliveryRecord[] {
    const propertyById = new Map<string, PropertyComponentRawData>()
    change.data.forEach((property) => {
      if (
        typeof property.id !== 'string' ||
        property.id.length === 0 ||
        propertyById.has(property.id)
      ) {
        throw new Error(
          '[PropsManager] Canonical property delivery requires unique property ids'
        )
      }
      propertyById.set(property.id, property)
    })

    const ownerIndexByPropertyId = new Map<string, number>()
    const childRelationByType = new Map<
      string,
      PropertyChildRelationDefinition | undefined
    >()
    owners.forEach(({ rootPropertyIds }, ownerIndex) => {
      const visitingPropertyIds = new Set<string>()
      const visit = (propertyId: string): void => {
        if (visitingPropertyIds.has(propertyId)) {
          throw new Error(
            `[PropsManager] Canonical property delivery has a relationship cycle at "${propertyId}"`
          )
        }
        if (ownerIndexByPropertyId.has(propertyId)) {
          return
        }
        const property = propertyById.get(propertyId)
        if (!property) {
          return
        }
        visitingPropertyIds.add(propertyId)
        ownerIndexByPropertyId.set(propertyId, ownerIndex)
        if (!childRelationByType.has(property.type)) {
          childRelationByType.set(
            property.type,
            getPropertyComponentCanonicalChildRelation(property.type)
          )
        }
        const childRelation = childRelationByType.get(property.type)
        if (childRelation) {
          const childIds = (
            property as unknown as Readonly<Record<string, unknown>>
          )[childRelation.key]
          if (
            !Array.isArray(childIds) ||
            childIds.some((childId) => typeof childId !== 'string')
          ) {
            throw new Error(
              `[PropsManager] Canonical property delivery has malformed child relation for "${propertyId}"`
            )
          }
          childIds.forEach(visit)
        }
        visitingPropertyIds.delete(propertyId)
      }
      rootPropertyIds.forEach(visit)
    })

    const dataByOwner = owners.map(() => [] as PropertyComponentRawData[])
    change.data.forEach((property) => {
      const ownerIndex = ownerIndexByPropertyId.get(property.id)
      if (ownerIndex === undefined) {
        throw new Error(
          `[PropsManager] Canonical property delivery has unowned property "${property.id}"`
        )
      }
      dataByOwner[ownerIndex].push(property)
    })
    return owners.map(({ orderedId }, ownerIndex) => ({
      orderedIds: [orderedId],
      payload: {
        ...change,
        data: dataByOwner[ownerIndex]
      }
    }))
  }

  commitChanges(options?: EVENT_OPTIONS) {
    this.prepareTransactionEvents(options).forEach((event) => {
      updateTransaction(event)
    })
    this.cleanChanges()
  }

  dispose() {
    const hadState =
      this._components.size > 0 ||
      this._deletedMap.size > 0 ||
      this.changes.length > 0
    const components = new Set([
      ...this._components.values(),
      ...this._deletedMap.values(),
      ...(this.propertyMutationStagedById?.values() ?? [])
    ])
    components.forEach((component) => {
      ;(component as unknown as { dispose?: () => void }).dispose?.()
    })
    this._components.clear()
    this._deletedMap.clear()
    this.relationshipChildIdsByOwnerId.clear()
    this.relationshipOwnerIdsByChildId.clear()
    this.changes = []
    this.propertyCreationBatch = null
    this.activePropertyBatch = null
    this.propertyMutationStagedById = null
    if (hadState) {
      this.advancePropertyStateRevision()
    }
  }

  reset() {
    this.dispose()
  }
}

const propsManager = new PropsManager()

export default propsManager
export { PropsManager }
