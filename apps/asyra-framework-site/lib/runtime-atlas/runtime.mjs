import { getAtlasCase } from './case-definitions.mjs'

let fallbackRunSequence = 0

const createRunId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  fallbackRunSequence += 1
  return `atlas-run-${fallbackRunSequence}`
}

const detach = (value) => {
  if (value === undefined) {
    return undefined
  }
  return structuredClone(value)
}

const toFailure = (error) => ({
  message: error instanceof Error ? error.message : String(error),
  name: error instanceof Error ? error.name : 'UnknownError'
})

export class AtlasRuntimeUnavailableError extends Error {
  constructor(caseId) {
    super(`Runtime Atlas case is not installed: ${caseId}`)
    this.name = 'AtlasRuntimeUnavailableError'
  }
}

export const createAtlasRuntimeHarness = ({ caseId, createExecutor }) => {
  const definition = getAtlasCase(caseId)
  const runId = createRunId()
  const executor = createExecutor(definition)
  const evidence = []
  let sequence = 0
  let actionIndex = 0
  let terminal = false
  let disposed = false

  const snapshot = () =>
    Object.freeze({
      actionIndex,
      caseId,
      complete: terminal && evidence.at(-1)?.status !== 'failed',
      definition,
      disposed,
      evidence: Object.freeze(evidence.map((entry) => detach(entry))),
      runId,
      sequence,
      terminal
    })

  const advance = async () => {
    if (disposed) {
      throw new Error('Runtime Atlas run is disposed')
    }
    if (terminal) {
      return snapshot()
    }

    const action = definition.actions[actionIndex]
    if (!action) {
      terminal = true
      return snapshot()
    }

    sequence += 1
    try {
      const result = await executor.advance(action.id, detach(action.input))
      const isFinal = actionIndex === definition.actions.length - 1
      evidence.push(
        Object.freeze({
          actionId: action.id,
          bypasses: definition.bypasses,
          caseId,
          conditions: definition.conditions,
          input: detach(action.input),
          label: action.label,
          output: detach(result?.output),
          owner: action.owner,
          runId,
          sequence,
          status: result?.status ?? 'completed'
        })
      )
      actionIndex += 1
      terminal = isFinal
      return snapshot()
    } catch (error) {
      evidence.push(
        Object.freeze({
          actionId: action.id,
          bypasses: definition.bypasses,
          caseId,
          conditions: definition.conditions,
          failure: toFailure(error),
          input: detach(action.input),
          label: action.label,
          owner: action.owner,
          runId,
          sequence,
          status: 'failed'
        })
      )
      terminal = true
      return snapshot()
    }
  }

  const dispose = async () => {
    if (disposed) {
      return
    }
    disposed = true
    await executor.dispose?.()
  }

  return Object.freeze({ advance, dispose, snapshot })
}

export const createAtlasCaseExecutor = (definition) => {
  throw new AtlasRuntimeUnavailableError(definition.id)
}

export const createAtlasRuntime = (caseId) =>
  createAtlasRuntimeHarness({ caseId, createExecutor: createAtlasCaseExecutor })
