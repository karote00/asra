export interface StrokeProductEvidenceVec2 {
  x: number
  y: number
}

export interface TerminalBodyOwnershipEvidenceRecord {
  overlayId: string
  bodyProductId: string
  intervalId: string
  splitRangeId?: string
  terminalRole: 'start' | 'end' | 'start-end'
  endpointCapPolicySignature: string
  seamBoundaryIds: readonly string[]
  joinOwnershipSignatures: readonly string[]
  ownerStepId: 'build-terminal-body-products'
  zeroVisibleContribution: true
}

export interface SmoothContinuityOwnershipEvidenceRecord {
  overlayId: string
  bodyProductIds: readonly string[]
  intervalIds: readonly string[]
  splitRangeIds: readonly string[]
  smoothContinuityGroupId: string
  tangentContinuityProof: {
    continuous: true
    previousTangent: StrokeProductEvidenceVec2
    nextTangent: StrokeProductEvidenceVec2
    tolerance: number
  }
  curveOffsetOuterBoundaryProof: {
    evidenceId: string
    basis: 'authored-source-curve-offset-at-stroke-width'
    strokeWidth: number
    verified: true
  }
  singleContinuousFootprintProof: true
  noSourceVertexJoinOwnershipProof: true
  ownerStepId: 'build-smooth-continuity-products'
  zeroVisibleContribution: true
}

export interface ConstrainedDashedProductEvidenceEnvelope {
  bodyProductIds: readonly string[]
  terminalOwnershipOverlays: readonly TerminalBodyOwnershipEvidenceRecord[]
  smoothContinuityOwnershipOverlays: readonly SmoothContinuityOwnershipEvidenceRecord[]
}

export const createConstrainedDashedProductEvidenceEnvelope = (
  bodyProductIds: readonly string[]
): ConstrainedDashedProductEvidenceEnvelope => ({
  bodyProductIds: Array.from(
    new Set(bodyProductIds.filter((bodyProductId) => bodyProductId.length > 0))
  ),
  terminalOwnershipOverlays: [],
  smoothContinuityOwnershipOverlays: []
})

export const appendTerminalOwnershipEvidenceToConstrainedDashedProductEnvelope = (
  envelope: ConstrainedDashedProductEvidenceEnvelope,
  overlays: readonly TerminalBodyOwnershipEvidenceRecord[]
): ConstrainedDashedProductEvidenceEnvelope => {
  const bodyProductIdSet = new Set(envelope.bodyProductIds)
  const overlayIdSet = new Set(
    envelope.terminalOwnershipOverlays.map((overlay) => overlay.overlayId)
  )
  const appendedOverlays = [...envelope.terminalOwnershipOverlays]

  for (const overlay of overlays) {
    if (
      !bodyProductIdSet.has(overlay.bodyProductId) ||
      overlay.overlayId.length === 0 ||
      overlayIdSet.has(overlay.overlayId)
    ) {
      continue
    }
    overlayIdSet.add(overlay.overlayId)
    appendedOverlays.push(overlay)
  }

  return appendedOverlays.length === envelope.terminalOwnershipOverlays.length
    ? envelope
    : {
        bodyProductIds: envelope.bodyProductIds,
        terminalOwnershipOverlays: appendedOverlays,
        smoothContinuityOwnershipOverlays:
          envelope.smoothContinuityOwnershipOverlays
      }
}

export const appendSmoothContinuityEvidenceToConstrainedDashedProductEnvelope = (
  envelope: ConstrainedDashedProductEvidenceEnvelope,
  overlays: readonly SmoothContinuityOwnershipEvidenceRecord[]
): ConstrainedDashedProductEvidenceEnvelope => {
  const bodyProductIdSet = new Set(envelope.bodyProductIds)
  const overlayIdSet = new Set(
    envelope.smoothContinuityOwnershipOverlays.map(
      (overlay) => overlay.overlayId
    )
  )
  const appendedOverlays = [
    ...envelope.smoothContinuityOwnershipOverlays
  ]

  for (const overlay of overlays) {
    if (
      !overlay.bodyProductIds.some((bodyProductId) =>
        bodyProductIdSet.has(bodyProductId)
      ) ||
      overlay.overlayId.length === 0 ||
      overlayIdSet.has(overlay.overlayId)
    ) {
      continue
    }
    overlayIdSet.add(overlay.overlayId)
    appendedOverlays.push(overlay)
  }

  return appendedOverlays.length ===
    envelope.smoothContinuityOwnershipOverlays.length
    ? envelope
    : {
        bodyProductIds: envelope.bodyProductIds,
        terminalOwnershipOverlays: envelope.terminalOwnershipOverlays,
        smoothContinuityOwnershipOverlays: appendedOverlays
      }
}

export const mergeConstrainedDashedProductEvidenceEnvelopes = (
  envelopes: readonly ConstrainedDashedProductEvidenceEnvelope[]
): ConstrainedDashedProductEvidenceEnvelope => {
  const bodyProductIds: string[] = []
  const terminalOwnershipOverlays: TerminalBodyOwnershipEvidenceRecord[] = []
  const smoothContinuityOwnershipOverlays: SmoothContinuityOwnershipEvidenceRecord[] =
    []
  const bodyProductIdSet = new Set<string>()
  const terminalOverlayIdSet = new Set<string>()
  const smoothOverlayIdSet = new Set<string>()

  for (const envelope of envelopes) {
    for (const bodyProductId of envelope.bodyProductIds) {
      if (bodyProductId.length > 0 && !bodyProductIdSet.has(bodyProductId)) {
        bodyProductIdSet.add(bodyProductId)
        bodyProductIds.push(bodyProductId)
      }
    }
    for (const overlay of envelope.terminalOwnershipOverlays) {
      if (!terminalOverlayIdSet.has(overlay.overlayId)) {
        terminalOverlayIdSet.add(overlay.overlayId)
        terminalOwnershipOverlays.push(overlay)
      }
    }
    for (const overlay of envelope.smoothContinuityOwnershipOverlays) {
      if (!smoothOverlayIdSet.has(overlay.overlayId)) {
        smoothOverlayIdSet.add(overlay.overlayId)
        smoothContinuityOwnershipOverlays.push(overlay)
      }
    }
  }

  return {
    bodyProductIds,
    terminalOwnershipOverlays,
    smoothContinuityOwnershipOverlays
  }
}
