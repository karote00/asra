import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi
} from 'vitest'
import type {
  IPersistenceProvider,
  LocalStoragePersistence,
  VersionedLoadDocument
} from '@asyra/persistence'
import { subscribeToFileLoadComplete } from '@asyra/reactive-events'
import type { CoreRawData, LoadDiagnostic } from '@asyra/utils'
import { Core } from '../core'
import {
  LOAD_HOOK_EXECUTION_ERROR_CODES,
  LoadHookExecutionError
} from '../types/load-migration'

const createCoreForTest = () => {
  const props = {
    save: vi.fn(() => ({})),
    load: vi.fn(),
    applyValidatedLoad: vi.fn(),
    validateLoadData: vi.fn(() => ({
      data: {},
      diagnostics: [] as LoadDiagnostic[]
    }))
  }

  const sceneTree = {
    save: vi.fn(() => ({ workspace: '', workspaceList: [], elements: {} })),
    load: vi.fn(),
    applyValidatedLoad: vi.fn(),
    getAllElements: vi.fn(() => new Map()),
    validateLoadData: vi.fn(() => ({
      data: { workspace: 'ws-1', workspaceList: ['ws-1'], elements: {} },
      diagnostics: [] as LoadDiagnostic[],
      valid: true
    }))
  }

  const systemContext = {
    validateManagedProperties: vi.fn(() => ({
      data: {} as Record<string, unknown>,
      diagnostics: [] as LoadDiagnostic[]
    })),
    applyValidatedManagedProperties: vi.fn(),
    loadManagedProperties: vi.fn(() => [] as LoadDiagnostic[]),
    saveManagedProperties: vi.fn(() => ({}))
  }

  const core = new Core({
    inputSystem: {} as never,
    factory: {
      registerTransactionReplayHandler: vi.fn(() => () => undefined),
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

const prepareCoreStart = (core: Core): void => {
  core.setupInputSystem = vi.fn()
  core.initFeatureSystem = vi.fn()
  core.renderIsReady = vi.fn()
  core.setRenderer({
    name: 'load-validation-renderer',
    init: vi.fn(async () => ({ canvas: null, instance: null })),
    destroy: vi.fn()
  } as never)
}

const asCoreRawData = (data: unknown): CoreRawData => data as CoreRawData

describe('Core load validation pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('types direct and provider load documents as raw input', () => {
    expectTypeOf<Parameters<Core['load']>[0]>().toEqualTypeOf<unknown>()
    expectTypeOf<
      Awaited<ReturnType<IPersistenceProvider['load']>>
    >().toBeUnknown()
    expectTypeOf<
      Awaited<ReturnType<LocalStoragePersistence['load']>>
    >().toBeUnknown()
    expectTypeOf<
      Parameters<Parameters<Core['registerLoadHook']>[0]>[0]
    >().toEqualTypeOf<unknown>()
    expectTypeOf<
      ReturnType<Parameters<Core['registerLoadHook']>[0]>
    >().toEqualTypeOf<VersionedLoadDocument>()
  })

  it('passes every non-nullish direct raw payload to the first app hook', () => {
    const { core } = createCoreForTest()
    const observed: unknown[] = []
    const stopAfterObservation = new Error('stop after observing raw input')
    core.registerLoadHook((data) => {
      observed.push(data)
      throw stopAfterObservation
    })

    expect(() => core.load(false)).toThrow(stopAfterObservation)
    expect(() => core.load(0)).toThrow(stopAfterObservation)
    expect(() => core.load('')).toThrow(stopAfterObservation)

    expect(observed).toEqual([false, 0, ''])
  })

  it('passes every non-null provider raw payload through the same app hook entry', async () => {
    const observed: unknown[] = []
    const rawPayloads = [false, 0, '']

    for (const rawPayload of rawPayloads) {
      const { core } = createCoreForTest()
      const stopAfterObservation = new Error(
        'stop after observing provider raw input'
      )
      core.registerLoadHook((data) => {
        observed.push(data)
        throw stopAfterObservation
      })
      prepareCoreStart(core)
      core.setPersistence({
        name: 'falsy-raw-provider',
        load: vi.fn(async () => rawPayload),
        save: vi.fn(async () => undefined),
        clear: vi.fn(async () => undefined)
      })

      await expect(
        core.start(document.createElement('div'), { width: 1, height: 1 })
      ).rejects.toThrow(stopAfterObservation)
    }

    expect(observed).toEqual(rawPayloads)
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
      ],
      valid: true
    })
    systemContext.validateManagedProperties.mockReturnValue({
      data: {},
      diagnostics: [
        {
          path: 'systemContext.zoom',
          message: 'Ignored invalid managed property value during load'
        }
      ]
    })
    systemContext.saveManagedProperties.mockReturnValue({ zoom: 100 })

    core.registerLoadHook((data) => {
      const documentData = asCoreRawData(data)
      return {
        ...documentData,
        version: '2.0.0',
        systemContext: { zoom: 'invalid' }
      }
    })

    const diagnosticsHook = vi.fn()
    core.registerLoadDiagnosticsHook(diagnosticsHook)

    const fileLoadEvents: number[] = []
    const subscription = subscribeToFileLoadComplete(() => {
      fileLoadEvents.push(1)
    })
    const fileLoadEventBaseline = fileLoadEvents.length

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
    expect(sceneTree.applyValidatedLoad).toHaveBeenCalledWith(
      sceneTree.validateLoadData.mock.results[0].value
    )
    expect(props.applyValidatedLoad).toHaveBeenCalledWith(
      props.validateLoadData.mock.results[0].value
    )
    expect(sceneTree.load).not.toHaveBeenCalled()
    expect(props.load).not.toHaveBeenCalled()
    expect(systemContext.validateManagedProperties).toHaveBeenCalledWith({
      zoom: 'invalid'
    })
    expect(systemContext.applyValidatedManagedProperties).toHaveBeenCalledWith(
      systemContext.validateManagedProperties.mock.results[0].value
    )
    expect(systemContext.loadManagedProperties).not.toHaveBeenCalled()
    const validationOrders = [
      props.validateLoadData.mock.invocationCallOrder[0],
      sceneTree.validateLoadData.mock.invocationCallOrder[0],
      systemContext.validateManagedProperties.mock.invocationCallOrder[0]
    ]
    const applyOrders = [
      props.applyValidatedLoad.mock.invocationCallOrder[0],
      sceneTree.applyValidatedLoad.mock.invocationCallOrder[0],
      systemContext.applyValidatedManagedProperties.mock.invocationCallOrder[0]
    ]
    expect(Math.max(...validationOrders)).toBeLessThan(Math.min(...applyOrders))
    expect(fileLoadEvents).toHaveLength(fileLoadEventBaseline + 1)
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

  it('rejects an invalid Scene Tree artifact before any package apply', () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()
    sceneTree.validateLoadData.mockReturnValue({
      data: { workspace: 'missing', workspaceList: [], elements: {} },
      diagnostics: [
        {
          path: 'sceneTree.workspace',
          message: 'Active workspace is missing'
        }
      ],
      valid: false
    })

    expect(() =>
      core.load({
        version: '1.0.0',
        sceneTree: { workspace: 'missing', workspaceList: [], elements: {} },
        props: {}
      })
    ).toThrow(/Scene Tree.*invalid hierarchy/i)

    expect(props.applyValidatedLoad).not.toHaveBeenCalled()
    expect(sceneTree.applyValidatedLoad).not.toHaveBeenCalled()
    expect(systemContext.applyValidatedManagedProperties).not.toHaveBeenCalled()
  })

  it('emits detached apply evidence without Props or Scene canonical readback', () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()
    const validatedProps = {
      'pp-1': {
        id: 'pp-1',
        type: 'position',
        x: 10
      }
    }
    props.validateLoadData.mockReturnValue({
      data: validatedProps,
      diagnostics: [
        { path: 'props.pp-invalid', message: 'Skipped malformed component' }
      ]
    })
    systemContext.validateManagedProperties.mockReturnValue({
      data: { zoom: 200 },
      diagnostics: []
    })
    systemContext.saveManagedProperties.mockReturnValue({ zoom: 200 })

    const firstHook = vi.fn((diagnostics, data) => {
      diagnostics[0].message = 'mutated diagnostic'
      ;(data.props['pp-1'] as { x: number }).x = 999
      ;(data.systemContext as { zoom: number }).zoom = 999
      throw new Error('diagnostics failed')
    })
    const secondHook = vi.fn()
    core.registerLoadDiagnosticsHook(firstHook)
    core.registerLoadDiagnosticsHook(secondHook)

    expect(() =>
      core.load({
        version: 'v2',
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {}
      })
    ).not.toThrow()

    expect(firstHook).toHaveBeenCalledOnce()
    expect(secondHook).toHaveBeenCalledOnce()
    expect(secondHook.mock.calls[0][0]).toEqual([
      {
        scope: 'props-manager',
        path: 'props.pp-invalid',
        message: 'Skipped malformed component'
      }
    ])
    expect(secondHook.mock.calls[0][1]).toMatchObject({
      props: { 'pp-1': { x: 10 } },
      systemContext: { zoom: 200 }
    })
    expect(props.applyValidatedLoad.mock.calls[0][0]).toBe(
      props.validateLoadData.mock.results[0].value
    )
    expect(systemContext.applyValidatedManagedProperties.mock.calls[0][0]).toBe(
      systemContext.validateManagedProperties.mock.results[0].value
    )
    expect(props.save).not.toHaveBeenCalled()
    expect(sceneTree.save).not.toHaveBeenCalled()
  })

  it('does not assemble diagnostics evidence when no observer is registered', () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()
    props.validateLoadData.mockReturnValue({
      data: {},
      diagnostics: [
        { path: 'props.invalid', message: 'Skipped malformed component' }
      ]
    })
    systemContext.saveManagedProperties.mockImplementation(() => {
      throw new Error('diagnostics evidence assembly failed')
    })

    expect(() =>
      core.load({
        version: 'v1',
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {}
      })
    ).not.toThrow()

    expect(props.applyValidatedLoad).toHaveBeenCalledOnce()
    expect(sceneTree.applyValidatedLoad).toHaveBeenCalledOnce()
    expect(systemContext.applyValidatedManagedProperties).toHaveBeenCalledOnce()
    expect(systemContext.saveManagedProperties).not.toHaveBeenCalled()
  })

  it('contains diagnostics evidence assembly failure after successful apply', () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()
    props.validateLoadData.mockReturnValue({
      data: {},
      diagnostics: [
        { path: 'props.invalid', message: 'Skipped malformed component' }
      ]
    })
    systemContext.saveManagedProperties.mockImplementation(() => {
      throw new Error('diagnostics evidence assembly failed')
    })
    const diagnosticsHook = vi.fn()
    const fileLoadEvents: number[] = []
    core.registerLoadDiagnosticsHook(diagnosticsHook)
    const subscription = subscribeToFileLoadComplete(() => {
      fileLoadEvents.push(1)
    })
    const fileLoadEventBaseline = fileLoadEvents.length

    let failure: unknown
    try {
      core.load({
        version: 'v1',
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {}
      })
    } catch (error) {
      failure = error
    } finally {
      subscription.unsubscribe()
    }

    expect(failure).toBeUndefined()
    expect(props.applyValidatedLoad).toHaveBeenCalledOnce()
    expect(sceneTree.applyValidatedLoad).toHaveBeenCalledOnce()
    expect(systemContext.applyValidatedManagedProperties).toHaveBeenCalledOnce()
    expect(fileLoadEvents).toHaveLength(fileLoadEventBaseline + 1)
    expect(systemContext.saveManagedProperties).toHaveBeenCalledOnce()
    expect(diagnosticsHook).not.toHaveBeenCalled()
  })

  it('keeps load-diagnostics registrations isolated between Core instances', () => {
    const first = createCoreForTest()
    const second = createCoreForTest()
    const firstDiagnostics = vi.fn()
    first.core.registerLoadDiagnosticsHook(firstDiagnostics)
    ;[first, second].forEach(({ props }) => {
      props.validateLoadData.mockReturnValue({
        data: {},
        diagnostics: [
          { path: 'props.invalid', message: 'Ignored invalid props data' }
        ]
      })
    })
    const input = {
      version: 'v1',
      sceneTree: { workspace: '', workspaceList: [], elements: {} },
      props: {}
    }

    second.core.load(input)

    expect(firstDiagnostics).not.toHaveBeenCalled()

    first.core.load(input)

    expect(firstDiagnostics).toHaveBeenCalledOnce()
  })

  it('passes the unnormalized raw document to the first app migration hook', () => {
    const { core, props, sceneTree } = createCoreForTest()
    const missingVersion = new Error('APP_MIGRATION_MISSING_VERSION')

    core.registerLoadHook((data) => {
      if (typeof (data as Partial<CoreRawData>).version !== 'string') {
        throw missingVersion
      }
      return asCoreRawData(data)
    })

    expect(() =>
      core.load({
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {}
      } as unknown as CoreRawData)
    ).toThrow(missingVersion)
    expect(props.validateLoadData).not.toHaveBeenCalled()
    expect(sceneTree.validateLoadData).not.toHaveBeenCalled()
    expect(props.load).not.toHaveBeenCalled()
    expect(sceneTree.load).not.toHaveBeenCalled()
  })

  it('rejects an invalid load-hook result before validation or canonical apply', () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()
    const diagnosticsHook = vi.fn()
    const fileLoadEvents: number[] = []
    const subscription = subscribeToFileLoadComplete(() => {
      fileLoadEvents.push(1)
    })
    const fileLoadEventBaseline = fileLoadEvents.length
    core.registerLoadDiagnosticsHook(diagnosticsHook)

    core.registerLoadHook(() => null as unknown as CoreRawData)

    let failure: unknown
    try {
      core.load({
        version: 'v1',
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {}
      })
    } catch (error) {
      failure = error
    }
    subscription.unsubscribe()
    expect(failure).toBeInstanceOf(LoadHookExecutionError)
    expect(failure).toMatchObject({
      code: LOAD_HOOK_EXECUTION_ERROR_CODES.INVALID_RESULT,
      hookIndex: 0
    })
    expect((failure as Error).message).toMatch(/load hook 0.*invalid result/i)
    expect(props.validateLoadData).not.toHaveBeenCalled()
    expect(sceneTree.validateLoadData).not.toHaveBeenCalled()
    expect(systemContext.validateManagedProperties).not.toHaveBeenCalled()
    expect(props.load).not.toHaveBeenCalled()
    expect(sceneTree.load).not.toHaveBeenCalled()
    expect(fileLoadEvents).toHaveLength(fileLoadEventBaseline)
    expect(diagnosticsHook).not.toHaveBeenCalled()
  })

  it('rejects an asynchronous load-hook result before validation or canonical apply', () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()
    const diagnosticsHook = vi.fn()
    const fileLoadEvents: number[] = []
    const subscription = subscribeToFileLoadComplete(() => {
      fileLoadEvents.push(1)
    })
    const fileLoadEventBaseline = fileLoadEvents.length
    core.registerLoadDiagnosticsHook(diagnosticsHook)

    core.registerLoadHook((() =>
      Promise.resolve({
        version: 'v2',
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {}
      })) as unknown as (data: unknown) => CoreRawData)

    let failure: unknown
    try {
      core.load({
        version: 'v1',
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {}
      })
    } catch (error) {
      failure = error
    }
    subscription.unsubscribe()
    expect(failure).toBeInstanceOf(LoadHookExecutionError)
    expect(failure).toMatchObject({
      code: LOAD_HOOK_EXECUTION_ERROR_CODES.ASYNC_UNSUPPORTED,
      hookIndex: 0
    })
    expect((failure as Error).message).toMatch(/load hook 0.*asynchronous/i)
    expect(props.validateLoadData).not.toHaveBeenCalled()
    expect(sceneTree.validateLoadData).not.toHaveBeenCalled()
    expect(systemContext.validateManagedProperties).not.toHaveBeenCalled()
    expect(props.load).not.toHaveBeenCalled()
    expect(sceneTree.load).not.toHaveBeenCalled()
    expect(fileLoadEvents).toHaveLength(fileLoadEventBaseline)
    expect(diagnosticsHook).not.toHaveBeenCalled()
  })

  it('contains a rejected asynchronous hook result behind the synchronous Core failure', async () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()
    const asynchronousFailure = new Error('async hook rejected')
    const rejectedResult = Promise.reject(asynchronousFailure)
    const catchSpy = vi.spyOn(rejectedResult, 'catch')

    core.registerLoadHook(
      (() => rejectedResult) as unknown as (data: unknown) => CoreRawData
    )

    let failure: unknown
    try {
      core.load({
        version: 'v1',
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {}
      })
    } catch (error) {
      failure = error
    }

    const containedByCore = catchSpy.mock.calls.length
    if (containedByCore === 0) {
      await rejectedResult.catch(() => undefined)
    }

    expect(containedByCore).toBe(1)
    expect(failure).toMatchObject({
      code: LOAD_HOOK_EXECUTION_ERROR_CODES.ASYNC_UNSUPPORTED,
      hookIndex: 0
    })
    expect(props.validateLoadData).not.toHaveBeenCalled()
    expect(sceneTree.validateLoadData).not.toHaveBeenCalled()
    expect(systemContext.validateManagedProperties).not.toHaveBeenCalled()
    expect(props.load).not.toHaveBeenCalled()
    expect(sceneTree.load).not.toHaveBeenCalled()
  })

  it('runs synchronous migration hooks once in registration order', () => {
    const { core, props } = createCoreForTest()
    const calls: string[] = []

    core.registerLoadHook((data) => {
      const documentData = asCoreRawData(data)
      calls.push(`v1-to-v2:${documentData.version}`)
      return { ...documentData, version: 'v2' }
    })
    core.registerLoadHook((data) => {
      const documentData = asCoreRawData(data)
      calls.push(`v2-to-v3:${documentData.version}`)
      return { ...documentData, version: 'v3' }
    })

    core.load({
      version: 'v1',
      sceneTree: { workspace: '', workspaceList: [], elements: {} },
      props: {}
    })

    expect(calls).toEqual(['v1-to-v2:v1', 'v2-to-v3:v2'])
    expect(core.version).toBe('v3')
    expect(props.validateLoadData).toHaveBeenCalledOnce()
  })

  it('snapshots the registration chain before running a load', () => {
    const { core } = createCoreForTest()
    const calls: string[] = []
    let registeredDuringLoad = false

    core.registerLoadHook((data) => {
      const documentData = asCoreRawData(data)
      calls.push(`initial:${documentData.version}`)
      if (!registeredDuringLoad) {
        registeredDuringLoad = true
        core.registerLoadHook((laterData) => {
          const laterDocument = asCoreRawData(laterData)
          calls.push(`registered-during-load:${laterDocument.version}`)
          return { ...laterDocument, version: 'v3' }
        })
      }
      return { ...documentData, version: 'v2' }
    })

    const input = {
      version: 'v1',
      sceneTree: { workspace: '', workspaceList: [], elements: {} },
      props: {}
    }
    core.load(input)

    expect(calls).toEqual(['initial:v1'])
    expect(core.version).toBe('v2')

    core.load(input)

    expect(calls).toEqual([
      'initial:v1',
      'initial:v1',
      'registered-during-load:v2'
    ])
    expect(core.version).toBe('v3')
  })

  it('keeps load-hook registrations isolated between Core instances', () => {
    const first = createCoreForTest()
    const second = createCoreForTest()
    const firstHook = vi.fn((data: unknown) => {
      const documentData = asCoreRawData(data)
      return {
        ...documentData,
        version: 'first-migrated'
      }
    })

    first.core.registerLoadHook(firstHook)
    second.core.load({
      version: 'second-current',
      sceneTree: { workspace: '', workspaceList: [], elements: {} },
      props: {}
    })

    expect(firstHook).not.toHaveBeenCalled()
    expect(first.core.version).toBe('1.0.0')
    expect(second.core.version).toBe('second-current')
  })

  it('uses identical migration ordering for direct and provider-backed load', async () => {
    const direct = createCoreForTest()
    const provider = createCoreForTest()
    const directCalls: string[] = []
    const providerCalls: string[] = []
    const documentData: CoreRawData = {
      version: 'v1',
      sceneTree: { workspace: '', workspaceList: [], elements: {} },
      props: {},
      systemContext: { zoom: 200 }
    }
    const systemValidation = {
      data: { zoom: 200 },
      diagnostics: [
        {
          path: 'systemContext.legacyZoom',
          message: 'Ignored legacy managed property during load'
        }
      ]
    }
    direct.systemContext.validateManagedProperties.mockReturnValue(
      systemValidation
    )
    provider.systemContext.validateManagedProperties.mockReturnValue(
      systemValidation
    )
    const directDiagnostics = vi.fn()
    const providerDiagnostics = vi.fn()
    direct.core.registerLoadDiagnosticsHook(directDiagnostics)
    provider.core.registerLoadDiagnosticsHook(providerDiagnostics)
    const registerChain = (core: Core, calls: string[]) => {
      core.registerLoadHook((data) => {
        const documentData = asCoreRawData(data)
        calls.push(`v1-to-v2:${documentData.version}`)
        return { ...documentData, version: 'v2' }
      })
      core.registerLoadHook((data) => {
        const documentData = asCoreRawData(data)
        calls.push(`v2-to-v3:${documentData.version}`)
        return { ...documentData, version: 'v3' }
      })
    }
    registerChain(direct.core, directCalls)
    registerChain(provider.core, providerCalls)

    direct.core.load(documentData)

    prepareCoreStart(provider.core)
    provider.core.setPersistence({
      name: 'migration-parity-provider',
      load: vi.fn(async () => documentData),
      save: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined)
    })
    await provider.core.start(document.createElement('div'), {
      width: 1,
      height: 1
    })

    expect(providerCalls).toEqual(directCalls)
    expect(provider.core.version).toBe(direct.core.version)
    expect(provider.props.validateLoadData.mock.calls).toEqual(
      direct.props.validateLoadData.mock.calls
    )
    expect(provider.sceneTree.validateLoadData.mock.calls).toEqual(
      direct.sceneTree.validateLoadData.mock.calls
    )
    expect(provider.systemContext.validateManagedProperties.mock.calls).toEqual(
      direct.systemContext.validateManagedProperties.mock.calls
    )
    expect(provider.props.applyValidatedLoad.mock.calls).toEqual(
      direct.props.applyValidatedLoad.mock.calls
    )
    expect(provider.sceneTree.applyValidatedLoad.mock.calls).toEqual(
      direct.sceneTree.applyValidatedLoad.mock.calls
    )
    expect(
      provider.systemContext.applyValidatedManagedProperties.mock.calls
    ).toEqual(direct.systemContext.applyValidatedManagedProperties.mock.calls)
    expect(providerDiagnostics.mock.calls).toEqual(directDiagnostics.mock.calls)
  })

  it('uses identical migration-failure bypasses for direct and provider-backed load', async () => {
    const direct = createCoreForTest()
    const provider = createCoreForTest()
    const migrationFailure = new Error('APP_MIGRATION_UNSUPPORTED_VERSION')
    const documentData = {
      version: 'unsupported',
      sceneTree: { workspace: '', workspaceList: [], elements: {} },
      props: {}
    }
    const directDiagnostics = vi.fn()
    const providerDiagnostics = vi.fn()
    direct.core.registerLoadDiagnosticsHook(directDiagnostics)
    provider.core.registerLoadDiagnosticsHook(providerDiagnostics)
    direct.core.registerLoadHook(() => {
      throw migrationFailure
    })
    provider.core.registerLoadHook(() => {
      throw migrationFailure
    })

    expect(() => direct.core.load(documentData)).toThrow(migrationFailure)

    prepareCoreStart(provider.core)
    provider.core.setPersistence({
      name: 'migration-failure-parity-provider',
      load: vi.fn(async () => documentData),
      save: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined)
    })
    await expect(
      provider.core.start(document.createElement('div'), {
        width: 1,
        height: 1
      })
    ).rejects.toThrow(migrationFailure)
    ;[direct, provider].forEach(({ props, sceneTree, systemContext }) => {
      expect(props.validateLoadData).not.toHaveBeenCalled()
      expect(sceneTree.validateLoadData).not.toHaveBeenCalled()
      expect(systemContext.validateManagedProperties).not.toHaveBeenCalled()
      expect(props.load).not.toHaveBeenCalled()
      expect(sceneTree.load).not.toHaveBeenCalled()
      expect(
        systemContext.applyValidatedManagedProperties
      ).not.toHaveBeenCalled()
    })
    expect(directDiagnostics).not.toHaveBeenCalled()
    expect(providerDiagnostics).not.toHaveBeenCalled()
    expect(provider.core.version).toBe(direct.core.version)
  })

  it('bypasses migration and package load when the provider has no document', async () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()
    const hook = vi.fn((data: unknown) => asCoreRawData(data))
    core.registerLoadHook(hook)
    prepareCoreStart(core)
    core.setPersistence({
      name: 'empty-provider',
      load: vi.fn(async () => null),
      save: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined)
    })

    await core.start(document.createElement('div'), { width: 1, height: 1 })

    expect(hook).not.toHaveBeenCalled()
    expect(props.validateLoadData).not.toHaveBeenCalled()
    expect(sceneTree.validateLoadData).not.toHaveBeenCalled()
    expect(systemContext.validateManagedProperties).not.toHaveBeenCalled()
    expect(props.load).not.toHaveBeenCalled()
    expect(sceneTree.load).not.toHaveBeenCalled()
    expect(systemContext.applyValidatedManagedProperties).not.toHaveBeenCalled()
  })

  it('treats provider undefined as the same no-document bypass', async () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()
    const loadHook = vi.fn()
    const diagnosticsHook = vi.fn()
    core.registerLoadHook(loadHook)
    core.registerLoadDiagnosticsHook(diagnosticsHook)
    prepareCoreStart(core)
    core.setPersistence({
      name: 'undefined-provider',
      load: vi.fn(async () => undefined),
      save: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined)
    })

    await core.start(document.createElement('div'), { width: 1, height: 1 })

    expect(loadHook).not.toHaveBeenCalled()
    expect(props.validateLoadData).not.toHaveBeenCalled()
    expect(sceneTree.validateLoadData).not.toHaveBeenCalled()
    expect(systemContext.validateManagedProperties).not.toHaveBeenCalled()
    expect(props.applyValidatedLoad).not.toHaveBeenCalled()
    expect(sceneTree.applyValidatedLoad).not.toHaveBeenCalled()
    expect(systemContext.applyValidatedManagedProperties).not.toHaveBeenCalled()
    expect(diagnosticsHook).not.toHaveBeenCalled()
  })

  it('treats direct null and undefined as the same no-document bypass', () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()
    const loadHook = vi.fn()
    const diagnosticsHook = vi.fn()
    core.registerLoadHook(loadHook)
    core.registerLoadDiagnosticsHook(diagnosticsHook)

    core.load(null)
    core.load(undefined)

    expect(loadHook).not.toHaveBeenCalled()
    expect(props.validateLoadData).not.toHaveBeenCalled()
    expect(sceneTree.validateLoadData).not.toHaveBeenCalled()
    expect(systemContext.validateManagedProperties).not.toHaveBeenCalled()
    expect(props.applyValidatedLoad).not.toHaveBeenCalled()
    expect(sceneTree.applyValidatedLoad).not.toHaveBeenCalled()
    expect(systemContext.applyValidatedManagedProperties).not.toHaveBeenCalled()
    expect(diagnosticsHook).not.toHaveBeenCalled()
  })

  it('stops a thrown app hook before validators and canonical apply', () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()
    const failure = new Error('APP_MIGRATION_UNSUPPORTED_VERSION')
    const diagnosticsHook = vi.fn()
    const fileLoadEvents: number[] = []
    const subscription = subscribeToFileLoadComplete(() => {
      fileLoadEvents.push(1)
    })
    const fileLoadEventBaseline = fileLoadEvents.length
    core.registerLoadDiagnosticsHook(diagnosticsHook)

    core.registerLoadHook(() => {
      throw failure
    })

    expect(() =>
      core.load({
        version: 'unsupported',
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {}
      })
    ).toThrow(failure)
    subscription.unsubscribe()
    expect(props.validateLoadData).not.toHaveBeenCalled()
    expect(sceneTree.validateLoadData).not.toHaveBeenCalled()
    expect(systemContext.loadManagedProperties).not.toHaveBeenCalled()
    expect(props.load).not.toHaveBeenCalled()
    expect(sceneTree.load).not.toHaveBeenCalled()
    expect(core.version).toBe('1.0.0')
    expect(fileLoadEvents).toHaveLength(fileLoadEventBaseline)
    expect(diagnosticsHook).not.toHaveBeenCalled()
  })

  it('applies no canonical state when managed-property validation fails', () => {
    const { core, props, sceneTree, systemContext } = createCoreForTest()
    const failure = new Error('system validation failed')
    const diagnosticsHook = vi.fn()
    const fileLoadEvents: number[] = []
    const subscription = subscribeToFileLoadComplete(() => {
      fileLoadEvents.push(1)
    })
    const fileLoadEventBaseline = fileLoadEvents.length
    core.registerLoadDiagnosticsHook(diagnosticsHook)
    systemContext.validateManagedProperties.mockImplementation(() => {
      throw failure
    })

    expect(() =>
      core.load({
        version: 'v2',
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {},
        systemContext: { zoom: 200 }
      })
    ).toThrow(failure)
    subscription.unsubscribe()

    expect(props.validateLoadData).toHaveBeenCalledOnce()
    expect(sceneTree.validateLoadData).toHaveBeenCalledOnce()
    expect(props.applyValidatedLoad).not.toHaveBeenCalled()
    expect(sceneTree.applyValidatedLoad).not.toHaveBeenCalled()
    expect(props.load).not.toHaveBeenCalled()
    expect(sceneTree.load).not.toHaveBeenCalled()
    expect(systemContext.applyValidatedManagedProperties).not.toHaveBeenCalled()
    expect(systemContext.loadManagedProperties).not.toHaveBeenCalled()
    expect(core.version).toBe('1.0.0')
    expect(fileLoadEvents).toHaveLength(fileLoadEventBaseline)
    expect(diagnosticsHook).not.toHaveBeenCalled()
  })

  it('uses the empty hook chain and falls back safely for an invalid root payload', () => {
    const { core, props, sceneTree } = createCoreForTest()

    core.load('invalid-data' as unknown as CoreRawData)

    expect(props.validateLoadData).toHaveBeenCalledWith({})
    expect(sceneTree.validateLoadData).toHaveBeenCalledWith({
      workspace: '',
      workspaceList: [],
      elements: {}
    })
    expect(sceneTree.applyValidatedLoad).toHaveBeenCalledTimes(1)
    expect(props.applyValidatedLoad).toHaveBeenCalledTimes(1)
    expect(sceneTree.load).not.toHaveBeenCalled()
    expect(props.load).not.toHaveBeenCalled()
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
