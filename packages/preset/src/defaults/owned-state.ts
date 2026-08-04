import { getRegistrationRefKey, type RegistrationRef } from '@asyra/utils'
import { PRESET_REGISTRATION_OWNER } from '../registration.js'
import { PRESET_SYSTEM_PROPERTY_KEYS } from '../system-property-keys.js'
import type { PresetCoreAPIs } from '../types.js'

const unregisterRegistration = (
  core: PresetCoreAPIs,
  ref: RegistrationRef
): void => {
  switch (ref.kind) {
    case 'component':
      core.unregisterComponent(ref.key)
      return
    case 'feature':
      core.unregisterFeature(ref.key)
      return
    case 'property':
      core.unregisterPropertyType(ref.key)
      return
    case 'render-strategy':
      core.unregisterRenderStrategy(ref.key)
      return
    case 'ui-property':
      core.unregisterUIProperty(ref.key)
      return
    default:
      throw new Error(
        `Preset registration "${ref.kind}:${ref.key}" has no cleanup owner`
      )
  }
}

export const createOwnedStateCleanup = (core: PresetCoreAPIs): (() => void) => {
  const registrationsBefore = new Set(
    core.getRegistrations().map(({ ref }) => getRegistrationRefKey(ref))
  )
  const systemPropertiesBefore = new Set(
    PRESET_SYSTEM_PROPERTY_KEYS.filter((key) => core.hasSystemProperty(key))
  )
  let pendingRegistrations: RegistrationRef[] | null = null
  let pendingSystemProperties: string[] | null = null

  return () => {
    pendingRegistrations ??= core
      .getRegistrations()
      .filter(
        ({ ref, owner }) =>
          !registrationsBefore.has(getRegistrationRefKey(ref)) &&
          owner.packageName === PRESET_REGISTRATION_OWNER.packageName &&
          owner.name === PRESET_REGISTRATION_OWNER.name
      )
      .map(({ ref }) => ref)
    pendingSystemProperties ??= PRESET_SYSTEM_PROPERTY_KEYS.filter(
      (key) => !systemPropertiesBefore.has(key) && core.hasSystemProperty(key)
    )

    const failures: unknown[] = []
    for (let index = pendingRegistrations.length - 1; index >= 0; index--) {
      const ref = pendingRegistrations[index]
      try {
        const registration = core.getRegistration(ref)
        if (
          registration &&
          registration.owner.packageName ===
            PRESET_REGISTRATION_OWNER.packageName &&
          registration.owner.name === PRESET_REGISTRATION_OWNER.name
        ) {
          unregisterRegistration(core, ref)
        }
        pendingRegistrations.splice(index, 1)
      } catch (error) {
        failures.push(error)
      }
    }
    for (let index = pendingSystemProperties.length - 1; index >= 0; index--) {
      const key = pendingSystemProperties[index]
      try {
        if (core.hasSystemProperty(key)) {
          core.unregisterSystemProperty(key)
        }
        pendingSystemProperties.splice(index, 1)
      } catch (error) {
        failures.push(error)
      }
    }

    if (failures.length > 0) {
      throw failures[0]
    }
  }
}
