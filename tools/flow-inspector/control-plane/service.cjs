/* global AbortController */
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { loadContract } = require('./contracts.cjs')
const { captureSource, safePath } = require('./snapshot.cjs')
const { runVerification } = require('./runner.cjs')
const { assessEvidence } = require('./evidence.cjs')
const { openStore } = require('./store.cjs')

const LOCAL_ACTOR = Object.freeze({
  id: 'local-developer',
  capabilities: Object.freeze(['verify', 'cancel'])
})
class ActionError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const authorize = (actor, capability) => {
  if (!actor || !actor.id || !actor.capabilities?.includes(capability))
    throw new ActionError(403, 'Action is not authorized')
}

function createService(
  repositoryRoot,
  {
    directory = path.join(repositoryRoot, 'tmp/flow-inspector/runs'),
    runner = runVerification,
    capture = captureSource,
    timeoutMs = 30000
  } = {}
) {
  let contract = loadContract(repositoryRoot)
  safePath(repositoryRoot, path.relative(repositoryRoot, directory))
  const store = openStore(directory)
  let active = null
  let closed = false
  const pending = new Map()
  const event = (name) => ({ event: name, at: new Date().toISOString() })
  const update = (id, patch, eventName) => {
    const previous = store.get(id)
    store.save({
      ...previous,
      ...patch,
      audit: [...previous.audit, event(eventName)]
    })
    return store.get(id)
  }
  const publicRecord = (record) => {
    if (!record) throw new ActionError(404, 'Attempt not found')
    const matchesCurrentContract =
      record.snapshot?.contractDigest === contract.digest
    if (matchesCurrentContract && record.phase === 'completed') {
      const expected = contract.cases.filter((item) =>
        record.flowIds.includes(item.flowId)
      )
      const evidence = record.evidence
      const statusFor = (items) => {
        if (items.some((item) => item.status === 'failed')) return 'failed'
        if (
          evidence.issues.length ||
          !items.length ||
          items.some((item) => item.status !== 'passed')
        )
          return 'unknown'
        return 'passed'
      }
      if (
        !expected.length ||
        new Set(record.flowIds).size !== record.flowIds.length ||
        record.flowIds.some(
          (id) => !contract.flows.some((flow) => flow.id === id)
        ) ||
        evidence.expectedCount !== expected.length ||
        evidence.cases.length !== expected.length ||
        expected.some(
          (item) =>
            evidence.cases.filter((observed) =>
              ['id', 'flowId', 'stepId', 'testName'].every(
                (key) => observed[key] === item[key]
              )
            ).length !== 1
        ) ||
        evidence.passedCount !==
          evidence.cases.filter((item) => item.status === 'passed').length ||
        evidence.flows.length !== record.flowIds.length ||
        record.flowIds.some(
          (id) =>
            evidence.flows.filter(
              (flow) =>
                flow.id === id &&
                flow.status ===
                  statusFor(evidence.cases.filter((item) => item.flowId === id))
            ).length !== 1
        ) ||
        evidence.status !== statusFor(evidence.cases)
      )
        throw new ActionError(
          500,
          'Stored evidence inventory disagrees with the current contract'
        )
    }
    return {
      ...record,
      matchesCurrentContract
    }
  }
  return {
    contract: () => contract,
    state() {
      const runs = store
        .list()
        .slice(0, 20)
        .map(publicRecord)
        .map((record) => ({
          id: record.id,
          phase: record.phase,
          scenario: record.scenario,
          flowIds: record.flowIds,
          startedAt: record.startedAt,
          finishedAt: record.finishedAt,
          status: record.evidence?.status ?? 'unknown',
          digest: record.snapshot?.digest ?? null
        }))
      return { contract, activeRunId: active?.id ?? null, runs }
    },
    get: (id) => publicRecord(store.get(id)),
    start(request, actor) {
      authorize(actor, 'verify')
      if (closed) throw new ActionError(409, 'Service is closing')
      if (
        !request ||
        typeof request !== 'object' ||
        Array.isArray(request) ||
        Object.keys(request).some(
          (key) => !['scenario', 'flowIds'].includes(key)
        )
      )
        throw new ActionError(400, 'Invalid verification request')
      const scenario = request.scenario ?? 'baseline'
      if (!['baseline', 'inverse-regression'].includes(scenario))
        throw new ActionError(400, 'Unknown scenario')
      const current = loadContract(repositoryRoot)
      const flowIds = request.flowIds ?? current.flows.map((flow) => flow.id)
      if (
        !Array.isArray(flowIds) ||
        !flowIds.length ||
        flowIds.length > current.flows.length ||
        new Set(flowIds).size !== flowIds.length ||
        flowIds.some((id) => !current.flows.some((flow) => flow.id === id))
      )
        throw new ActionError(
          400,
          'Unknown, duplicate, or empty flow selection'
        )
      if (active) throw new ActionError(409, 'An attempt is already running')
      contract = current
      const id = randomUUID()
      const controller = new AbortController()
      const record = {
        format: 1,
        id,
        actor: actor.id,
        phase: 'running',
        scenario,
        flowIds,
        startedAt: new Date().toISOString(),
        audit: [event('admitted')]
      }
      store.save(record)
      active = { id, controller }
      const completion = Promise.resolve().then(async () => {
        try {
          const runDirectory = path.join(directory, id)
          const snapshot = capture(repositoryRoot, runDirectory, current)
          const identity = Object.fromEntries(
            Object.entries(snapshot).filter(
              ([key]) => !['sourceRoot', 'files'].includes(key)
            )
          )
          update(id, { snapshot: identity }, 'source-captured')
          const result = await runner({
            repositoryRoot,
            runDirectory,
            snapshot,
            contract: current,
            scenario,
            flowIds,
            signal: controller.signal,
            timeoutMs,
            onSpawn: (pid) => update(id, { runnerPid: pid }, 'runner-started')
          })
          const evidence = assessEvidence(current, snapshot, result, flowIds)
          let phase = 'completed'
          if (result.reason === 'cancelled') phase = 'cancelled'
          else if (result.reason === 'timeout') phase = 'timed-out'
          else if (result.reason || result.reportError) phase = 'error'
          update(
            id,
            {
              phase,
              finishedAt: new Date().toISOString(),
              evidence,
              runner: {
                code: result.code,
                reason: result.reason,
                version: result.version,
                output: result.output,
                reportPath: path.relative(
                  repositoryRoot,
                  result.reportPath ?? runDirectory
                )
              },
              artifactDirectory: path.relative(repositoryRoot, runDirectory)
            },
            'runner-settled'
          )
        } catch (error) {
          update(
            id,
            {
              phase: 'error',
              finishedAt: new Date().toISOString(),
              error: error.message
            },
            'attempt-error'
          )
        } finally {
          if (active?.id === id) active = null
        }
        return store.get(id)
      })
      pending.set(id, completion)
      completion.finally(() => pending.delete(id)).catch(() => undefined)
      return id
    },
    async wait(id) {
      if (pending.has(id)) return pending.get(id)
      return publicRecord(store.get(id))
    },
    async cancel(id, actor) {
      authorize(actor, 'cancel')
      if (!active || active.id !== id)
        throw new ActionError(409, 'Attempt is not active')
      update(id, {}, 'cancel-requested')
      active.controller.abort()
      return pending.get(id)
    },
    async close() {
      closed = true
      try {
        if (active) {
          const id = active.id
          active.controller.abort()
          await pending.get(id)
        }
      } finally {
        store.close()
      }
    }
  }
}
module.exports = { createService, LOCAL_ACTOR, ActionError }
