export type StrokeDescriptorRouteKind =
  | 'same-owner-smooth-span'
  | 'outside-dashed-visible-band'
  | 'center-authored-stroke'
  | 'constrained-solid-smooth-span'

export type StrokeDescriptorRequiredLegalityBasis =
  | 'post-legality-product'
  | 'legality-equivalent-pre-product'

export type StrokeDescriptorOutputChannelIntent =
  | 'render-only'
  | 'render-and-hit-export'
  | 'diagnostics-only'

export interface StrokeDescriptorOwnerBoundarySplitProof {
  ownerBoundaryId: string
  splitProofId: string
  complete: boolean
}

export interface StrokeDescriptorLegalityEquivalenceEvidence {
  basisId: string
  complete: boolean
}

export interface StrokeDescriptorStrategyCandidate {
  candidateId: string
  descriptorRouteKind: StrokeDescriptorRouteKind
  requiredLegalityBasis: StrokeDescriptorRequiredLegalityBasis
  outputChannelIntent: StrokeDescriptorOutputChannelIntent
  productBuilderId: string
  ownerBoundarySplitProof: StrokeDescriptorOwnerBoundarySplitProof
  legalityEquivalenceEvidence?: StrokeDescriptorLegalityEquivalenceEvidence
}

export interface StrokeDescriptorStrategyRecord {
  strategyId: string
  ownerStage: 'Stroke Geometry descriptor strategy selection'
  status: 'descriptor-eligible' | 'canonical-product-required'
  descriptorRouteKind: StrokeDescriptorRouteKind
  requiredLegalityBasis: StrokeDescriptorRequiredLegalityBasis
  outputChannelIntent: StrokeDescriptorOutputChannelIntent
  productBuilderId: string
  materializationStage: 'after-apply-legality'
  consumesPostLegalityArtifact: boolean
  ownerBoundarySplitProof: StrokeDescriptorOwnerBoundarySplitProof
  legalityEquivalenceEvidence?: StrokeDescriptorLegalityEquivalenceEvidence
}

export interface SelectStrokeDescriptorStrategyInput {
  candidates: StrokeDescriptorStrategyCandidate[]
}

const hasRequiredDescriptorLegalBasis = (
  candidate: StrokeDescriptorStrategyCandidate
) =>
  candidate.requiredLegalityBasis === 'post-legality-product' ||
  candidate.legalityEquivalenceEvidence?.complete === true

const consumesPostLegalityArtifact = (
  candidate: StrokeDescriptorStrategyCandidate
) => candidate.requiredLegalityBasis === 'post-legality-product'

export const selectStrokeDescriptorStrategy = (
  input: SelectStrokeDescriptorStrategyInput
): StrokeDescriptorStrategyRecord[] =>
  input.candidates.map((candidate) => ({
    strategyId: `strategy:${candidate.candidateId}`,
    ownerStage: 'Stroke Geometry descriptor strategy selection',
    status:
      candidate.ownerBoundarySplitProof.complete &&
      hasRequiredDescriptorLegalBasis(candidate)
        ? 'descriptor-eligible'
        : 'canonical-product-required',
    descriptorRouteKind: candidate.descriptorRouteKind,
    requiredLegalityBasis: candidate.requiredLegalityBasis,
    outputChannelIntent: candidate.outputChannelIntent,
    productBuilderId: candidate.productBuilderId,
    materializationStage: 'after-apply-legality',
    consumesPostLegalityArtifact: consumesPostLegalityArtifact(candidate),
    ownerBoundarySplitProof: candidate.ownerBoundarySplitProof,
    legalityEquivalenceEvidence: candidate.legalityEquivalenceEvidence
  }))

export interface StrokeDescriptorRenderDescriptorInput {
  strokePathGroups?: unknown
  strokePaths?: unknown
  fillClipPolygons?: unknown
  fillExcludePolygons?: unknown
  descriptorProductPolygons?: unknown
}

export interface StrokeDescriptorFinalFaceInput {
  faceId: string
  renderDescriptor?: StrokeDescriptorRenderDescriptorInput
  debugMeta?: {
    ownerStage?: string
  }
}

export interface MaterializeStrokeProductDescriptorsInput {
  finalFaces: StrokeDescriptorFinalFaceInput[]
  strategies: StrokeDescriptorStrategyRecord[]
}

export interface MaterializedStrokeProductDescriptor {
  descriptorId: string
  ownerStage: 'Product Output descriptor materialization'
  finalFaceId: string
  descriptorRouteKind: StrokeDescriptorRouteKind
  productBuilderId: string
  outputChannelIntent: StrokeDescriptorOutputChannelIntent
  visibleChannel: {
    strokePathGroups?: unknown
    strokePaths?: unknown
  }
  evidenceChannel: {
    descriptorProductPolygons?: unknown
    fillClipPolygons?: unknown
    fillExcludePolygons?: unknown
  }
  ownerMetadata: {
    finalFaceOwnerStage?: string
    strategyOwnerStage: StrokeDescriptorStrategyRecord['ownerStage']
  }
}

const getDescriptorVisibleChannel = (
  descriptor: StrokeDescriptorRenderDescriptorInput
): MaterializedStrokeProductDescriptor['visibleChannel'] => ({
  ...(descriptor.strokePathGroups !== undefined
    ? { strokePathGroups: descriptor.strokePathGroups }
    : {}),
  ...(descriptor.strokePaths !== undefined
    ? { strokePaths: descriptor.strokePaths }
    : {})
})

const getDescriptorEvidenceChannel = (
  descriptor: StrokeDescriptorRenderDescriptorInput
): MaterializedStrokeProductDescriptor['evidenceChannel'] => ({
  ...(descriptor.descriptorProductPolygons !== undefined
    ? { descriptorProductPolygons: descriptor.descriptorProductPolygons }
    : {}),
  ...(descriptor.fillClipPolygons !== undefined
    ? { fillClipPolygons: descriptor.fillClipPolygons }
    : {}),
  ...(descriptor.fillExcludePolygons !== undefined
    ? { fillExcludePolygons: descriptor.fillExcludePolygons }
    : {})
})

export const materializeStrokeProductDescriptors = (
  input: MaterializeStrokeProductDescriptorsInput
): MaterializedStrokeProductDescriptor[] => {
  const strategy = input.strategies.find(
    (entry) => entry.status === 'descriptor-eligible'
  )
  if (!strategy) {
    return []
  }

  return input.finalFaces.flatMap(
    (face): MaterializedStrokeProductDescriptor[] => {
      if (!face.renderDescriptor) {
        return []
      }

      return [
        {
          descriptorId: `descriptor:${face.faceId}`,
          ownerStage: 'Product Output descriptor materialization',
          finalFaceId: face.faceId,
          descriptorRouteKind: strategy.descriptorRouteKind,
          productBuilderId: strategy.productBuilderId,
          outputChannelIntent: strategy.outputChannelIntent,
          visibleChannel: getDescriptorVisibleChannel(face.renderDescriptor),
          evidenceChannel: getDescriptorEvidenceChannel(face.renderDescriptor),
          ownerMetadata: {
            finalFaceOwnerStage: face.debugMeta?.ownerStage,
            strategyOwnerStage: strategy.ownerStage
          }
        }
      ]
    }
  )
}
