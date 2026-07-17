import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PresetDefaults, PRESET_APPLY_ERROR_CODES } from '../constants'

const installers = vi.hoisted(() => ({
  basicShapes: vi.fn(),
  containers: vi.fn(),
  vector: vi.fn(),
  input: vi.fn(),
  selection: vi.fn(),
  vectorEditing: vi.fn(),
  viewport: vi.fn(),
  uiContext: vi.fn()
}))

vi.mock('../defaults/modules/basic-shapes', () => ({
  installBasicShapesDefault: installers.basicShapes
}))
vi.mock('../defaults/modules/containers', () => ({
  installContainersDefault: installers.containers
}))
vi.mock('../defaults/modules/vector', () => ({
  installVectorDefault: installers.vector
}))
vi.mock('../defaults/modules/input', () => ({
  installInputDefault: installers.input
}))
vi.mock('../defaults/modules/selection', () => ({
  installSelectionDefault: installers.selection
}))
vi.mock('../defaults/modules/vector-editing', () => ({
  installVectorEditingDefault: installers.vectorEditing
}))
vi.mock('../defaults/modules/viewport', () => ({
  installViewportDefault: installers.viewport
}))
vi.mock('../defaults/modules/ui-context', () => ({
  installUIContextDefault: installers.uiContext
}))

import { PresetApplyError } from '../composition/error'
import {
  PRESET_DEFAULT_MODULES,
  installPresetDefaults
} from '../defaults/install'
import { createPrivatePrerequisiteManager } from '../defaults/private-manager'
import type { PrivatePrerequisiteInstaller } from '../defaults/types'

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
    Object.values(installers).forEach((installer) => installer.mockReset())
  })

  it('owns one fixed installer for each catalog default in canonical order', () => {
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

  it('installs only resolved defaults and preserves canonical module order', () => {
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

  it('performs zero module installation for an empty applied set', () => {
    const installed = installPresetDefaults(createInstallInput([]))

    expect(installed).toEqual([])
    Object.values(installers).forEach((installer) => {
      expect(installer).not.toHaveBeenCalled()
    })
  })

  it('stops at the failed module and preserves its id and cause', () => {
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
