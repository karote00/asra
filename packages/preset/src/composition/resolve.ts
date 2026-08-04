import { PresetCatalog } from '../catalog.js'
import { PRESET_APPLY_ERROR_CODES, PresetProfiles } from '../constants.js'
import type {
  ApplyPresetOptions,
  PresetCoreAPIs,
  PresetDefaultId,
  PresetProfile
} from '../types.js'
import { PresetApplyError } from './error.js'

export interface PresetRequestResolutionState {
  readonly alreadyApplied?: boolean
}

export interface ResolvedPresetRequest {
  readonly profile: PresetProfile
  readonly selectedDefaults: readonly PresetDefaultId[]
  readonly appliedDefaults: readonly PresetDefaultId[]
}

const allowedOptionKeys = new Set<keyof ApplyPresetOptions>([
  'profile',
  'defaults'
])

const fail = (code: PresetApplyError['code'], message: string): never => {
  throw new PresetApplyError(code, message)
}

const parseOptions = (value: unknown): ApplyPresetOptions => {
  if (value === undefined) return {}
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(
      PRESET_APPLY_ERROR_CODES.INVALID_OPTIONS,
      'Preset options must be an object'
    )
  }

  const unknownKey = Object.keys(value).find(
    (key) => !allowedOptionKeys.has(key as keyof ApplyPresetOptions)
  )
  if (unknownKey) {
    return fail(
      PRESET_APPLY_ERROR_CODES.INVALID_OPTIONS,
      `Unknown preset option "${unknownKey}"`
    )
  }

  return value as ApplyPresetOptions
}

const resolveProfile = (value: unknown): PresetProfile => {
  const profile = value ?? PresetProfiles['2D']
  const entry = PresetCatalog.profiles.find(({ id }) => id === profile)
  if (!entry) {
    return fail(
      PRESET_APPLY_ERROR_CODES.UNKNOWN_PROFILE,
      `Unknown preset profile "${String(profile)}"`
    )
  }
  if (!entry.available) {
    return fail(
      PRESET_APPLY_ERROR_CODES.UNAVAILABLE_PROFILE,
      `Preset profile "${entry.id}" is unavailable`
    )
  }
  return entry.id
}

const resolveSelectedDefaults = (
  value: unknown
): readonly PresetDefaultId[] => {
  if (value === undefined) {
    return PresetCatalog.defaults
      .filter(({ available }) => available)
      .map(({ id }) => id)
  }
  if (!Array.isArray(value)) {
    return fail(
      PRESET_APPLY_ERROR_CODES.INVALID_OPTIONS,
      'Preset defaults must be an array'
    )
  }

  const requested = [...value]
  const seen = new Set<PresetDefaultId>()
  requested.forEach((candidate) => {
    const entry = PresetCatalog.defaults.find(({ id }) => id === candidate)
    if (!entry) {
      return fail(
        PRESET_APPLY_ERROR_CODES.UNKNOWN_DEFAULT,
        `Unknown preset default "${String(candidate)}"`
      )
    }
    if (!entry.available) {
      fail(
        PRESET_APPLY_ERROR_CODES.UNAVAILABLE_DEFAULT,
        `Preset default "${entry.id}" is unavailable`
      )
    }
    if (seen.has(entry.id)) {
      fail(
        PRESET_APPLY_ERROR_CODES.DUPLICATE_DEFAULT,
        `Preset default "${entry.id}" is duplicated`
      )
    }
    seen.add(entry.id)
  })

  return PresetCatalog.defaults
    .filter(({ id }) => seen.has(id))
    .map(({ id }) => id)
}

const expandDefaults = (
  selectedDefaults: readonly PresetDefaultId[]
): readonly PresetDefaultId[] => {
  const applied = new Set<PresetDefaultId>()
  const addWithDependencies = (id: PresetDefaultId): void => {
    if (applied.has(id)) return
    const entry = PresetCatalog.defaults.find(
      (candidate) => candidate.id === id
    )
    entry?.requires.forEach(addWithDependencies)
    applied.add(id)
  }
  selectedDefaults.forEach(addWithDependencies)
  return PresetCatalog.defaults
    .filter(({ id }) => applied.has(id))
    .map(({ id }) => id)
}

export const resolvePresetRequest = (
  core: Pick<PresetCoreAPIs, 'hasRenderEngineProvider' | 'isCompositionOpen'>,
  rawOptions?: ApplyPresetOptions,
  state: PresetRequestResolutionState = {}
): ResolvedPresetRequest => {
  const options = parseOptions(rawOptions)
  const profile = resolveProfile(options.profile)
  const selectedDefaults = resolveSelectedDefaults(options.defaults)
  const appliedDefaults = expandDefaults(selectedDefaults)

  if (!core.isCompositionOpen()) {
    return fail(
      PRESET_APPLY_ERROR_CODES.COMPOSITION_CLOSED,
      'Core composition is permanently closed'
    )
  }
  if (state.alreadyApplied) {
    return fail(
      PRESET_APPLY_ERROR_CODES.ALREADY_APPLIED,
      'Preset has already been applied to this Core composition'
    )
  }
  if (profile === PresetProfiles['2D'] && core.hasRenderEngineProvider()) {
    return fail(
      PRESET_APPLY_ERROR_CODES.ENGINE_PROVIDER_CONFLICT,
      'Profile 2D cannot replace an existing Core render engine provider'
    )
  }

  return Object.freeze({
    profile,
    selectedDefaults: Object.freeze([...selectedDefaults]),
    appliedDefaults: Object.freeze([...appliedDefaults])
  })
}
