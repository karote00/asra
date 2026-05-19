import type { StrokeOwnerKey } from './stroke-final-face'

export type StrokeOwnershipResolutionStatus = 'accepted' | 'blocked'

export type StrokeOwnershipResolutionReason =
  | 'explicit-owner-set'
  | 'typed-owner-fields'
  | 'missing-owner-metadata'

export interface StrokeOwnershipInput {
  ownerSet?: readonly StrokeOwnerKey[]
  owner?: StrokeOwnerKey
}

export interface ResolvedStrokeOwnership {
  status: StrokeOwnershipResolutionStatus
  reason: StrokeOwnershipResolutionReason
  ownerSet: StrokeOwnerKey[]
  primaryOwner?: StrokeOwnerKey
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`
}

export const hasDefinedStrokeOwnerField = (owner: StrokeOwnerKey) =>
  Object.values(owner).some((value) => value !== undefined)

export const pushUniqueStrokeOwner = (
  owners: StrokeOwnerKey[],
  owner: StrokeOwnerKey
) => {
  if (!hasDefinedStrokeOwnerField(owner)) {
    return
  }

  const signature = stableStringify(owner)
  if (!owners.some((candidate) => stableStringify(candidate) === signature)) {
    owners.push(owner)
  }
}

export const resolveStrokeOwnership = (
  input: StrokeOwnershipInput
): ResolvedStrokeOwnership => {
  const ownerSet: StrokeOwnerKey[] = []
  input.ownerSet?.forEach((owner) => pushUniqueStrokeOwner(ownerSet, owner))

  if (ownerSet.length > 0) {
    return {
      status: 'accepted',
      reason: 'explicit-owner-set',
      ownerSet,
      primaryOwner: ownerSet[0]
    }
  }

  if (input.owner) {
    pushUniqueStrokeOwner(ownerSet, input.owner)
  }

  if (ownerSet.length > 0) {
    return {
      status: 'accepted',
      reason: 'typed-owner-fields',
      ownerSet,
      primaryOwner: ownerSet[0]
    }
  }

  return {
    status: 'blocked',
    reason: 'missing-owner-metadata',
    ownerSet: []
  }
}
