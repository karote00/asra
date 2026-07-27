import {
  PropertyType,
  PROPS_ACTIONS,
  SharedDataChannelNames,
  isRecord
} from '@asyra/utils'
import type {
  EVENT_OPTIONS,
  LoadDiagnostic,
  UpdatePropertyChange,
  PropertyComponentInstanceTypes,
  PropertyComponentRawData,
  AddRemovePropertyChange,
  PropsRestorePlan,
  PropsRestoreSnapshot,
  PropsRestoreStrategy,
  ElementPropertyOwnerRelation,
  PropsChange,
  PropsComponentRawData,
  EvnetOptions,
  PropertySchema
} from '@asyra/utils'
import {
  acknowledgeTransactionReplayApplied,
  EventTypes,
  updateTransaction
} from '@asyra/reactive-events'
import { isEqual } from 'lodash'
import {
  createProperty,
  createPropertyWithConstructor
} from '../factories/create-property'
import type { PropertyComponentConstructor } from '../components'
import {
  arePropertyChildRelationsEqual,
  getPropertyComponent,
  getPropertyComponentBatchRebindableRelation,
  getPropertyComponentConfigDefinition,
  getPropertyComponentRegistrationRevision,
  isPropertyComponentBatchRebindable,
  type PropertyChildRelationDefinition
} from '../registries/property-component'
import { clonePropertyDefinitionValue } from '../registries/property-definition-value'
import elementPropertyRegistry from '../registries/property-definition'
import {
  getPropertySchemaRegistrationRevision,
  getRegisteredPropertySchema,
  runWithPropertySchemaResolver
} from '../registries/property-schema'
import {
  runWithPropertyComponentAccessor,
  setComponentAccessor,
  type PropertyComponentAccessor
} from './component-accessor'

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

type PropertyBatchPhaseSink = (name: string, durationMs: number) => void

const getPropertyBatchPhaseSink = (): PropertyBatchPhaseSink | undefined =>
  (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: PropertyBatchPhaseSink
    }
  ).__asyraBrowserDragPhaseSink

const finishUnmeasuredPropertyBatchPhase = () => undefined

const beginPropertyBatchPhase = (phaseName: string): (() => void) => {
  const sink = getPropertyBatchPhaseSink()
  if (!sink) {
    return finishUnmeasuredPropertyBatchPhase
  }

  const start = performance.now()
  return () => {
    try {
      sink(phaseName, performance.now() - start)
    } catch {
      // Profiling is detached observation and cannot change owner behavior.
    }
  }
}

export const measurePropertyBatchPhase = <T>(
  phaseName: string,
  run: () => T
): T => {
  const sink = getPropertyBatchPhaseSink()
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return run()
  } finally {
    try {
      sink(phaseName, performance.now() - start)
    } catch {
      // Profiling is detached observation and cannot change owner behavior.
    }
  }
}

const cloneLoadData = (data: PropsComponentRawData): PropsComponentRawData =>
  clonePropsValue(data)

const isAddPropertyChange = (
  change: PropsChange
): change is AddRemovePropertyChange =>
  change.action === PROPS_ACTIONS.ADD_PROPERTY &&
  change.eventName === EventTypes.ADD_PROPERTY

const isUpdatePropertyChange = (
  change: PropsChange
): change is UpdatePropertyChange =>
  change.action === PROPS_ACTIONS.UPDATE_PROPERTY &&
  change.eventName === EventTypes.UPDATE_PROPERTY

interface PropertyCreationBatchState {
  readonly changeStart: number
  readonly components: PropertyComponentInstanceTypes[]
  readonly componentIds: Set<string>
  readonly stagedById: Map<string, PropertyComponentInstanceTypes>
  readonly existingUpdates: UpdatePropertyChange[]
  readonly activeSchemaByType: ReadonlyMap<string, PropertySchema | undefined>
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
  if (value && typeof value === 'object') {
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

export interface PropertyCreationBatchReceipt<T> {
  readonly result: T
  rollback(): void
  complete(): void
}

export interface PropertyCreationPlan {
  readonly kind: 'property-creation-plan'
  readonly componentIds: readonly string[]
  readonly rootComponentIds: readonly string[]
}

export interface ActivePropertyPlan {
  readonly kind: 'active-property-plan'
  readonly componentIds: readonly string[]
  readonly rootComponentIds: readonly string[]
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
    PropsRestorePlan,
    {
      snapshot: PropsRestoreSnapshot
    }
  >()
  private validatedPropertyCreationArtifacts = new WeakMap<
    PropertyCreationPlan,
    {
      components: readonly PropertyComponentRawData[]
      registrationContracts: readonly PropertyCreationTypeContract[]
      parentFirstDeclarativeComponentIds: readonly string[]
      sourceSemantics: PropertyCreationSourceSemantics
    }
  >()
  private validatedActivePropertyArtifacts = new WeakMap<
    ActivePropertyPlan,
    {
      components: readonly PropertyComponentRawData[]
      instances: readonly PropertyComponentInstanceTypes[]
    }
  >()
  private readonly componentAccessor: PropertyComponentAccessor
  private propertyCreationBatch: PropertyCreationBatchState | null = null
  private activePropertyBatch: ActivePropertyBatchState | null = null

  constructor() {
    this.componentAccessor = {
      getPropertyById: (propertyId) =>
        this.resolvePropertyForComponent(propertyId),
      addToMap: (component) => this.addToMap(component),
      createComponent: (data) =>
        this.createProperty(data as Partial<PropertyComponentRawData>),
      addChange: (change) =>
        this.addChange({
          action: PROPS_ACTIONS.UPDATE_PROPERTY,
          eventName: EventTypes.UPDATE_PROPERTY,
          ...change
        })
    }
    setComponentAccessor(this.componentAccessor)
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

  addChange(change: PropsChange) {
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
      this.propertyCreationBatch &&
      isUpdatePropertyChange(change) &&
      this.propertyCreationBatch.componentIds.has(change.id)
    ) {
      if (
        change.ownerElementId !== undefined ||
        change.ownerPropertyName !== undefined ||
        change.options !== undefined
      ) {
        throw new Error(
          '[PropsManager] Canonical property creation batch received an incompatible update'
        )
      }
      return
    }
    if (this.propertyCreationBatch && isUpdatePropertyChange(change)) {
      this.propertyCreationBatch.existingUpdates.push(change)
    }
    this.changes.push(change)
  }

  cleanChanges() {
    this.changes = []
  }

  getPropertyById(
    propertyId: string
  ): PropertyComponentInstanceTypes | undefined {
    return this._components.get(propertyId)
  }

  private resolvePropertyForComponent(
    propertyId: string
  ): PropertyComponentInstanceTypes | undefined {
    return (
      this._components.get(propertyId) ??
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

    this.removeFromDeletedMap(comId)
    this._components.set(comId, component)
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
    this._components.delete(componentId)
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

  preflightPropertyCreationBatch(
    sourceComponents: unknown,
    sourceRootComponentIds: unknown
  ): PropertyCreationPlan {
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
  ): PropertyCreationPlan {
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
  ): PropertyCreationPlan {
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
          getPropertyComponentConfigDefinition(type)?.children
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

    const plan = Object.freeze({
      kind: 'property-creation-plan' as const,
      componentIds: Object.freeze([...componentIds]),
      rootComponentIds: Object.freeze([...uniqueRootComponentIds])
    })
    this.validatedPropertyCreationArtifacts.set(plan, {
      components: Object.freeze(components.map((component) => component)),
      registrationContracts: Object.freeze([
        ...registrationContractByType.values()
      ]),
      parentFirstDeclarativeComponentIds: Object.freeze([
        ...parentFirstDeclarativeComponentIds
      ]),
      sourceSemantics
    })
    return plan
  }

  applyPropertyCreationBatch(plan: PropertyCreationPlan): readonly string[] {
    if (!this.propertyCreationBatch) {
      throw new Error(
        '[PropsManager] Canonical property creation plan requires an active property creation batch'
      )
    }
    const artifact = this.validatedPropertyCreationArtifacts.get(plan)
    if (!artifact) {
      throw new Error(
        '[PropsManager] Expected an owner-issued one-shot property creation plan'
      )
    }
    this.validatedPropertyCreationArtifacts.delete(plan)

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
  ): ActivePropertyPlan {
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
  ): ActivePropertyPlan {
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
      const childRelation = getPropertyComponentConfigDefinition(
        component.type
      )?.children
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

    const plan = Object.freeze({
      kind: 'active-property-plan' as const,
      componentIds: Object.freeze([...componentIds]),
      rootComponentIds: Object.freeze([...uniqueRootComponentIds])
    })
    this.validatedActivePropertyArtifacts.set(plan, {
      components: Object.freeze(components.map((component) => component)),
      instances: Object.freeze([...instances])
    })
    return plan
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
        if (this._components.get(snapshot.id) !== component) {
          this._components.set(snapshot.id, component)
        }
        component.load(clonePropsValue(snapshot))
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
    const plan = this.preflightActivePropertyBatch(
      sourceComponents,
      sourceRootComponentIds
    )
    return this.consumeActivePropertyBatch(plan, operation, false)
  }

  runInActivePropertyBatch<T>(plan: ActivePropertyPlan, operation: () => T): T {
    return this.consumeActivePropertyBatch(plan, operation, true)
  }

  private consumeActivePropertyBatch<T>(
    plan: ActivePropertyPlan,
    operation: () => T,
    verifyEntryExact: boolean
  ): T {
    this.assertActivePropertyBatchCanStart()
    const artifact = this.validatedActivePropertyArtifacts.get(plan)
    if (!artifact) {
      throw new Error(
        '[PropsManager] Expected an owner-issued one-shot active property plan'
      )
    }
    this.validatedActivePropertyArtifacts.delete(plan)
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
      componentIds: new Set(plan.componentIds),
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
            getPropertyComponentConfigDefinition(snapshot.type)?.children
          ) {
            component.load(clonePropsValue(snapshot))
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
              this.getPropertyById(plan.componentIds[index]) !== component ||
              !isEqual(component.save(), batch.snapshots[index])
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
  ): PropsRestorePlan {
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
      ownerRelations as ElementPropertyOwnerRelation[]
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
      const config = getPropertyComponentConfigDefinition(component.type)
      const childRelation = config?.children
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

    const planEntries = components.map((component) => {
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
    const plan: PropsRestorePlan = Object.freeze({
      kind: 'props-restore-plan',
      entries: Object.freeze(planEntries),
      ownerRelations: Object.freeze(
        validatedRelations.map((relation) => Object.freeze(relation))
      )
    })
    this.validatedRestoreArtifacts.set(plan, {
      snapshot: validatedSnapshot
    })
    return plan
  }

  applyRestoreProperties(
    plan: PropsRestorePlan,
    options?: EVENT_OPTIONS
  ): readonly string[] {
    const artifact = this.validatedRestoreArtifacts.get(plan)
    if (!artifact) {
      throw new Error(
        '[PropsManager] Expected an owner-issued one-shot property restore plan'
      )
    }
    this.validatedRestoreArtifacts.delete(plan)

    const snapshotById = new Map(
      artifact.snapshot.components.map(
        (component) => [component.id, component] as const
      )
    )
    const materialized = new Map<string, PropertyComponentInstanceTypes>()
    try {
      plan.entries.forEach(({ componentId, strategy }) => {
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
      plan.entries.forEach(({ componentId }) => {
        const component = materialized.get(componentId)
        const data = snapshotById.get(componentId)
        if (!component || !data) {
          throw new Error(
            `[PropsManager] Cannot apply property restore: missing prepared component "${componentId}"`
          )
        }
        this.addToMap(component)
        runWithPropertyComponentAccessor(this.componentAccessor, () =>
          component.load(data)
        )
        if (!isEqual(component.save(), data)) {
          throw new Error(
            `[PropsManager] Cannot apply property restore: exact data changed for "${componentId}"`
          )
        }
        this.addChangeForAddProperty(component)
        appliedIds.push(componentId)
      })
    } catch (error) {
      this.changes.splice(changeStart)
      appliedIds.reverse().forEach((componentId) => {
        const component = this._components.get(componentId)
        this._components.delete(componentId)
        const strategy = plan.entries.find(
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
    properties: readonly PropertyComponentInstanceTypes[]
  ) {
    const snapshots = measurePropertyBatchPhase(
      'props-manager:creation-evidence-save',
      () => properties.map((property) => property.save())
    )
    const data = measurePropertyBatchPhase(
      'props-manager:creation-evidence-clone',
      () => clonePropsValue(snapshots)
    )
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
        getPropertyComponentConfigDefinition(registrationContract.type)
          ?.children
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
    measurePropertyBatchPhase('props-manager:creation-register', () => {
      components.forEach((component) => {
        const propertyId = component.get('id')
        if (
          batch.stagedById.get(propertyId) !== component ||
          this._components.has(propertyId) ||
          this._deletedMap.has(propertyId)
        ) {
          throw new Error(
            `[PropsManager] Canonical property creation batch cannot register property "${propertyId}"`
          )
        }
      })
      components.forEach((component) => {
        this._components.set(component.get('id'), component)
      })
    })
    return Object.freeze([...components])
  }

  createProperty(propData: Partial<PropertyComponentRawData>) {
    if (this.activePropertyBatch) {
      throw new Error(
        '[PropsManager] Active property reuse batch cannot create property'
      )
    }

    const create = () => this.instantiateProperty(propData)
    const newProperty = this.propertyCreationBatch
      ? create()
      : runWithPropertyComponentAccessor(this.componentAccessor, create)
    if (this.propertyCreationBatch) {
      this.stagePropertyCreation(newProperty)
    } else {
      this.addChangeForAddProperty(newProperty)
    }
    return newProperty
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
          this._components.delete(propertyId)
        }
        ;(component as unknown as { dispose?: () => void }).dispose?.()
      })
    this.changes.splice(batch.changeStart)
  }

  runInPropertyCreationBatch<T>(
    operation: () => T
  ): PropertyCreationBatchReceipt<T> {
    if (this.propertyCreationBatch) {
      return Object.freeze({
        result: operation(),
        rollback: () => undefined,
        complete: () => undefined
      })
    }

    const activeSchemaByType = new Map<string, PropertySchema | undefined>()
    this._components.forEach((component) => {
      const type = component.get('type')
      if (typeof type === 'string' && !activeSchemaByType.has(type)) {
        activeSchemaByType.set(
          type,
          snapshotPropertySchema(getRegisteredPropertySchema(type))
        )
      }
    })
    const batch: PropertyCreationBatchState = {
      changeStart: this.changes.length,
      components: [],
      componentIds: new Set(),
      stagedById: new Map(),
      existingUpdates: [],
      activeSchemaByType
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
          this.addChangeForAddProperties(batch.components)
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
    owner?: {
      ownerElementId: string
      ownerPropertyName: string
    },
    options?: EvnetOptions
  ) {
    const previousChangeCount = this.changes.length
    this.updatePropsData(propertyId, key, data, options)

    if (!owner || this.changes.length <= previousChangeCount) {
      return
    }

    const nextChange = this.changes[this.changes.length - 1]
    if (nextChange?.action !== PROPS_ACTIONS.UPDATE_PROPERTY) {
      return
    }

    const updateChange = nextChange as UpdatePropertyChange
    if (updateChange.id !== propertyId || updateChange.key !== key) {
      return
    }

    Object.assign(updateChange, owner)
  }

  private prepareCanonicalPropertyBatch(): PropsChange[] {
    if (this.changes.length < 2) {
      return this.changes
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
      if (
        !isUpdatePropertyChange(change) ||
        !observedAddIds.has(change.id) ||
        change.ownerElementId !== undefined ||
        change.ownerPropertyName !== undefined
      ) {
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

  commitChanges(options?: EVENT_OPTIONS) {
    this.prepareCanonicalPropertyBatch().forEach((change) => {
      const changeOptions = change.options ?? options
      const routedOptions: EVENT_OPTIONS = {
        ...(changeOptions ?? {}),
        shared: changeOptions?.shared ?? SharedDataChannelNames.PROPS
      }
      updateTransaction(change.eventName, change, routedOptions)
    })
    this.cleanChanges()
  }

  dispose() {
    const components = new Set([
      ...this._components.values(),
      ...this._deletedMap.values()
    ])
    components.forEach((component) => {
      ;(component as unknown as { dispose?: () => void }).dispose?.()
    })
    this._components.clear()
    this._deletedMap.clear()
    this.changes = []
    this.propertyCreationBatch = null
    this.activePropertyBatch = null
  }

  reset() {
    this.dispose()
  }
}

const propsManager = new PropsManager()

export default propsManager
export { PropsManager }
