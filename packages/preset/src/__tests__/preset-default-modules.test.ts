import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PresetDefaults, PRESET_APPLY_ERROR_CODES } from '../constants.js'
import { createPrivatePrerequisiteManager } from '../defaults/private-manager.js'
import type { PrivatePrerequisiteInstaller } from '../defaults/types.js'

const loadInstallHarness = async () => {
  vi.resetModules()
  const [
    basicShapes,
    containers,
    vector,
    input,
    selection,
    vectorEditing,
    viewport,
    uiContext
  ] = await Promise.all([
    import('../defaults/modules/basic-shapes.js'),
    import('../defaults/modules/containers.js'),
    import('../defaults/modules/vector.js'),
    import('../defaults/modules/input.js'),
    import('../defaults/modules/selection.js'),
    import('../defaults/modules/vector-editing.js'),
    import('../defaults/modules/viewport.js'),
    import('../defaults/modules/ui-context.js')
  ])
  const installers = {
    basicShapes: vi
      .spyOn(basicShapes, 'installBasicShapesDefault')
      .mockImplementation(() => undefined),
    containers: vi
      .spyOn(containers, 'installContainersDefault')
      .mockImplementation(() => undefined),
    vector: vi
      .spyOn(vector, 'installVectorDefault')
      .mockImplementation(() => undefined),
    input: vi
      .spyOn(input, 'installInputDefault')
      .mockImplementation(() => undefined),
    selection: vi
      .spyOn(selection, 'installSelectionDefault')
      .mockImplementation(() => undefined),
    vectorEditing: vi
      .spyOn(vectorEditing, 'installVectorEditingDefault')
      .mockImplementation(() => undefined),
    viewport: vi
      .spyOn(viewport, 'installViewportDefault')
      .mockImplementation(() => undefined),
    uiContext: vi
      .spyOn(uiContext, 'installUIContextDefault')
      .mockImplementation(() => undefined)
  }
  const installModule = await import('../defaults/install.js')
  const { PresetApplyError } = await import('../composition/error.js')

  return { installers, PresetApplyError, ...installModule }
}

const createInstallInput = (appliedDefaults: readonly string[]) => ({
  core: {
    getRegistrations: vi.fn(() => []),
    hasSystemProperty: vi.fn(() => false)
  } as never,
  dependencies: {} as never,
  appliedDefaults: appliedDefaults as never,
  registerCleanup: vi.fn()
})

describe('Preset default modules', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('owns one fixed installer for each catalog default in canonical order', async () => {
    const { PRESET_DEFAULT_MODULES } = await loadInstallHarness()

    expect(PRESET_DEFAULT_MODULES.map(({ id }) => id)).toEqual([
      PresetDefaults.BASIC_SHAPES,
      PresetDefaults.CONTAINERS,
      PresetDefaults.VECTOR,
      PresetDefaults.INPUT,
      PresetDefaults.SELECTION,
      PresetDefaults.VECTOR_EDITING,
      PresetDefaults.VIEWPORT,
      PresetDefaults.UI_CONTEXT
    ])
    expect(Object.isFrozen(PRESET_DEFAULT_MODULES)).toBe(true)
    PRESET_DEFAULT_MODULES.forEach((module) => {
      expect(Object.isFrozen(module)).toBe(true)
    })
  })

  it('installs only resolved defaults and preserves canonical module order', async () => {
    const { installers, installPresetDefaults } = await loadInstallHarness()
    const callOrder: string[] = []
    installers.vector.mockImplementation(() => callOrder.push('vector'))
    installers.selection.mockImplementation(() => callOrder.push('selection'))
    installers.vectorEditing.mockImplementation(() =>
      callOrder.push('vector-editing')
    )

    const installed = installPresetDefaults(
      createInstallInput([
        PresetDefaults.VECTOR,
        PresetDefaults.SELECTION,
        PresetDefaults.VECTOR_EDITING
      ])
    )

    expect(installed).toEqual([
      PresetDefaults.VECTOR,
      PresetDefaults.SELECTION,
      PresetDefaults.VECTOR_EDITING
    ])
    expect(callOrder).toEqual(['vector', 'selection', 'vector-editing'])
    expect(installers.basicShapes).not.toHaveBeenCalled()
    expect(installers.input).not.toHaveBeenCalled()
    expect(installers.uiContext).not.toHaveBeenCalled()
  })

  it('performs zero module installation for an empty applied set', async () => {
    const { installers, installPresetDefaults } = await loadInstallHarness()

    const installed = installPresetDefaults(createInstallInput([]))

    expect(installed).toEqual([])
    Object.values(installers).forEach((installer) => {
      expect(installer).not.toHaveBeenCalled()
    })
  })

  it('stops at the failed module and preserves its id and cause', async () => {
    const { installers, installPresetDefaults, PresetApplyError } =
      await loadInstallHarness()
    const cause = new Error('selection install failed')
    installers.selection.mockImplementation(() => {
      throw cause
    })
    const input = createInstallInput([
      PresetDefaults.INPUT,
      PresetDefaults.SELECTION,
      PresetDefaults.VIEWPORT
    ])

    let received: unknown
    try {
      installPresetDefaults(input)
    } catch (error) {
      received = error
    }

    expect(received).toBeInstanceOf(PresetApplyError)
    expect(received).toMatchObject({
      code: PRESET_APPLY_ERROR_CODES.DEFAULT_INSTALL_FAILED,
      defaultId: PresetDefaults.SELECTION,
      cause
    })
    expect(installers.input).toHaveBeenCalledOnce()
    expect(installers.viewport).not.toHaveBeenCalled()
  })

  it('deduplicates private prerequisites and registers cleanup once', () => {
    const install = vi.fn(() => vi.fn())
    const registerCleanup = vi.fn()
    const manager = createPrivatePrerequisiteManager(registerCleanup)

    manager.acquire('shared:test', install)
    manager.acquire('shared:test', install)

    expect(install).toHaveBeenCalledOnce()
    expect(registerCleanup).toHaveBeenCalledOnce()
    expect(registerCleanup).toHaveBeenCalledWith(
      'private:shared:test',
      expect.any(Function)
    )
  })

  it('does not mark a failed private prerequisite as acquired', () => {
    const failure = new Error('private install failed')
    const install = vi
      .fn<PrivatePrerequisiteInstaller>()
      .mockImplementationOnce(() => {
        throw failure
      })
      .mockImplementationOnce(() => undefined)
    const manager = createPrivatePrerequisiteManager(vi.fn())

    expect(() => manager.acquire('retryable', install)).toThrow(failure)
    expect(() => manager.acquire('retryable', install)).not.toThrow()
    expect(install).toHaveBeenCalledTimes(2)
  })
})
