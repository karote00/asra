import type { PresetCompositionSuccess } from '../types'

interface CreatePresetCompositionSuccessOptions {
  engineId: string
  sharedGroups: readonly string[]
  capabilityBundles: readonly string[]
}

export const createPresetCompositionSuccess = ({
  engineId,
  sharedGroups,
  capabilityBundles
}: CreatePresetCompositionSuccessOptions): PresetCompositionSuccess => {
  const detachedSharedGroups = Object.freeze([...sharedGroups])
  const detachedCapabilityBundles = Object.freeze([...capabilityBundles])
  const order = Object.freeze([
    ...detachedSharedGroups.map((groupId) => `shared-defaults:${groupId}`),
    `concrete-engine:${engineId}`,
    ...detachedCapabilityBundles.map(
      (bundleId) => `capability-bundle:${bundleId}`
    ),
    'composition:completed'
  ])

  return Object.freeze({
    ok: true,
    state: 'completed',
    engineId,
    sharedGroups: detachedSharedGroups,
    capabilityBundles: detachedCapabilityBundles,
    order
  })
}
