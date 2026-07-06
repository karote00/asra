import type { RenderableStroke } from './renderable-stroke'
import type { StrokeProductFamilyScope } from './resolved-source-family'
import type {
  StrokeDomainMode,
  StrokeIntervalDomainKind
} from './stroke-domain-plan'

export type StrokeProductFamilyId =
  | 'center'
  | 'constrained-solid'
  | 'constrained-dashed'
  | 'none'

export type StrokeProductFamilyRouteId =
  | 'build-center-stroke-products'
  | 'build-constrained-solid-products'
  | 'build-dash-interval-body-products'
  | 'build-source-vertex-join-products'
  | 'build-terminal-body-products'
  | 'build-smooth-continuity-products'

export interface StrokeProductFamilySelection {
  productFamilyId: StrokeProductFamilyId
  selectedRouteIds: StrokeProductFamilyRouteId[]
  coExecutionRouteIds: StrokeProductFamilyRouteId[]
  predicateInputs: {
    strokeStyle: RenderableStroke['style']
    strokePosition: RenderableStroke['position']
    domainMode: StrokeDomainMode | null
    intervalDomainKind: StrokeIntervalDomainKind
    sourceFamilyScope: StrokeProductFamilyScope
  }
  sourceSignature: string
  domainSignature: string
  dashSignature: string
  diagnostics: string[]
}

export interface SelectStrokeProductFamilyInput {
  stroke: Pick<RenderableStroke, 'style' | 'position'>
  sourceFamily:
    | { familyScope: StrokeProductFamilyScope }
    | { productRuleEvidence: { familyScope: StrokeProductFamilyScope } }
  domainPlan: {
    planId: string
    sourceId: string
    networkId: string
    domainMode: StrokeDomainMode | null
    intervalDomainKind: StrokeIntervalDomainKind
  }
  dashSignature?: string
}

const CONSTRAINED_DASHED_ROUTE_SET: StrokeProductFamilyRouteId[] = [
  'build-dash-interval-body-products',
  'build-source-vertex-join-products',
  'build-terminal-body-products',
  'build-smooth-continuity-products'
]

const getSourceFamilyScope = (
  sourceFamily: SelectStrokeProductFamilyInput['sourceFamily']
): StrokeProductFamilyScope =>
  'familyScope' in sourceFamily
    ? sourceFamily.familyScope
    : sourceFamily.productRuleEvidence.familyScope

const isConstrainedPosition = (
  position: RenderableStroke['position']
): position is 'inside' | 'outside' =>
  position === 'inside' || position === 'outside'

export const selectStrokeProductFamily = ({
  stroke,
  sourceFamily,
  domainPlan,
  dashSignature = 'dash:none'
}: SelectStrokeProductFamilyInput): StrokeProductFamilySelection => {
  const sourceFamilyScope = getSourceFamilyScope(sourceFamily)
  const predicateInputs = {
    strokeStyle: stroke.style,
    strokePosition: stroke.position,
    domainMode: domainPlan.domainMode,
    intervalDomainKind: domainPlan.intervalDomainKind,
    sourceFamilyScope
  }
  const sourceSignature = [
    domainPlan.sourceId,
    domainPlan.networkId,
    sourceFamilyScope
  ].join(':')
  const domainSignature = [
    domainPlan.planId,
    domainPlan.domainMode ?? 'none',
    domainPlan.intervalDomainKind
  ].join(':')

  if (
    domainPlan.domainMode === null ||
    domainPlan.intervalDomainKind === 'none'
  ) {
    return {
      productFamilyId: 'none',
      selectedRouteIds: [],
      coExecutionRouteIds: [],
      predicateInputs,
      sourceSignature,
      domainSignature,
      dashSignature,
      diagnostics: ['stroke-domain-plan-has-no-product-family']
    }
  }

  if (domainPlan.domainMode === 'center-product') {
    return {
      productFamilyId: 'center',
      selectedRouteIds: ['build-center-stroke-products'],
      coExecutionRouteIds: [],
      predicateInputs,
      sourceSignature,
      domainSignature,
      dashSignature,
      diagnostics: []
    }
  }

  if (stroke.style === 'dashed' && isConstrainedPosition(stroke.position)) {
    return {
      productFamilyId: 'constrained-dashed',
      selectedRouteIds: [],
      coExecutionRouteIds: CONSTRAINED_DASHED_ROUTE_SET,
      predicateInputs,
      sourceSignature,
      domainSignature,
      dashSignature,
      diagnostics: []
    }
  }

  if (isConstrainedPosition(stroke.position)) {
    return {
      productFamilyId: 'constrained-solid',
      selectedRouteIds: ['build-constrained-solid-products'],
      coExecutionRouteIds: [],
      predicateInputs,
      sourceSignature,
      domainSignature,
      dashSignature,
      diagnostics: []
    }
  }

  return {
    productFamilyId: 'center',
    selectedRouteIds: ['build-center-stroke-products'],
    coExecutionRouteIds: [],
    predicateInputs,
    sourceSignature,
    domainSignature,
    dashSignature,
    diagnostics: []
  }
}
