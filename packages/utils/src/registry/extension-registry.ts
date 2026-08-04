import { MapRegistry } from './map-registry.js'
import type { RegistrationOwnerMetadata } from './registration-owner.js'

export const EXTENSION_STRATEGIES = ['before', 'after', 'append'] as const

export type ExtensionStrategy = (typeof EXTENSION_STRATEGIES)[number]

export const EXTENSION_ERROR_CODES = [
  'DUPLICATE_TARGET',
  'DUPLICATE_EXTENSION',
  'TARGET_NOT_FOUND',
  'INVALID_STRATEGY',
  'UNSUPPORTED_STRATEGY',
  'APPLY_FAILED',
  'TARGET_NOT_APPLIED',
  'CLEANUP_FAILED'
] as const

export type ExtensionErrorCode = (typeof EXTENSION_ERROR_CODES)[number]

export type ExtensionOperation =
  | 'register-target'
  | 'register-extension'
  | 'apply-target'
  | 'unregister-target'
  | 'dispose'

export interface ExtensionTargetMetadata {
  key: string
  name: string
  kind: string
  owner: RegistrationOwnerMetadata
  supportedStrategies: readonly ExtensionStrategy[]
}

export interface ExtensionMetadata {
  key: string
  targetKey: string
  owner: RegistrationOwnerMetadata
  strategy: ExtensionStrategy
}

export type ExtensionCleanup = () => void

export type ExtensionInstaller<Context> = (context: Context) => ExtensionCleanup

export interface ExtensionTargetDefinition<Context>
  extends ExtensionTargetMetadata {
  install: ExtensionInstaller<Context>
}

export interface ExtensionRegistration<Context> extends ExtensionMetadata {
  install: ExtensionInstaller<Context>
}

export interface ExtensionOperationSuccess {
  ok: true
  operation: ExtensionOperation
  targetKey?: string
  extensionKey?: string
  appliedKeys?: readonly string[]
}

export interface ExtensionOperationFailure {
  ok: false
  operation: ExtensionOperation
  code: ExtensionErrorCode
  message: string
  targetKey?: string
  extensionKey?: string
  cause?: unknown
  cleanupErrors?: readonly unknown[]
}

export type ExtensionOperationResult =
  | ExtensionOperationSuccess
  | ExtensionOperationFailure

export class ExtensionContractError extends Error {
  readonly result: ExtensionOperationFailure
  readonly code: ExtensionErrorCode

  constructor(result: ExtensionOperationFailure) {
    super(result.message)
    this.name = 'ExtensionContractError'
    this.result = result
    this.code = result.code
  }
}

type TargetRecord<Context> = ExtensionTargetDefinition<Context>

type ExtensionRecord<Context> = ExtensionRegistration<Context>

interface AppliedCleanup {
  key: string
  dispose: ExtensionCleanup
  disposed: boolean
}

interface AppliedTarget {
  key: string
  cleanups: AppliedCleanup[]
}

const isExtensionStrategy = (value: unknown): value is ExtensionStrategy =>
  typeof value === 'string' &&
  (EXTENSION_STRATEGIES as readonly string[]).includes(value)

const cloneOwner = (
  owner: RegistrationOwnerMetadata
): RegistrationOwnerMetadata => ({
  packageName: owner.packageName,
  name: owner.name
})

const cloneTargetMetadata = <Context>(
  target: TargetRecord<Context>
): ExtensionTargetMetadata => ({
  key: target.key,
  name: target.name,
  kind: target.kind,
  owner: cloneOwner(target.owner),
  supportedStrategies: [...target.supportedStrategies]
})

const cloneExtensionMetadata = <Context>(
  extension: ExtensionRecord<Context>
): ExtensionMetadata => ({
  key: extension.key,
  targetKey: extension.targetKey,
  owner: cloneOwner(extension.owner),
  strategy: extension.strategy
})

const failure = (
  code: ExtensionErrorCode,
  operation: ExtensionOperation,
  message: string,
  details: Omit<
    ExtensionOperationFailure,
    'ok' | 'code' | 'operation' | 'message'
  > = {}
): never => {
  throw new ExtensionContractError({
    ok: false,
    code,
    operation,
    message,
    ...details
  })
}

const disposeCleanups = (cleanups: AppliedCleanup[]): unknown[] => {
  const errors: unknown[] = []
  for (let index = cleanups.length - 1; index >= 0; index -= 1) {
    if (cleanups[index].disposed) {
      continue
    }
    try {
      cleanups[index].dispose()
      cleanups[index].disposed = true
    } catch (error) {
      errors.push(error)
    }
  }
  return errors
}

export class ExtensionRegistryApplication<Context> {
  readonly results: readonly ExtensionOperationSuccess[]
  private readonly registry: ExtensionRegistry<Context>
  private readonly appliedTargets: AppliedTarget[]

  constructor(
    registry: ExtensionRegistry<Context>,
    appliedTargets: AppliedTarget[],
    results: ExtensionOperationSuccess[]
  ) {
    this.registry = registry
    this.appliedTargets = appliedTargets
    this.results = results.map((result) => ({
      ...result,
      appliedKeys: result.appliedKeys ? [...result.appliedKeys] : undefined
    }))
  }

  getTarget(key: string): ExtensionTargetMetadata | undefined {
    return this.registry.getTarget(key)
  }

  getTargets(): ExtensionTargetMetadata[] {
    return this.registry.getTargets()
  }

  unregisterTarget(key: string): ExtensionOperationSuccess {
    if (!this.registry.hasTarget(key)) {
      return failure(
        'TARGET_NOT_FOUND',
        'unregister-target',
        `Extension target "${key}" was not found`,
        { targetKey: key }
      )
    }

    const index = this.appliedTargets.findIndex((target) => target.key === key)
    if (index < 0) {
      return failure(
        'TARGET_NOT_APPLIED',
        'unregister-target',
        `Extension target "${key}" is not applied`,
        { targetKey: key }
      )
    }

    const target = this.appliedTargets[index]
    const cleanupErrors = disposeCleanups(target.cleanups)
    if (cleanupErrors.length > 0) {
      return failure(
        'CLEANUP_FAILED',
        'unregister-target',
        `Extension target "${key}" cleanup failed`,
        { targetKey: key, cleanupErrors }
      )
    }

    this.appliedTargets.splice(index, 1)

    return {
      ok: true,
      operation: 'unregister-target',
      targetKey: key,
      appliedKeys: target.cleanups.map((item) => item.key)
    }
  }

  dispose(): ExtensionOperationSuccess {
    const cleanupErrors: unknown[] = []
    const appliedKeys: string[] = []

    for (let index = this.appliedTargets.length - 1; index >= 0; index -= 1) {
      const target = this.appliedTargets[index]
      appliedKeys.push(...target.cleanups.map((item) => item.key))
      const targetCleanupErrors = disposeCleanups(target.cleanups)
      cleanupErrors.push(...targetCleanupErrors)
      if (targetCleanupErrors.length === 0) {
        this.appliedTargets.splice(index, 1)
      }
    }

    if (cleanupErrors.length > 0) {
      return failure(
        'CLEANUP_FAILED',
        'dispose',
        'Extension registry application cleanup failed',
        { cleanupErrors }
      )
    }

    return {
      ok: true,
      operation: 'dispose',
      appliedKeys
    }
  }
}

export class ExtensionRegistry<Context> {
  private readonly targets = new MapRegistry<string, TargetRecord<Context>>()
  private readonly targetOrder: string[] = []
  private readonly extensions = new MapRegistry<
    string,
    ExtensionRecord<Context>
  >()
  private readonly extensionOrder: string[] = []

  registerTarget(
    definition: ExtensionTargetDefinition<Context>
  ): ExtensionOperationSuccess {
    if (this.targets.has(definition.key)) {
      return failure(
        'DUPLICATE_TARGET',
        'register-target',
        `Extension target "${definition.key}" is already registered`,
        { targetKey: definition.key }
      )
    }

    for (const strategy of definition.supportedStrategies) {
      if (!isExtensionStrategy(strategy)) {
        return failure(
          'INVALID_STRATEGY',
          'register-target',
          `Extension target "${definition.key}" declares invalid strategy "${String(strategy)}"`,
          { targetKey: definition.key }
        )
      }
    }

    const target: TargetRecord<Context> = {
      key: definition.key,
      name: definition.name,
      kind: definition.kind,
      owner: cloneOwner(definition.owner),
      supportedStrategies: [...new Set(definition.supportedStrategies)],
      install: definition.install
    }
    this.targets.register(target.key, target)
    this.targetOrder.push(target.key)

    return {
      ok: true,
      operation: 'register-target',
      targetKey: target.key
    }
  }

  registerExtension(
    registration: ExtensionRegistration<Context>
  ): ExtensionOperationSuccess {
    const target = this.targets.get(registration.targetKey)
    if (!target) {
      return failure(
        'TARGET_NOT_FOUND',
        'register-extension',
        `Extension target "${registration.targetKey}" was not found`,
        {
          targetKey: registration.targetKey,
          extensionKey: registration.key
        }
      )
    }
    if (!isExtensionStrategy(registration.strategy)) {
      return failure(
        'INVALID_STRATEGY',
        'register-extension',
        `Extension "${registration.key}" uses invalid strategy "${String(registration.strategy)}"`,
        {
          targetKey: registration.targetKey,
          extensionKey: registration.key
        }
      )
    }
    if (!target.supportedStrategies.includes(registration.strategy)) {
      return failure(
        'UNSUPPORTED_STRATEGY',
        'register-extension',
        `Extension target "${registration.targetKey}" does not support strategy "${registration.strategy}"`,
        {
          targetKey: registration.targetKey,
          extensionKey: registration.key
        }
      )
    }
    if (this.extensions.has(registration.key)) {
      return failure(
        'DUPLICATE_EXTENSION',
        'register-extension',
        `Extension "${registration.key}" is already registered`,
        {
          targetKey: registration.targetKey,
          extensionKey: registration.key
        }
      )
    }
    const extension: ExtensionRecord<Context> = {
      key: registration.key,
      targetKey: registration.targetKey,
      owner: cloneOwner(registration.owner),
      strategy: registration.strategy,
      install: registration.install
    }
    this.extensions.register(extension.key, extension)
    this.extensionOrder.push(extension.key)

    return {
      ok: true,
      operation: 'register-extension',
      targetKey: extension.targetKey,
      extensionKey: extension.key
    }
  }

  hasTarget(key: string): boolean {
    return this.targets.has(key)
  }

  getTarget(key: string): ExtensionTargetMetadata | undefined {
    const target = this.targets.get(key)
    return target ? cloneTargetMetadata(target) : undefined
  }

  getTargets(): ExtensionTargetMetadata[] {
    return this.targetOrder.flatMap((key) => {
      const target = this.targets.get(key)
      return target ? [cloneTargetMetadata(target)] : []
    })
  }

  getExtension(key: string): ExtensionMetadata | undefined {
    const extension = this.extensions.get(key)
    return extension ? cloneExtensionMetadata(extension) : undefined
  }

  getExtensions(): ExtensionMetadata[] {
    return this.extensionOrder.flatMap((key) => {
      const extension = this.extensions.get(key)
      return extension ? [cloneExtensionMetadata(extension)] : []
    })
  }

  apply(context: Context): ExtensionRegistryApplication<Context> {
    const appliedTargets: AppliedTarget[] = []
    const results: ExtensionOperationSuccess[] = []

    try {
      for (const key of this.targetOrder) {
        const target = this.targets.get(key)
        if (!target) {
          continue
        }
        const applied = this.applyTarget(target, context)
        appliedTargets.push(applied.target)
        results.push(applied.result)
      }
    } catch (error) {
      const cleanupErrors: unknown[] = []
      for (let index = appliedTargets.length - 1; index >= 0; index -= 1) {
        cleanupErrors.push(...disposeCleanups(appliedTargets[index].cleanups))
      }

      if (
        error instanceof ExtensionContractError &&
        cleanupErrors.length === 0
      ) {
        throw error
      }
      return failure(
        'APPLY_FAILED',
        'apply-target',
        'Extension registry apply failed',
        { cause: error, cleanupErrors }
      )
    }

    return new ExtensionRegistryApplication(this, appliedTargets, results)
  }

  private getExtensionsForTarget(
    targetKey: string
  ): ExtensionRecord<Context>[] {
    return this.extensionOrder.flatMap((key) => {
      const extension = this.extensions.get(key)
      return extension?.targetKey === targetKey ? [extension] : []
    })
  }

  private applyTarget(
    target: TargetRecord<Context>,
    context: Context
  ): { target: AppliedTarget; result: ExtensionOperationSuccess } {
    const extensions = this.getExtensionsForTarget(target.key)
    const before = extensions.filter((item) => item.strategy === 'before')
    const after = extensions.filter((item) => item.strategy === 'after')
    const append = extensions.filter((item) => item.strategy === 'append')
    const defaultInstaller = {
      key: target.key,
      install: target.install
    }
    const resolved = [...before, defaultInstaller, ...after, ...append]
    const cleanups: AppliedCleanup[] = []

    try {
      for (const item of resolved) {
        const dispose = item.install(context)
        if (typeof dispose !== 'function') {
          throw new TypeError(
            `Extension installer "${item.key}" must return a cleanup function`
          )
        }
        cleanups.push({ key: item.key, dispose, disposed: false })
      }
    } catch (error) {
      const cleanupErrors = disposeCleanups(cleanups)
      return failure(
        'APPLY_FAILED',
        'apply-target',
        `Extension target "${target.key}" apply failed`,
        { targetKey: target.key, cause: error, cleanupErrors }
      )
    }

    return {
      target: { key: target.key, cleanups },
      result: {
        ok: true,
        operation: 'apply-target',
        targetKey: target.key,
        appliedKeys: cleanups.map((item) => item.key)
      }
    }
  }
}
