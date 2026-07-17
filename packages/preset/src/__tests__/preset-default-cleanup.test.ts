import { BaseSelection } from '@asyra/core'
import type { RegistrationNodeMetadata } from '@asyra/utils'
import { describe, expect, it, vi } from 'vitest'
import { createOwnedStateCleanup } from '../defaults/owned-state'
import { installSelectionDefault } from '../defaults/modules/selection'
import { PRESET_REGISTRATION_OWNER } from '../registration'
import { SelectionChannels } from '../selection/channels'
import type { PresetCoreAPIs } from '../types'

const appOwner = { packageName: '@app/test', name: 'test' }

describe('Preset default cleanup ownership', () => {
  it('reverses only registrations and system properties acquired by the module', () => {
    const registrations: RegistrationNodeMetadata[] = [
      {
        ref: { kind: 'component', key: 'existing' },
        owner: appOwner
      }
    ]
    const systemProperties = new Set(['primaryTool'])
    const calls: string[] = []
    const removeRegistration = (kind: string, key: string): void => {
      calls.push(`${kind}:${key}`)
      const index = registrations.findIndex(
        ({ ref }) => ref.kind === kind && ref.key === key
      )
      if (index >= 0) registrations.splice(index, 1)
    }
    const core = {
      getRegistrations: () => registrations,
      getRegistration: (ref: { kind: string; key: string }) =>
        registrations.find(
          (registration) =>
            registration.ref.kind === ref.kind &&
            registration.ref.key === ref.key
        ),
      unregisterComponent: (key: string) =>
        removeRegistration('component', key),
      unregisterRenderStrategy: (key: string) =>
        removeRegistration('render-strategy', key),
      hasSystemProperty: (key: string) => systemProperties.has(key),
      unregisterSystemProperty: (key: string) => {
        calls.push(`system-property:${key}`)
        systemProperties.delete(key)
      }
    } as unknown as PresetCoreAPIs
    const cleanup = createOwnedStateCleanup(core)

    registrations.push(
      {
        ref: { kind: 'component', key: 'rectangle' },
        owner: PRESET_REGISTRATION_OWNER
      },
      {
        ref: { kind: 'render-strategy', key: 'rectangle' },
        owner: PRESET_REGISTRATION_OWNER
      },
      {
        ref: { kind: 'component', key: 'app-added' },
        owner: appOwner
      }
    )
    systemProperties.add('zoom')

    cleanup()

    expect(calls).toEqual([
      'render-strategy:rectangle',
      'component:rectangle',
      'system-property:zoom'
    ])
    expect(registrations.map(({ ref }) => ref.key)).toEqual([
      'existing',
      'app-added'
    ])
    expect(systemProperties).toEqual(new Set(['primaryTool']))
  })

  it('retries only cleanup resources that remain pending', () => {
    const registrations: RegistrationNodeMetadata[] = []
    let renderCleanupAttempts = 0
    const componentCleanup = vi.fn(() => {
      registrations.splice(
        registrations.findIndex(({ ref }) => ref.kind === 'component'),
        1
      )
    })
    const renderCleanup = vi.fn(() => {
      renderCleanupAttempts += 1
      if (renderCleanupAttempts === 1) throw new Error('temporary failure')
      registrations.splice(
        registrations.findIndex(({ ref }) => ref.kind === 'render-strategy'),
        1
      )
    })
    const core = {
      getRegistrations: () => registrations,
      getRegistration: (ref: { kind: string; key: string }) =>
        registrations.find(
          (registration) =>
            registration.ref.kind === ref.kind &&
            registration.ref.key === ref.key
        ),
      unregisterComponent: componentCleanup,
      unregisterRenderStrategy: renderCleanup,
      hasSystemProperty: () => false
    } as unknown as PresetCoreAPIs
    const cleanup = createOwnedStateCleanup(core)
    registrations.push(
      {
        ref: { kind: 'component', key: 'rectangle' },
        owner: PRESET_REGISTRATION_OWNER
      },
      {
        ref: { kind: 'render-strategy', key: 'rectangle' },
        owner: PRESET_REGISTRATION_OWNER
      }
    )

    expect(() => cleanup()).toThrow('temporary failure')
    expect(componentCleanup).toHaveBeenCalledOnce()
    expect(renderCleanup).toHaveBeenCalledOnce()

    expect(() => cleanup()).not.toThrow()
    expect(componentCleanup).toHaveBeenCalledOnce()
    expect(renderCleanup).toHaveBeenCalledTimes(2)
  })

  it('makes the element selection runtime an acquired cleanup resource', () => {
    const selections = new Map<string, BaseSelection>()
    let selectionCleanup: (() => void) | undefined
    const acquire = vi.fn(
      (key: string, install: () => void | (() => void)): void => {
        if (key === 'selection:element') {
          selectionCleanup = install() ?? undefined
        }
      }
    )
    const core = {
      getSelection: (type: string) => selections.get(type),
      defineSelection: (type: string, selection: BaseSelection) =>
        selections.set(type, selection),
      unregisterSelection: (type: string) => selections.delete(type),
      defineSystemProperty: vi.fn()
    } as unknown as PresetCoreAPIs

    installSelectionDefault({
      core,
      dependencies: {} as never,
      privatePrerequisites: { acquire }
    })

    expect(selections.has(SelectionChannels.ELEMENT)).toBe(true)
    expect(selectionCleanup).toEqual(expect.any(Function))

    selectionCleanup?.()
    expect(selections.has(SelectionChannels.ELEMENT)).toBe(false)
  })
})
