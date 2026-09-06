import {
  measureBrowserDragAsyncPhase,
  type RawInputEvent,
  type SystemContextSnapshot,
  type SystemContextSnapshotWithDetail
} from '@asyra/utils'
import type {
  FeatureDefinition,
  FeatureAPI,
  FeatureKeyMap
} from '../types/feature.js'
import type { CorePackages } from '../types/core-packages.js'
import type { InputSystemLike } from '../types/core-packages.js'
import { FeatureRegistry } from './feature-registry.js'
import { SessionManager } from './session-manager.js'
import executionRegistry from './execution-registry.js'
import {
  FeatureRuntimeClosedError,
  interactionQueue
} from './interaction-queue.js'
import { featureTaskRegistry } from './feature-task-registry.js'
import type {
  FeatureTaskHandler,
  InvokeFeatureTaskOptions
} from '../types/task.js'

const featureRegistry = new FeatureRegistry()
let sessionManager = new SessionManager()
let runtimeState: 'open' | 'closing' | 'closed' | 'failed' = 'open'
let runtimeIdentity = Symbol('feature-runtime')
let disposal: Promise<void> | null = null

const assertRuntimeOpen = (): void => {
  if (runtimeState !== 'open') throw new FeatureRuntimeClosedError()
}

let corePackages: CorePackages = {}
let isPackagesSet = false

type InputCallback = (raw: RawInputEvent) => void | Promise<void>

interface EventBinding {
  eventName: string
  participantType: 'execution' | 'session'
  sessionName?: string
  inputSystem?: InputSystemLike
  inputCallback?: InputCallback
  subscription?: { unsubscribe(): void }
  cleanupRequested: boolean
}

const eventBindings = new Map<string, EventBinding>()

const pendingRegistrations: {
  featureName: string
  keyConfig: FeatureKeyMap
  definition: FeatureDefinition<
    Record<string, unknown>,
    Record<string, unknown>
  >
}[] = []

export class FeatureUnregisterError extends Error {
  readonly code = 'FEATURE_IN_USE'
  readonly featureName: string

  constructor(featureName: string) {
    super(`Feature "${featureName}" cannot be unregistered while active`)
    this.name = 'FeatureUnregisterError'
    this.featureName = featureName
  }
}

const removeEventBinding = (eventName: string): void => {
  const binding = eventBindings.get(eventName)
  if (!binding) {
    return
  }

  eventBindings.delete(eventName)
  binding.cleanupRequested = true
  if (binding.inputSystem && binding.inputCallback) {
    binding.inputSystem.off(eventName, binding.inputCallback)
  }
  binding.subscription?.unsubscribe()
}

const cleanupUnusedEventBindings = (): void => {
  for (const [eventName, binding] of eventBindings) {
    const inUse =
      binding.participantType === 'session'
        ? sessionManager.hasSessionHandlers(binding.sessionName as string)
        : executionRegistry.hasHandlers(eventName)
    if (!inUse) {
      removeEventBinding(eventName)
    }
  }
}

const createInputSnapshot = (
  systemContext: NonNullable<CorePackages['systemContext']>,
  raw: RawInputEvent
): SystemContextSnapshotWithDetail => {
  const snapshot = systemContext.getSystemContextSnapshot?.() ?? raw
  return {
    ...snapshot,
    ...(raw.detail ? { detail: raw.detail } : {})
  } as SystemContextSnapshotWithDetail
}

const registerSessionEventBinding = (
  eventName: string,
  sessionName: string,
  inputSystem: InputSystemLike,
  systemContext: NonNullable<CorePackages['systemContext']>
): void => {
  if (eventBindings.has(eventName)) {
    return
  }

  const manager = sessionManager
  const inputCallback: InputCallback = async (raw) => {
    let phase: 'start' | 'update' | 'end' = 'end'
    if (eventName.endsWith('.update')) {
      phase = 'update'
    }
    if (eventName.endsWith('.start')) {
      phase = 'start'
    }
    await measureBrowserDragAsyncPhase(`feature:event:${eventName}`, () =>
      manager.handleSessionInput(
        sessionName,
        phase,
        () => createInputSnapshot(systemContext, raw),
        eventName
      )
    )
  }
  inputSystem.on(eventName, inputCallback)
  eventBindings.set(eventName, {
    eventName,
    participantType: 'session',
    sessionName,
    inputSystem,
    inputCallback,
    cleanupRequested: false
  })
}

const registerExecutionEventBinding = (
  eventName: string,
  inputSystem: InputSystemLike,
  systemContext: NonNullable<CorePackages['systemContext']>
): void => {
  if (eventBindings.has(eventName)) {
    return
  }

  if (eventName.startsWith('render.')) {
    const binding: EventBinding = {
      eventName,
      participantType: 'execution',
      cleanupRequested: false
    }
    eventBindings.set(eventName, binding)

    import('@asyra/reactive-events')
      .then((module) => {
        const subscription = module
          .getEventBus()
          .subscribe(
            (raw: { type: string; detail?: unknown; payload?: unknown }) => {
              if (binding.cleanupRequested || raw.type !== eventName) {
                return
              }
              const snapshot = systemContext.getSystemContextSnapshot?.() ?? raw
              const mergedSnapshot = {
                ...snapshot,
                detail: raw.detail ?? raw.payload,
                payload: raw.payload
              } as unknown as SystemContextSnapshot
              void interactionQueue
                .run(() => executionRegistry.execute(eventName, mergedSnapshot))
                .catch(console.error)
            }
          )

        if (binding.cleanupRequested) {
          subscription.unsubscribe()
          return
        }
        binding.subscription = subscription
      })
      .catch(console.error)
    return
  }

  const manager = sessionManager
  const inputCallback: InputCallback = async (raw) => {
    await manager.runAfterCancellingActiveSessions(
      () => createInputSnapshot(systemContext, raw),
      (mergedSnapshot) => executionRegistry.execute(eventName, mergedSnapshot),
      eventName
    )
  }
  inputSystem.on(eventName, inputCallback)
  eventBindings.set(eventName, {
    eventName,
    participantType: 'execution',
    inputSystem,
    inputCallback,
    cleanupRequested: false
  })
}

function registerFeatureHandlers(
  name: string,
  keyConfig: FeatureKeyMap,
  definition: FeatureDefinition
) {
  const hasSession = !!definition.session
  const hasExecution = !!definition.execution
  const {
    priority = 0,
    exclusive = true,
    cancelPolicy = 'commit-current'
  } = definition

  if (!keyConfig) {
    return
  }

  let eventsToRegister: string[] = []

  if (hasSession) {
    const baseEvent = keyConfig
    eventsToRegister = [
      `${baseEvent}.start`,
      `${baseEvent}.update`,
      `${baseEvent}.end`
    ]
  } else if (hasExecution) {
    eventsToRegister = [keyConfig]
  } else {
    eventsToRegister = [keyConfig]
  }

  if (hasSession && definition.session) {
    sessionManager.registerSession(
      keyConfig,
      name,
      priority,
      exclusive,
      cancelPolicy,
      definition.session
    )
  }

  if (hasExecution && definition.execution) {
    for (const eventName of eventsToRegister) {
      executionRegistry.register(
        eventName,
        name,
        { priority, exclusive },
        definition.execution
      )
    }
  }

  const { inputSystem, systemContext } = corePackages
  if (inputSystem && systemContext) {
    for (const event of eventsToRegister) {
      if (hasSession) {
        if (event.startsWith('render.')) {
          continue
        }
        registerSessionEventBinding(
          event,
          keyConfig,
          inputSystem,
          systemContext
        )
      } else if (hasExecution) {
        registerExecutionEventBinding(event, inputSystem, systemContext)
      }
    }
  }
}

export function defineFeature<
  API extends Record<string, unknown> = Record<string, unknown>,
  State extends Record<string, unknown> = Record<string, unknown>,
  TaskInput = unknown,
  TaskResult = unknown
>(
  name: string,
  keyConfig: FeatureKeyMap | undefined,
  definition: FeatureDefinition<API, State, TaskInput, TaskResult>
): { api: FeatureAPI<API>; dispose: () => boolean } {
  assertRuntimeOpen()
  const identity = runtimeIdentity
  if (
    definition.session &&
    definition.cancelPolicy === 'feature-defined' &&
    !definition.session.onCancel
  ) {
    throw new Error(
      `Feature ${name} uses feature-defined cancelPolicy without onCancel`
    )
  }

  const api = featureRegistry.register(
    name,
    definition as FeatureDefinition<Record<string, unknown>>
  )

  if (definition.task) {
    featureTaskRegistry.register(name, {
      priority: definition.priority ?? 0,
      exclusive: definition.exclusive ?? true,
      handler: definition.task as FeatureTaskHandler
    })
  }

  const hasSession = !!definition.session
  const hasExecution = !!definition.execution

  if ((hasSession || hasExecution) && keyConfig !== undefined) {
    if (isPackagesSet) {
      registerFeatureHandlers(
        name,
        keyConfig,
        definition as FeatureDefinition<Record<string, unknown>>
      )
    } else {
      pendingRegistrations.push({
        featureName: name,
        keyConfig,
        definition: definition as FeatureDefinition<
          Record<string, unknown>,
          Record<string, unknown>
        >
      })
    }
  }

  return {
    api,
    dispose: () => identity === runtimeIdentity && unregisterFeature(name)
  } as { api: FeatureAPI<API>; dispose: () => boolean }
}

export function setCorePackages(packages: CorePackages) {
  assertRuntimeOpen()
  corePackages = packages
  isPackagesSet = true

  for (const registration of pendingRegistrations) {
    try {
      registerFeatureHandlers(
        registration.featureName,
        registration.keyConfig,
        registration.definition
      )
    } catch (error) {
      console.error(
        `[defineFeature] Failed to register "${registration.featureName}":`,
        error
      )
    }
  }
  pendingRegistrations.length = 0
}

export function getFeature(featureName: string): FeatureAPI {
  if (!featureRegistry.has(featureName)) {
    throw new Error(`Feature "${featureName}" not found`)
  }
  return featureRegistry.getAPI(featureName)
}

export function unregisterFeature(featureName: string): boolean {
  if (!featureRegistry.has(featureName)) {
    return false
  }
  if (
    executionRegistry.isFeatureActive(featureName) ||
    sessionManager.isFeatureActive(featureName) ||
    featureTaskRegistry.isActive(featureName)
  ) {
    throw new FeatureUnregisterError(featureName)
  }

  for (let index = pendingRegistrations.length - 1; index >= 0; index -= 1) {
    if (pendingRegistrations[index].featureName === featureName) {
      pendingRegistrations.splice(index, 1)
    }
  }
  executionRegistry.unregisterFeature(featureName)
  sessionManager.unregisterFeature(featureName)
  featureTaskRegistry.unregister(featureName)
  const removed = featureRegistry.unregister(featureName)
  cleanupUnusedEventBindings()
  return removed
}

export function getFeatureRegistry(): FeatureRegistry {
  return featureRegistry
}

export function getSessionManager(): SessionManager {
  return sessionManager
}

export function invokeFeatureTask<Input, Result>(
  featureName: string,
  input: Input,
  options?: InvokeFeatureTaskOptions
): Promise<Result> {
  if (runtimeState !== 'open')
    return Promise.reject(new FeatureRuntimeClosedError())
  return featureTaskRegistry.invoke<Input, Result>(featureName, input, options)
}

export function cancelFeatureTask(
  featureName: string,
  reason?: unknown
): boolean {
  return featureTaskRegistry.cancel(featureName, reason)
}

/** Core lifecycle boundary, not a user-command or ordinary cancel path. */
export function disposeFeatureSystem(
  getSnapshot: () => SystemContextSnapshot
): Promise<void> {
  if (disposal) return disposal
  let complete!: () => void
  let fail!: (error: unknown) => void
  disposal = new Promise<void>((resolve, reject) => {
    complete = resolve
    fail = reject
  })
  runtimeState = 'closing'
  const draining = interactionQueue.close()
  SessionManager.abortRuntime()
  const tasks = featureTaskRegistry.dispose()
  // The shared completion is installed before abort/off can reenter disposal.
  void (async () => {
    const errors: unknown[] = []
    for (const eventName of [...eventBindings.keys()]) {
      try {
        removeEventBinding(eventName)
      } catch (error) {
        errors.push(error)
      }
    }
    await draining
    try {
      await SessionManager.disposeRuntime(getSnapshot)
    } catch (error) {
      errors.push(error)
    }
    await tasks
    for (const name of featureRegistry.getFeatureNames()) {
      try {
        unregisterFeature(name)
      } catch (error) {
        errors.push(error)
      }
    }
    pendingRegistrations.length = 0
    corePackages = {}
    isPackagesSet = false
    if (errors.length > 0) {
      throw errors[0]
    }
    runtimeState = 'closed'
  })().then(complete, (error) => {
    runtimeState = 'failed'
    fail(error)
  })
  return disposal
}

/** Core calls this only after every old runtime owner has completed cleanup. */
export function beginFeatureSystemRuntime(): void {
  if (runtimeState !== 'closed') throw new FeatureRuntimeClosedError()
  interactionQueue.beginRuntime()
  featureTaskRegistry.beginRuntime()
  sessionManager = new SessionManager()
  runtimeIdentity = Symbol('feature-runtime')
  disposal = null
  runtimeState = 'open'
}

export { FeatureRegistry } from './feature-registry.js'
export { SessionManager } from './session-manager.js'
