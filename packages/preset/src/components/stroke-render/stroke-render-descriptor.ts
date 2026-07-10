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
  ownerStepId: 'select-stroke-descriptor-strategy'
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
    ownerStepId: 'select-stroke-descriptor-strategy',
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
  ownerStepIds: string[]
  bodyProductIds?: string[]
  terminalOverlayIds?: string[]
  smoothOverlayIds?: string[]
  strokeSpecKey?: string
  intervalIds?: string[]
  terminalRoles?: ('start' | 'end' | 'start-end' | 'middle')[]
  seamBoundaryIds?: string[]
  sourceSpanIds?: string[]
  legalDomainIds?: string[]
  productSignature?: string
  domainMode?: string
  renderDescriptor?: StrokeDescriptorRenderDescriptorInput
  debugMeta?: {
    ownerStage?: string
    revisionSet?: unknown
    dashEndpointCapPolicySignatures?: string[]
    joinOwnershipSignatures?: string[]
    domainPlanSelectedSides?: (1 | -1)[]
    smoothContinuityGroupIds?: string[]
  }
}

export interface MaterializeStrokeProductDescriptorsInput {
  finalFaces: StrokeDescriptorFinalFaceInput[]
  strategies: StrokeDescriptorStrategyRecord[]
}

export interface MaterializedStrokeProductDescriptor {
  descriptorId: string
  ownerStepId: 'materialize-stroke-product-descriptors'
  ownerStage: 'Product Output descriptor materialization'
  finalFaceId: string
  strategyId: string
  descriptorRouteKind: StrokeDescriptorRouteKind
  requiredLegalityBasis: StrokeDescriptorRequiredLegalityBasis
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
    finalFaceOwnerStepIds: string[]
    strategyOwnerStage: StrokeDescriptorStrategyRecord['ownerStage']
  }
  productIdentity: {
    sourceRevision?: unknown
    strokeSignature?: string
    productSignature?: string
    domainMode?: string
    intervalIds: string[]
    bodyProductIds: string[]
    terminalOverlayIds: string[]
    smoothOverlayIds: string[]
    terminalRoles: ('start' | 'end' | 'start-end' | 'middle')[]
    seamBoundaryIds: string[]
    sourceSpanIds: string[]
    legalDomainIds: string[]
    endpointCapPolicySignatures: string[]
    joinOwnershipSignatures: string[]
    legalSides: (1 | -1)[]
    smoothContinuityGroupIds: string[]
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
): MaterializedStrokeProductDescriptor[] =>
  input.finalFaces.flatMap(
    (face): MaterializedStrokeProductDescriptor[] => {
      if (!face.renderDescriptor) {
        return []
      }

      const matchingStrategies = input.strategies.filter(
        (entry) =>
          entry.status === 'descriptor-eligible' &&
          entry.ownerBoundarySplitProof.complete &&
          (entry.requiredLegalityBasis === 'post-legality-product'
            ? entry.consumesPostLegalityArtifact
            : entry.legalityEquivalenceEvidence?.complete === true) &&
          face.ownerStepIds.includes(entry.productBuilderId)
      )
      if (matchingStrategies.length !== 1) {
        return []
      }
      const [strategy] = matchingStrategies

      return [
        {
          descriptorId: `descriptor:${face.faceId}`,
          ownerStepId: 'materialize-stroke-product-descriptors',
          ownerStage: 'Product Output descriptor materialization',
          finalFaceId: face.faceId,
          strategyId: strategy.strategyId,
          descriptorRouteKind: strategy.descriptorRouteKind,
          requiredLegalityBasis: strategy.requiredLegalityBasis,
          productBuilderId: strategy.productBuilderId,
          outputChannelIntent: strategy.outputChannelIntent,
          visibleChannel:
            strategy.outputChannelIntent === 'diagnostics-only'
              ? {}
              : getDescriptorVisibleChannel(face.renderDescriptor),
          evidenceChannel: getDescriptorEvidenceChannel(face.renderDescriptor),
          ownerMetadata: {
            finalFaceOwnerStage: face.debugMeta?.ownerStage,
            finalFaceOwnerStepIds: [...face.ownerStepIds],
            strategyOwnerStage: strategy.ownerStage
          },
          productIdentity: {
            sourceRevision: face.debugMeta?.revisionSet,
            strokeSignature: face.strokeSpecKey,
            productSignature: face.productSignature,
            domainMode: face.domainMode,
            intervalIds: [...(face.intervalIds ?? [])],
            bodyProductIds: [...(face.bodyProductIds ?? [])],
            terminalOverlayIds: [...(face.terminalOverlayIds ?? [])],
            smoothOverlayIds: [...(face.smoothOverlayIds ?? [])],
            terminalRoles: [...(face.terminalRoles ?? [])],
            seamBoundaryIds: [...(face.seamBoundaryIds ?? [])],
            sourceSpanIds: [...(face.sourceSpanIds ?? [])],
            legalDomainIds: [...(face.legalDomainIds ?? [])],
            endpointCapPolicySignatures: [
              ...(face.debugMeta?.dashEndpointCapPolicySignatures ?? [])
            ],
            joinOwnershipSignatures: [
              ...(face.debugMeta?.joinOwnershipSignatures ?? [])
            ],
            legalSides: [...(face.debugMeta?.domainPlanSelectedSides ?? [])],
            smoothContinuityGroupIds: [
              ...(face.debugMeta?.smoothContinuityGroupIds ?? [])
            ]
          }
        }
      ]
    }
  )
