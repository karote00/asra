import { hasExactOwnKeys, isPlainRecord } from '../domain/records'
import { GEOMETRY_PROFILE, validIdentifier } from '../domain/workcell'

export interface BodyOrigin {
  candidateId: string
  bodyId: string
}
export interface CandidateLineage {
  version: 1
  copiedFromCandidateId: string
  bodyOrigins: Readonly<Record<string, BodyOrigin>>
}

export function validCandidateLineage(
  input: unknown
): input is CandidateLineage {
  if (
    !hasExactOwnKeys(input, [
      'version',
      'copiedFromCandidateId',
      'bodyOrigins'
    ]) ||
    input.version !== 1 ||
    !validIdentifier(input.copiedFromCandidateId) ||
    !isPlainRecord(input.bodyOrigins)
  )
    return false
  const entries = Object.entries(input.bodyOrigins)
  if (entries.length > GEOMETRY_PROFILE.maxBodies) return false
  const origins = new Set<string>()
  return entries.every(([id, origin]) => {
    if (
      !validIdentifier(id) ||
      !hasExactOwnKeys(origin, ['candidateId', 'bodyId']) ||
      !validIdentifier(origin.candidateId) ||
      !validIdentifier(origin.bodyId)
    )
      return false
    const key = JSON.stringify([origin.candidateId, origin.bodyId])
    if (origins.has(key)) return false
    origins.add(key)
    return true
  })
}
