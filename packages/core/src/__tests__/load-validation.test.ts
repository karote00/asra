import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeToFileLoadComplete } from '@asyra/reactive-events'
import type { CoreRawData } from '@asyra/utils'
import { Core } from '../core'

const createCoreForTest = () => {
  interface PackageDiagnostic {
    path: string
    message: string
  }

  const props = {
    save: vi.fn(() => ({})),
    load: vi.fn(),
    validateLoadData: vi.fn(() => ({
      data: {},
      diagnostics: [] as PackageDiagnostic[]
    }))
  }

  const sceneTree = {
    save: vi.fn(() => ({ workspace: '', workspaceList: [], elements: {} })),
    load: vi.fn(),
    getAllElements: vi.fn(() => new Map()),
    validateLoadData: vi.fn(() => ({
      data: { workspace: 'ws-1', workspaceList: ['ws-1'], elements: {} },
      diagnostics: [] as PackageDiagnostic[]
    }))
  }

  const systemContext = {
    loadManagedProperties: vi.fn(() => [] as PackageDiagnostic[]),
    saveManagedProperties: vi.fn(() => ({}))
  }

  const core = new Core({
    inputSystem: {} as never,
    factory: {
      subscribeToTransactionStatus: vi.fn(() => () => undefined),
      reportPersistenceStatus: vi.fn()
    } as never,
    props: props as never,
    render: {
      init: vi.fn(),
      getViewportPosition: vi.fn(() => ({ x: 0, y: 0 })),
      getViewportScale: vi.fn(() => 1),
      registerLayer: vi.fn(),
      unregisterLayer: vi.fn(() => true)
    } as never,
    sceneTree: sceneTree as never,
    selection: {} as never,
    systemContext: systemContext as never
  })

  return {
    core,
    props,
    sceneTree,
    systemContext
  }
}

describe('Core load validation pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('core.load should run load hooks, apply package validation, and emit diagnostics', () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()

    const validatedProps = {
      'pp-1': {
        id: 'pp-1',
        type: 'position',
        x: 10,
        y: 20,
        xUnit: 'px',
        yUnit: 'px'
      }
    }
    const validatedSceneTree = {
      workspace: 'ws-1',
      workspaceList: ['ws-1'],
      elements: {}
    }

    props.validateLoadData.mockReturnValue({
      data: validatedProps,
      diagnostics: [
        { path: 'props.pp-invalid', message: 'Skipped malformed component' }
      ]
    })
    sceneTree.validateLoadData.mockReturnValue({
      data: validatedSceneTree,
      diagnostics: [
        {
          path: 'sceneTree.elements.invalid',
          message: 'Skipped malformed element'
        }
      ]
    })
    systemContext.loadManagedProperties.mockReturnValue([
      {
        path: 'systemContext.zoom',
        message: 'Ignored invalid managed property value during load'
      }
    ])
    systemContext.saveManagedProperties.mockReturnValue({ zoom: 100 })

    core.registerLoadHook((data) => ({
      ...data,
      version: '2.0.0',
      systemContext: { zoom: 'invalid' }
    }))

    const diagnosticsHook = vi.fn()
    core.registerLoadDiagnosticsHook(diagnosticsHook)

    const fileLoadEvents: number[] = []
    const subscription = subscribeToFileLoadComplete(() => {
      fileLoadEvents.push(1)
    })

    // Simulate app-triggered load (same pipeline as persistence load).
    core.load({
      version: '1.0.0',
      sceneTree: { workspace: '', workspaceList: [], elements: {} },
      props: {}
    } as CoreRawData)

    subscription.unsubscribe()

    expect(core.version).toBe('2.0.0')
    expect(props.validateLoadData).toHaveBeenCalledWith({})
    expect(sceneTree.validateLoadData).toHaveBeenCalledWith({
      workspace: '',
      workspaceList: [],
      elements: {}
    })
    expect(sceneTree.load).toHaveBeenCalledWith(validatedSceneTree)
    expect(props.load).toHaveBeenCalledWith(validatedProps)
    expect(systemContext.loadManagedProperties).toHaveBeenCalledWith({
      zoom: 'invalid'
    })
    expect(fileLoadEvents).toEqual([1])
    expect(diagnosticsHook).toHaveBeenCalledTimes(1)
    expect(diagnosticsHook.mock.calls[0][0]).toEqual([
      {
        scope: 'props-manager',
        path: 'props.pp-invalid',
        message: 'Skipped malformed component'
      },
      {
        scope: 'scene-tree',
        path: 'sceneTree.elements.invalid',
        message: 'Skipped malformed element'
      },
      {
        scope: 'system-context',
        path: 'systemContext.zoom',
        message: 'Ignored invalid managed property value during load'
      }
    ])
  })

  it('core.load should fallback to safe empty snapshot when root payload is invalid', () => {
    const { core, props, sceneTree } = createCoreForTest()

    core.load('invalid-data' as unknown as CoreRawData)

    expect(props.validateLoadData).toHaveBeenCalledWith({})
    expect(sceneTree.validateLoadData).toHaveBeenCalledWith({
      workspace: '',
      workspaceList: [],
      elements: {}
    })
    expect(sceneTree.load).toHaveBeenCalledTimes(1)
    expect(props.load).toHaveBeenCalledTimes(1)
  })

  it('registerLoadDiagnosticsHook should return disposer to unsubscribe app-level handlers', () => {
    const { core } = createCoreForTest()

    const firstHook = vi.fn()
    const secondHook = vi.fn()

    const disposeFirst = core.registerLoadDiagnosticsHook(firstHook)
    core.registerLoadDiagnosticsHook(secondHook)

    core.load('invalid-data' as unknown as CoreRawData)

    expect(firstHook).toHaveBeenCalledTimes(1)
    expect(secondHook).toHaveBeenCalledTimes(1)

    disposeFirst()

    core.load('invalid-data' as unknown as CoreRawData)

    expect(firstHook).toHaveBeenCalledTimes(1)
    expect(secondHook).toHaveBeenCalledTimes(2)
  })
})
