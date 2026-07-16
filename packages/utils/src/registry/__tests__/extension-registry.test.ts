import { describe, expect, it } from 'vitest'
import {
  EXTENSION_STRATEGIES,
  ExtensionContractError,
  ExtensionRegistry,
  type ExtensionCleanup,
  type ExtensionOwnerMetadata,
  type ExtensionStrategy
} from '../extension-registry'

interface TestContext {
  events: string[]
}

const PRESET_OWNER: ExtensionOwnerMetadata = {
  packageName: '@asyra/preset',
  name: 'default preset'
}

const APP_OWNER: ExtensionOwnerMetadata = {
  packageName: '@asyra/test-app',
  name: 'test app'
}

const cleanup =
  (events: string[], value: string): ExtensionCleanup =>
  () => {
    events.push(`dispose:${value}`)
  }

const registerTarget = (
  registry: ExtensionRegistry<TestContext>,
  options: {
    key?: string
    supportedStrategies?: readonly ExtensionStrategy[]
    install?: (context: TestContext) => ExtensionCleanup
  } = {}
) =>
  registry.registerTarget({
    key: options.key ?? 'preset.target',
    name: 'Preset target',
    kind: 'test',
    owner: PRESET_OWNER,
    supportedStrategies: options.supportedStrategies ?? EXTENSION_STRATEGIES,
    install:
      options.install ??
      ((context) => {
        context.events.push('default')
        return cleanup(context.events, 'default')
      })
  })

const expectContractError = (
  run: () => unknown,
  code: ExtensionContractError['code']
) => {
  try {
    run()
    throw new Error(`Expected ExtensionContractError ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(ExtensionContractError)
    expect((error as ExtensionContractError).code).toBe(code)
    expect((error as ExtensionContractError).result).toMatchObject({
      ok: false,
      code
    })
  }
}

describe('ExtensionRegistry', () => {
  it('exposes additive strategies only', () => {
    expect(EXTENSION_STRATEGIES).toEqual(['before', 'after', 'append'])
  })

  it('resolves explicit strategy buckets deterministically', () => {
    const registry = new ExtensionRegistry<TestContext>()
    registerTarget(registry)

    const add = (key: string, strategy: ExtensionStrategy) => {
      registry.registerExtension({
        key,
        targetKey: 'preset.target',
        owner: APP_OWNER,
        strategy,
        install: (context) => {
          context.events.push(key)
          return cleanup(context.events, key)
        }
      })
    }

    add('append:first', 'append')
    add('after:first', 'after')
    add('before:first', 'before')
    add('before:second', 'before')
    add('after:second', 'after')
    add('append:second', 'append')

    const events: string[] = []
    const application = registry.apply({ events })

    expect(events).toEqual([
      'before:first',
      'before:second',
      'default',
      'after:first',
      'after:second',
      'append:first',
      'append:second'
    ])
    expect(application.results).toEqual([
      expect.objectContaining({
        ok: true,
        operation: 'apply-target',
        targetKey: 'preset.target',
        appliedKeys: [
          'before:first',
          'before:second',
          'preset.target',
          'after:first',
          'after:second',
          'append:first',
          'append:second'
        ]
      })
    ])
  })

  it('returns detached query metadata', () => {
    const registry = new ExtensionRegistry<TestContext>()
    registerTarget(registry)
    registry.registerExtension({
      key: 'app.after',
      targetKey: 'preset.target',
      owner: APP_OWNER,
      strategy: 'after',
      install: (context) => cleanup(context.events, 'app.after')
    })

    const target = registry.getTarget('preset.target')
    const extension = registry.getExtension('app.after')
    expect(target).toMatchObject({
      key: 'preset.target',
      name: 'Preset target',
      owner: PRESET_OWNER,
      supportedStrategies: EXTENSION_STRATEGIES
    })
    expect(extension).toMatchObject({
      key: 'app.after',
      targetKey: 'preset.target',
      owner: APP_OWNER,
      strategy: 'after'
    })

    if (!target || !extension) {
      throw new Error('Expected query metadata')
    }
    ;(target.owner as { name: string }).name = 'mutated'
    ;(target.supportedStrategies as ExtensionStrategy[]).pop()
    ;(extension.owner as { name: string }).name = 'mutated'

    expect(registry.getTarget('preset.target')).toMatchObject({
      owner: PRESET_OWNER,
      supportedStrategies: EXTENSION_STRATEGIES
    })
    expect(registry.getExtension('app.after')).toMatchObject({
      owner: APP_OWNER
    })
  })

  it('fails fast with stable structured registration errors', () => {
    const registry = new ExtensionRegistry<TestContext>()
    registerTarget(registry)

    expectContractError(() => registerTarget(registry), 'DUPLICATE_TARGET')
    expectContractError(
      () =>
        registry.registerExtension({
          key: 'missing',
          targetKey: 'missing.target',
          owner: APP_OWNER,
          strategy: 'after',
          install: (context) => cleanup(context.events, 'missing')
        }),
      'TARGET_NOT_FOUND'
    )
    expectContractError(
      () =>
        registry.registerExtension({
          key: 'invalid',
          targetKey: 'preset.target',
          owner: APP_OWNER,
          strategy: 'around' as ExtensionStrategy,
          install: (context) => cleanup(context.events, 'invalid')
        }),
      'INVALID_STRATEGY'
    )

    registry.registerExtension({
      key: 'duplicate',
      targetKey: 'preset.target',
      owner: APP_OWNER,
      strategy: 'after',
      install: (context) => cleanup(context.events, 'duplicate')
    })
    expectContractError(
      () =>
        registry.registerExtension({
          key: 'duplicate',
          targetKey: 'preset.target',
          owner: APP_OWNER,
          strategy: 'append',
          install: (context) => cleanup(context.events, 'duplicate:second')
        }),
      'DUPLICATE_EXTENSION'
    )
  })

  it('rejects unsupported and non-additive strategies before apply', () => {
    const registry = new ExtensionRegistry<TestContext>()
    registerTarget(registry, { supportedStrategies: ['after'] })

    expectContractError(
      () =>
        registry.registerExtension({
          key: 'unsupported',
          targetKey: 'preset.target',
          owner: APP_OWNER,
          strategy: 'before',
          install: (context) => cleanup(context.events, 'unsupported')
        }),
      'UNSUPPORTED_STRATEGY'
    )

    expectContractError(
      () =>
        registry.registerExtension({
          key: 'non-additive',
          targetKey: 'preset.target',
          owner: APP_OWNER,
          strategy: 'replace' as ExtensionStrategy,
          install: (context) => cleanup(context.events, 'non-additive')
        }),
      'INVALID_STRATEGY'
    )
  })

  it('rolls back applied resources in reverse order when apply fails', () => {
    const registry = new ExtensionRegistry<TestContext>()
    registerTarget(registry)
    registry.registerExtension({
      key: 'app.after',
      targetKey: 'preset.target',
      owner: APP_OWNER,
      strategy: 'after',
      install: (context) => {
        context.events.push('app.after')
        return cleanup(context.events, 'app.after')
      }
    })
    registry.registerExtension({
      key: 'app.append.fail',
      targetKey: 'preset.target',
      owner: APP_OWNER,
      strategy: 'append',
      install: () => {
        throw new Error('installer failed')
      }
    })

    const events: string[] = []
    expectContractError(() => registry.apply({ events }), 'APPLY_FAILED')
    expect(events).toEqual([
      'default',
      'app.after',
      'dispose:app.after',
      'dispose:default'
    ])
  })

  it('unregisters one applied target and disposes resources in reverse order', () => {
    const registry = new ExtensionRegistry<TestContext>()
    registerTarget(registry)
    registry.registerExtension({
      key: 'app.after',
      targetKey: 'preset.target',
      owner: APP_OWNER,
      strategy: 'after',
      install: (context) => {
        context.events.push('app.after')
        return cleanup(context.events, 'app.after')
      }
    })

    const events: string[] = []
    const application = registry.apply({ events })
    const result = application.unregisterTarget('preset.target')

    expect(result).toMatchObject({
      ok: true,
      operation: 'unregister-target',
      targetKey: 'preset.target'
    })
    expect(events).toEqual([
      'default',
      'app.after',
      'dispose:app.after',
      'dispose:default'
    ])
    expectContractError(
      () => application.unregisterTarget('preset.target'),
      'TARGET_NOT_APPLIED'
    )
  })

  it('reports cleanup failure without allowing redefine to continue', () => {
    const registry = new ExtensionRegistry<TestContext>()
    registerTarget(registry, {
      install: () => () => {
        throw new Error('cleanup failed')
      }
    })

    const application = registry.apply({ events: [] })
    expectContractError(
      () => application.unregisterTarget('preset.target'),
      'CLEANUP_FAILED'
    )
  })

  it('keeps failed cleanup applied and retries only the remaining owned resource', () => {
    const registry = new ExtensionRegistry<TestContext>()
    const cleanupEvents: string[] = []
    let shouldFail = true
    registerTarget(registry, {
      install: () => () => {
        cleanupEvents.push('default')
      }
    })
    registry.registerExtension({
      key: 'app.after.retryable',
      targetKey: 'preset.target',
      owner: APP_OWNER,
      strategy: 'after',
      install: () => () => {
        cleanupEvents.push('extension')
        if (shouldFail) {
          throw new Error('active resource')
        }
      }
    })

    const application = registry.apply({ events: [] })
    expectContractError(
      () => application.unregisterTarget('preset.target'),
      'CLEANUP_FAILED'
    )
    expect(cleanupEvents).toEqual(['extension', 'default'])

    shouldFail = false
    expect(application.unregisterTarget('preset.target')).toMatchObject({
      ok: true,
      targetKey: 'preset.target'
    })
    expect(cleanupEvents).toEqual(['extension', 'default', 'extension'])
    expectContractError(
      () => application.unregisterTarget('preset.target'),
      'TARGET_NOT_APPLIED'
    )
  })

  it('supports deterministic unregister then app redefine fallback', () => {
    const events: string[] = []
    const registry = new ExtensionRegistry<TestContext>()
    registerTarget(registry, { supportedStrategies: [] })

    expectContractError(
      () =>
        registry.registerExtension({
          key: 'app.after',
          targetKey: 'preset.target',
          owner: APP_OWNER,
          strategy: 'after',
          install: (context) => cleanup(context.events, 'app.after')
        }),
      'UNSUPPORTED_STRATEGY'
    )

    const application = registry.apply({ events })
    application.unregisterTarget('preset.target')
    events.push('app:redefine')

    expect(events).toEqual(['default', 'dispose:default', 'app:redefine'])
  })

  it('applies targets in target registration order and disposes in reverse', () => {
    const events: string[] = []
    const registry = new ExtensionRegistry<TestContext>()
    registerTarget(registry, { key: 'preset.first' })
    registerTarget(registry, { key: 'preset.second' })

    const application = registry.apply({ events })
    expect(events).toEqual(['default', 'default'])

    application.dispose()
    expect(events).toEqual([
      'default',
      'default',
      'dispose:default',
      'dispose:default'
    ])
  })
})
