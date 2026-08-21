import { createAiAgentRuntime } from '@asyra/ai-agent-runtime'
import {
  createCollaboration,
  MemoryHub,
  MemoryProvider
} from '@asyra/collaboration'
import factory, { Factory, LocalSharedDataChannel } from '@asyra/factory'
import { defineFeature, SessionManager } from '@asyra/feature-system'
import systemContext from '@asyra/system-context'
import { getAtlasCase } from './case-definitions.mjs'

let runSequence = 0

const createRunId = () => {
  runSequence += 1
  const runtimeId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`
  return `atlas-run-${runtimeId}-${runSequence}`
}

const detached = (value) =>
  typeof globalThis.structuredClone === 'function'
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value))

const valuePayload = (event) => {
  const payload = event?.payload
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.before !== 'number' ||
    typeof payload.after !== 'number'
  ) {
    throw new Error('Invalid Atlas value payload')
  }
  return payload
}

const registerValueReplay = (owner, eventName, state) => {
  owner.registerTransactionInverter(eventName, (event) => {
    const payload = valuePayload(event)
    return {
      ...event,
      payload: { before: payload.after, after: payload.before }
    }
  })
  return owner.registerTransactionReplayHandler(eventName, (event) => {
    state.value = valuePayload(event).after
    return true
  })
}

const updateValue = (owner, eventName, state, after, options = {}) => {
  owner.updateTransaction({
    type: 'updateTransaction',
    eventName,
    payload: { before: state.value, after },
    options: {
      rollbackable: true,
      undoable: true,
      ...options
    }
  })
  state.value = after
}

const createContinuousPointerCase = () => {
  const state = { value: 0, undoValue: 0, redoValue: 0 }
  const sessions = new SessionManager()
  const eventName = 'atlas:pointer-value'
  let disposeReplay = () => undefined

  return {
    expectedStatus: 'succeeded',
    async execute(actionId) {
      if (actionId === 'compose') {
        disposeReplay = registerValueReplay(factory, eventName, state)
        sessions.registerSession(
          'atlas:pointer',
          'atlas:value-feature',
          100,
          true,
          'rollback',
          {
            onStart: () => ({ initialValue: state.value }),
            onUpdate: (snapshot) =>
              updateValue(factory, eventName, state, snapshot.detail.nextValue),
            onEnd: () => undefined,
            onCancel: () => 'rollback'
          }
        )
        return { registered: true, canonicalValue: state.value }
      }
      if (actionId === 'start') {
        const accepted = await sessions.handleStart('atlas:pointer', {})
        return { accepted, transaction: 'open' }
      }
      if (actionId.startsWith('update-')) {
        const nextValue = Number(actionId.slice('update-'.length))
        await sessions.handleUpdate('atlas:pointer', {
          detail: { nextValue }
        })
        return { canonicalValue: state.value, transaction: 'open' }
      }
      if (actionId === 'commit') {
        await sessions.handleEnd('atlas:pointer', {})
        return {
          canonicalValue: state.value,
          transaction: 'committed',
          undoDepth: factory.getUndoHistoryDepth()
        }
      }
      if (actionId === 'undo') {
        factory.undo()
        state.undoValue = state.value
        return { canonicalValue: state.value, replay: 'undo' }
      }
      factory.redo()
      state.redoValue = state.value
      return { canonicalValue: state.value, replay: 'redo' }
    },
    result: () => ({
      canonicalValue: state.value,
      undoDepth: factory.getUndoHistoryDepth(),
      undoValue: state.undoValue,
      redoValue: state.redoValue
    }),
    dispose: async () => {
      disposeReplay()
      sessions.clearAll()
    }
  }
}

const createProjectionCase = () => {
  const key = 'atlas:inspection-record'
  const eventName = 'atlas:approve-record'
  let feature
  let projections = {}
  let disposeReplay = () => undefined

  const canonical = () => systemContext.getSystemContextSnapshot()[key]

  return {
    expectedStatus: 'succeeded',
    async execute(actionId) {
      if (actionId === 'register-model') {
        systemContext.registerProperty(
          key,
          { id: 'record-a', label: 'Cooling audit', status: 'open' },
          {
            runtime: false,
            validate: (value) =>
              Boolean(
                value &&
                  typeof value === 'object' &&
                  typeof value.id === 'string' &&
                  (value.status === 'open' || value.status === 'approved')
              )
          }
        )
        disposeReplay = factory.registerTransactionReplayHandler(
          eventName,
          (event) => {
            systemContext.setManagedProperty(key, event.payload.after)
            return true
          }
        )
        factory.registerTransactionInverter(eventName, (event) => ({
          ...event,
          payload: { before: event.payload.after, after: event.payload.before }
        }))
        return { canonical: canonical() }
      }
      if (actionId === 'register-action') {
        feature = defineFeature('atlas:record-approval', undefined, {
          priority: 100,
          exclusive: true,
          api: {
            approve() {
              const before = canonical()
              const after = { ...before, status: 'approved' }
              factory.startTransaction()
              factory.updateTransaction({
                type: 'updateTransaction',
                eventName,
                payload: { before, after },
                options: { rollbackable: true, undoable: true }
              })
              systemContext.setManagedProperty(key, after)
              factory.endTransaction()
            }
          }
        })
        return { feature: 'atlas:record-approval', registered: true }
      }
      if (actionId === 'approve') {
        feature.api.approve()
        return {
          canonical: canonical(),
          undoDepth: factory.getUndoHistoryDepth()
        }
      }
      const snapshot = detached(canonical())
      projections = {
        canvas: { badge: snapshot.status, label: snapshot.label },
        hierarchy: { id: snapshot.id, childCount: 0 },
        properties: { status: snapshot.status },
        serialization: JSON.stringify(snapshot)
      }
      return { canonical: snapshot, projections }
    },
    result: () => ({ canonical: detached(canonical()), projections }),
    dispose: async () => {
      feature?.dispose()
      disposeReplay()
      systemContext.unregisterProperty(key)
    }
  }
}

const createRollbackCase = () => {
  const state = { value: 5, failure: '' }
  const sessions = new SessionManager()
  const eventName = 'atlas:validated-value'
  let disposeReplay = () => undefined

  return {
    expectedStatus: 'rejected',
    async execute(actionId) {
      if (actionId === 'compose') {
        disposeReplay = registerValueReplay(factory, eventName, state)
        sessions.registerSession(
          'atlas:validated-edit',
          'atlas:validation-feature',
          100,
          true,
          'rollback',
          {
            onStart: () => ({ initialValue: state.value }),
            onUpdate: (snapshot) => {
              const nextValue = snapshot.detail.nextValue
              if (nextValue < 0) {
                throw new Error('Value must be greater than or equal to zero')
              }
              updateValue(factory, eventName, state, nextValue)
            },
            onCancel: () => 'rollback'
          }
        )
        return { registered: true, canonicalValue: state.value }
      }
      if (actionId === 'start') {
        await sessions.handleStart('atlas:validated-edit', {})
        return { transaction: 'open', canonicalValue: state.value }
      }
      if (actionId === 'preview') {
        await sessions.handleUpdate('atlas:validated-edit', {
          detail: { nextValue: 8 }
        })
        return { transaction: 'open', canonicalValue: state.value }
      }
      try {
        await sessions.handleUpdate('atlas:validated-edit', {
          detail: { nextValue: -1 }
        })
      } catch (error) {
        state.failure = error instanceof Error ? error.message : String(error)
      }
      return {
        lifecycleStatus: 'rejected',
        canonicalValue: state.value,
        undoDepth: factory.getUndoHistoryDepth(),
        failure: state.failure
      }
    },
    result: () => ({
      canonicalValue: state.value,
      undoDepth: factory.getUndoHistoryDepth(),
      failure: state.failure
    }),
    dispose: async () => {
      disposeReplay()
      sessions.clearAll()
    }
  }
}

const deliveriesOf = (publication) =>
  publication.slices.flatMap((slice) =>
    slice.batches.flatMap((batch) => batch.deliveries)
  )

const createCollaborationCase = () => {
  const eventName = 'atlas:collaborative-value'
  const channelName = 'atlas-document'
  const stateA = { value: 0 }
  const stateB = { value: 0 }
  const ownerA = new Factory()
  const ownerB = new Factory()
  const hub = new MemoryHub()
  let actorA
  let actorB
  let remotePresence

  return {
    expectedStatus: 'succeeded',
    async execute(actionId) {
      if (actionId === 'compose') {
        ownerA.registerSharedDataChannel(
          channelName,
          new LocalSharedDataChannel()
        )
        registerValueReplay(ownerA, eventName, stateA)
        registerValueReplay(ownerB, eventName, stateB)
        actorA = createCollaboration({
          documentId: 'atlas-document',
          roomId: 'atlas-room',
          actorId: 'actor-a',
          provider: new MemoryProvider(hub, {
            documentId: 'atlas-document',
            roomId: 'atlas-room',
            actorId: 'actor-a'
          }),
          publicationSource: {
            subscribe: (subscriber) =>
              ownerA.subscribeToSharedPublication(subscriber)
          },
          processRemotePublication: () => undefined,
          resourceOwnership: { provider: 'owned' }
        })
        actorB = createCollaboration({
          documentId: 'atlas-document',
          roomId: 'atlas-room',
          actorId: 'actor-b',
          provider: new MemoryProvider(hub, {
            documentId: 'atlas-document',
            roomId: 'atlas-room',
            actorId: 'actor-b'
          }),
          processRemotePublication: (publication) => {
            ownerB.runRemoteTransaction(() => {
              deliveriesOf(publication).forEach((delivery) => {
                const payload = valuePayload(delivery)
                ownerB.updateTransaction({
                  type: 'updateTransaction',
                  eventName,
                  payload,
                  options: { rollbackable: true, undoable: false }
                })
                stateB.value = payload.after
              })
            })
          },
          resourceOwnership: { provider: 'owned' }
        })
        return { actors: ['actor-a', 'actor-b'], provider: 'MemoryProvider' }
      }
      if (actionId === 'connect') {
        await Promise.all([actorA.start(), actorB.start()])
        return { connected: true, durable: false }
      }
      if (actionId === 'presence') {
        await actorA.updateAwareness({ tool: 'value-edit' })
        remotePresence = actorB.awareness.getRemote('actor-a')
        return {
          presence: remotePresence?.state.tool,
          canonical: false
        }
      }
      if (actionId === 'publish') {
        ownerA.startTransaction()
        updateValue(ownerA, eventName, stateA, 7, {
          shared: channelName,
          sharedDelivery: 'immediate'
        })
        ownerA.endTransaction()
        await Promise.all([actorA.whenIdle(), actorB.whenIdle()])
        return { actorA: stateA.value, publication: 'completed' }
      }
      await Promise.all([actorA.whenIdle(), actorB.whenIdle()])
      return { actorA: stateA.value, actorB: stateB.value, converged: true }
    },
    result: () => ({
      actorA: stateA.value,
      actorB: stateB.value,
      durable: false,
      awarenessCanonical: false,
      presence: remotePresence?.state.tool ?? null
    }),
    dispose: async () => {
      await Promise.all([actorA?.dispose(), actorB?.dispose()])
    }
  }
}

const createAiCase = () => {
  let visible = true
  let transactionCount = 0
  let feature
  let runtime
  let runtimeResult

  return {
    expectedStatus: 'succeeded',
    async execute(actionId) {
      if (actionId === 'register') {
        feature = defineFeature('atlas:visibility', undefined, {
          priority: 100,
          exclusive: true,
          api: {
            setVisible(nextVisible) {
              visible = nextVisible
              return visible
            }
          }
        })
        return { action: 'set_visibility', registered: true }
      }
      if (actionId === 'prepare') {
        runtime = createAiAgentRuntime({
          provider: {
            requestActionBatch: async () => ({
              batchId: 'atlas-visibility-batch',
              actions: [
                {
                  id: 'visibility-1',
                  name: 'set_visibility',
                  arguments: { visible: false },
                  summary: { outcome: 'Hide the selected record' }
                }
              ]
            })
          },
          actionDefinitions: [
            {
              name: 'set_visibility',
              description: 'Set the selected record visibility.',
              inputSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['visible'],
                properties: { visible: { type: 'boolean' } }
              },
              execute: async ({ visible: nextVisible }) => ({
                visible: feature.api.setVisible(nextVisible)
              })
            }
          ],
          contextProvider: {
            getContext: async () => ({ selectedIds: ['record-a'] })
          },
          permissionPolicy: {
            evaluate: async ({ action }) =>
              action.name === 'set_visibility' ? 'allow' : 'deny'
          },
          confirmationHandler: { confirm: async () => true },
          transactionRunner: {
            run: async (_label, execute) => {
              transactionCount += 1
              return execute()
            }
          }
        })
        return {
          providerKind: 'deterministic-app-provider',
          preparedActions: 1
        }
      }
      if (actionId === 'permit') {
        return { policy: 'allow registered set_visibility only' }
      }
      runtimeResult = await runtime.run({
        intent: 'Hide the selected record',
        signal: new globalThis.AbortController().signal
      })
      return {
        runtimeStatus: runtimeResult.status,
        visible,
        transactionCount
      }
    },
    result: () => ({
      visible,
      transactionCount,
      providerKind: 'deterministic-app-provider',
      runtimeStatus: runtimeResult?.status ?? 'not-run'
    }),
    dispose: async () => {
      await runtime?.dispose()
      feature?.dispose()
    }
  }
}

const createRetrievalCase = () => {
  const key = 'atlas:records'
  let feature
  let matches = []
  let retrievalChangedCanonical = false
  const initialRecords = {
    'record-a': { label: 'Cooling audit', status: 'open' },
    'record-b': { label: 'Safety review', status: 'open' }
  }
  const records = () => detached(systemContext.getSystemContextSnapshot()[key])

  return {
    expectedStatus: 'succeeded',
    async execute(actionId) {
      if (actionId === 'register-model') {
        systemContext.registerProperty(key, initialRecords, {
          runtime: false,
          validate: (value) => Boolean(value && typeof value === 'object')
        })
        return { records: records() }
      }
      if (actionId === 'register-action') {
        feature = defineFeature('atlas:record-actions', undefined, {
          priority: 100,
          exclusive: true,
          api: {
            setStatus(recordId, status) {
              const current = records()
              if (!current[recordId])
                throw new Error(`Unknown record: ${recordId}`)
              systemContext.setManagedProperty(key, {
                ...current,
                [recordId]: { ...current[recordId], status }
              })
            }
          }
        })
        return { feature: 'atlas:record-actions', registered: true }
      }
      if (actionId === 'retrieve') {
        const before = JSON.stringify(records())
        matches = Object.entries(records())
          .filter(([, record]) => record.label.toLowerCase().includes('safety'))
          .map(([id, record]) => ({ id, ...record }))
        const after = JSON.stringify(records())
        retrievalChangedCanonical = before !== after
        return { matches, retrievalChangedCanonical }
      }
      if (actionId === 'act') {
        feature.api.setStatus(matches[0].id, 'approved')
        return { records: records(), owner: 'registered Feature API' }
      }
      return {
        runtimeBoundary: 'browser/Core composition',
        headless: 'Roadmap, not a current API'
      }
    },
    result: () => ({
      matches,
      retrievalChangedCanonical,
      records: records(),
      runtimeBoundary: 'browser/Core composition'
    }),
    dispose: async () => {
      feature?.dispose()
      systemContext.unregisterProperty(key)
    }
  }
}

const builders = {
  'continuous-pointer-undo': createContinuousPointerCase,
  'canonical-projection-fanout': createProjectionCase,
  'invalid-input-rollback': createRollbackCase,
  'collaboration-two-actors': createCollaborationCase,
  'ai-registered-action': createAiCase,
  'machine-retrieval-action': createRetrievalCase
}

const snapshot = (run) => ({
  caseId: run.definition.id,
  runId: run.runId,
  sequence: run.sequence,
  status: run.status,
  actionIndex: run.actionIndex,
  actionCount: run.definition.actions.length,
  evidence: detached(run.evidence),
  result: detached(run.runtime.result())
})

export const createAtlasRun = async (caseId) => {
  const definition = getAtlasCase(caseId)
  const build = builders[caseId]
  if (!definition || !build)
    throw new Error(`Unknown Runtime Atlas case: ${caseId}`)
  const run = {
    definition,
    runId: createRunId(),
    sequence: 0,
    actionIndex: 0,
    status: 'ready',
    evidence: [],
    runtime: build()
  }
  return run
}

export const getAtlasRunSnapshot = (run) => snapshot(run)

export const advanceAtlasRun = async (run) => {
  const action = run.definition.actions[run.actionIndex]
  if (!action || ['succeeded', 'rejected', 'failed'].includes(run.status)) {
    return snapshot(run)
  }

  run.status = 'running'
  run.sequence += 1
  try {
    const output = await run.runtime.execute(action.id)
    run.actionIndex += 1
    const isComplete = run.actionIndex === run.definition.actions.length
    if (isComplete) run.status = run.runtime.expectedStatus
    run.evidence.push({
      caseId: run.definition.id,
      runId: run.runId,
      sequence: run.sequence,
      actionId: action.id,
      label: action.label,
      owner: action.owner,
      description: action.description,
      lifecycleStatus:
        output?.lifecycleStatus ?? (isComplete ? run.status : 'accepted'),
      output: detached(output ?? null)
    })
  } catch (error) {
    run.status = 'failed'
    run.evidence.push({
      caseId: run.definition.id,
      runId: run.runId,
      sequence: run.sequence,
      actionId: action.id,
      label: action.label,
      owner: action.owner,
      description: action.description,
      lifecycleStatus: 'failed',
      output: null,
      failure: error instanceof Error ? error.message : String(error)
    })
  }
  return snapshot(run)
}

export const disposeAtlasRun = async (run) => {
  await run.runtime.dispose()
}

export const runCaseToCompletion = async (caseId) => {
  const run = await createAtlasRun(caseId)
  try {
    while (
      run.actionIndex < run.definition.actions.length &&
      run.status !== 'failed'
    ) {
      await advanceAtlasRun(run)
    }
    return snapshot(run)
  } finally {
    await disposeAtlasRun(run)
  }
}
