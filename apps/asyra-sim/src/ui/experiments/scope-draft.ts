import type { ExperimentDraft } from '../../common-apis/experiment'

export function scopeWithBodyRole(
  scope: ExperimentDraft['scope'],
  bodyId: string,
  role: string
): ExperimentDraft['scope'] {
  const primaryBodyIds = scope.primaryBodyIds
    .filter((id) => id !== bodyId)
    .concat(role === 'primary' ? [bodyId] : [])

  const influencingBodyIds = scope.influencingBodyIds
    .filter((id) => id !== bodyId)
    .concat(role === 'influencing' ? [bodyId] : [])

  return {
    ...scope,
    primaryBodyIds,
    influencingBodyIds,
    acknowledgedExcludedVisibleBodyIds:
      scope.acknowledgedExcludedVisibleBodyIds.filter(
        (id) => !primaryBodyIds.includes(id) && !influencingBodyIds.includes(id)
      )
  }
}
