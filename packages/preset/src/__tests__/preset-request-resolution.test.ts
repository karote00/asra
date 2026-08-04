import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { PresetCatalog } from '../catalog.js'
import {
  PresetDefaults,
  PresetProfiles,
  PRESET_APPLY_ERROR_CODES
} from '../constants.js'
import { PresetApplyError } from '../composition/error.js'
import { resolvePresetRequest } from '../composition/resolve.js'
import type { ApplyPresetOptions, PresetCoreAPIs } from '../types.js'

const allDefaults = [
  PresetDefaults.BASIC_SHAPES,
  PresetDefaults.CONTAINERS,
  PresetDefaults.VECTOR,
  PresetDefaults.INPUT,
  PresetDefaults.SELECTION,
  PresetDefaults.VECTOR_EDITING,
  PresetDefaults.VIEWPORT,
  PresetDefaults.UI_CONTEXT
] as const

const createCoreState = ({
  compositionOpen = true,
  hasProvider = false
}: {
  compositionOpen?: boolean
  hasProvider?: boolean
} = {}) => {
  const isCompositionOpen = vi.fn(() => compositionOpen)
  const hasRenderEngineProvider = vi.fn(() => hasProvider)
  const core = {
    isCompositionOpen,
    hasRenderEngineProvider
  } as unknown as PresetCoreAPIs
  return { core, hasRenderEngineProvider, isCompositionOpen }
}

const expectApplyError = (
  run: () => unknown,
  code: PresetApplyError['code']
) => {
  try {
    run()
    throw new Error(`Expected PresetApplyError ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(PresetApplyError)
    expect((error as PresetApplyError).code).toBe(code)
  }
}

describe('Preset request resolution', () => {
  it('publishes one deeply frozen catalog with exact profiles and defaults', () => {
    expect(PresetProfiles).toEqual({
      '2D': '2D',
      '3D': '3D',
      HYBRID: 'HYBRID',
      CUSTOM: 'CUSTOM'
    })
    expect(PresetCatalog.profiles).toEqual([
      {
        id: PresetProfiles['2D'],
        available: true,
        presetEngineId: '@asyra/render-engine-pixi'
      },
      {
        id: PresetProfiles['3D'],
        available: false,
        presetEngineId: null
      },
      {
        id: PresetProfiles.HYBRID,
        available: false,
        presetEngineId: null
      },
      {
        id: PresetProfiles.CUSTOM,
        available: true,
        presetEngineId: null
      }
    ])
    expect(PresetCatalog.defaults.map(({ id }) => id)).toEqual(allDefaults)
    expect(
      PresetCatalog.defaults.find(
        ({ id }) => id === PresetDefaults.VECTOR_EDITING
      )?.requires
    ).toEqual([PresetDefaults.VECTOR, PresetDefaults.SELECTION])
    expect(
      PresetCatalog.defaults.find(({ id }) => id === PresetDefaults.UI_CONTEXT)
        ?.requires
    ).toEqual([PresetDefaults.SELECTION])
    expect(Object.isFrozen(PresetCatalog)).toBe(true)
    expect(Object.isFrozen(PresetCatalog.profiles)).toBe(true)
    expect(Object.isFrozen(PresetCatalog.defaults[0])).toBe(true)
  })

  it('keeps unavailable profile metadata free of runtime imports', () => {
    const catalogSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/catalog.ts'),
      'utf8'
    )
    const resolverSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/composition/resolve.ts'),
      'utf8'
    )

    expect(catalogSource).not.toMatch(/^import .*render-engine-(?:3d|hybrid)/im)
    expect(resolverSource).not.toMatch(/@asyra\/render-engine-pixi/)
    expect(resolverSource).not.toMatch(/\bimport\s*\(/)
  })

  it('resolves omitted options as 2D plus all defaults', () => {
    const { core } = createCoreState()

    const resolved = resolvePresetRequest(core)

    expect(resolved).toEqual({
      profile: PresetProfiles['2D'],
      selectedDefaults: allDefaults,
      appliedDefaults: allDefaults
    })
    expect(Object.isFrozen(resolved)).toBe(true)
    expect(Object.isFrozen(resolved.selectedDefaults)).toBe(true)
    expect(Object.isFrozen(resolved.appliedDefaults)).toBe(true)
  })

  it('resolves CUSTOM with omitted defaults to the same modules', () => {
    const { core } = createCoreState({ hasProvider: true })

    const resolved = resolvePresetRequest(core, {
      profile: PresetProfiles.CUSTOM
    })

    expect(resolved.profile).toBe(PresetProfiles.CUSTOM)
    expect(resolved.selectedDefaults).toEqual(allDefaults)
    expect(resolved.appliedDefaults).toEqual(allDefaults)
  })

  it('keeps an explicit empty default set empty for every available profile', () => {
    const twoD = resolvePresetRequest(createCoreState().core, { defaults: [] })
    const custom = resolvePresetRequest(createCoreState().core, {
      profile: PresetProfiles.CUSTOM,
      defaults: []
    })

    expect(twoD.selectedDefaults).toEqual([])
    expect(twoD.appliedDefaults).toEqual([])
    expect(custom.selectedDefaults).toEqual([])
    expect(custom.appliedDefaults).toEqual([])
  })

  it('canonicalizes selection and expands public dependencies in catalog order', () => {
    const input = [
      PresetDefaults.UI_CONTEXT,
      PresetDefaults.VECTOR_EDITING
    ] as const
    const resolved = resolvePresetRequest(createCoreState().core, {
      defaults: input
    })

    expect(resolved.selectedDefaults).toEqual([
      PresetDefaults.VECTOR_EDITING,
      PresetDefaults.UI_CONTEXT
    ])
    expect(resolved.appliedDefaults).toEqual([
      PresetDefaults.VECTOR,
      PresetDefaults.SELECTION,
      PresetDefaults.VECTOR_EDITING,
      PresetDefaults.UI_CONTEXT
    ])
  })

  it('detaches the resolved arrays from caller-owned input', () => {
    const defaults: string[] = [PresetDefaults.BASIC_SHAPES]
    const resolved = resolvePresetRequest(createCoreState().core, {
      defaults: defaults as ApplyPresetOptions['defaults']
    })

    defaults.push(PresetDefaults.VIEWPORT)

    expect(resolved.selectedDefaults).toEqual([PresetDefaults.BASIC_SHAPES])
    expect(resolved.appliedDefaults).toEqual([PresetDefaults.BASIC_SHAPES])
  })

  it.each([
    ['renderEngineFactory', { renderEngineFactory: vi.fn() }],
    ['engine', { engine: { id: 'custom' } }],
    ['capabilityBundles', { capabilityBundles: [] }],
    ['dependencies', { dependencies: {} }],
    ['unknown', { unknown: true }]
  ])('rejects legacy or unknown option key %s', (_name, options) => {
    expectApplyError(
      () => resolvePresetRequest(createCoreState().core, options as never),
      PRESET_APPLY_ERROR_CODES.INVALID_OPTIONS
    )
  })

  it('rejects unknown and unavailable profiles', () => {
    expectApplyError(
      () =>
        resolvePresetRequest(createCoreState().core, {
          profile: 'UNKNOWN' as never
        }),
      PRESET_APPLY_ERROR_CODES.UNKNOWN_PROFILE
    )
    ;[PresetProfiles['3D'], PresetProfiles.HYBRID].forEach((profile) => {
      expectApplyError(
        () => resolvePresetRequest(createCoreState().core, { profile }),
        PRESET_APPLY_ERROR_CODES.UNAVAILABLE_PROFILE
      )
    })
  })

  it('rejects malformed, unknown, and duplicate defaults', () => {
    expectApplyError(
      () =>
        resolvePresetRequest(createCoreState().core, {
          defaults: 'basic-shapes' as never
        }),
      PRESET_APPLY_ERROR_CODES.INVALID_OPTIONS
    )
    expectApplyError(
      () =>
        resolvePresetRequest(createCoreState().core, {
          defaults: ['unknown-default' as never]
        }),
      PRESET_APPLY_ERROR_CODES.UNKNOWN_DEFAULT
    )
    expectApplyError(
      () =>
        resolvePresetRequest(createCoreState().core, {
          defaults: [PresetDefaults.INPUT, PresetDefaults.INPUT]
        }),
      PRESET_APPLY_ERROR_CODES.DUPLICATE_DEFAULT
    )
  })

  it('rejects closed composition, duplicate apply, and 2D provider conflict', () => {
    expectApplyError(
      () =>
        resolvePresetRequest(createCoreState({ compositionOpen: false }).core),
      PRESET_APPLY_ERROR_CODES.COMPOSITION_CLOSED
    )
    expectApplyError(
      () =>
        resolvePresetRequest(createCoreState().core, undefined, {
          alreadyApplied: true
        }),
      PRESET_APPLY_ERROR_CODES.ALREADY_APPLIED
    )
    expectApplyError(
      () => resolvePresetRequest(createCoreState({ hasProvider: true }).core),
      PRESET_APPLY_ERROR_CODES.ENGINE_PROVIDER_CONFLICT
    )
  })
})
