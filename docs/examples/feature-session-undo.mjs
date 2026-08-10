import factory from '@asyra/factory'
import { SessionManager } from '@asyra/feature-system'

import {
  assertExampleResult,
  definePublicExample
} from './example-contract.mjs'

const EVENT = 'example:session-set-value'
const FEATURE = 'example:value-drag'
const SESSION = 'example:value-drag-session'

export const exampleDefinition = definePublicExample({
  id: 'feature-session-undo',
  title: 'Commit one session as one Undo unit',
  objective:
    'Run explicit start/update/end and prove that handler failure rolls back without adding history.',
  publicPackages: ['@asyra/factory', '@asyra/feature-system'],
  environment:
    'Supported browser interaction composition with Node.js artifact verification',
  runCommand: 'yarn examples:run feature-session-undo',
  sourceRegion: 'example',
  expectedResult:
    'A successful session commits one undoable value, Undo/Redo replay it, and a failing session restores the last commit.',
  ownership: {
    framework:
      'Feature System owns session ordering; Factory owns commit, rollback, and history replay.',
    preset: 'Not composed in this example.',
    app: 'Owns the value mutation API and chooses rollback cancellation policy.'
  }
})

const recordValue = (state, after) => {
  factory.updateTransaction({
    type: 'updateTransaction',
    eventName: EVENT,
    payload: { before: state.value, after },
    options: { rollbackable: true, undoable: true }
  })
  state.value = after
}

// #region example
export const runFeatureSessionUndoExample = async () => {
  const state = { value: 0 }
  factory.registerTransactionInverter(EVENT, (event) => ({
    type: event.type,
    payload: {
      before: event.payload.after,
      after: event.payload.before
    }
  }))
  const stopReplay = factory.registerTransactionReplayHandler(
    EVENT,
    (event) => {
      state.value = event.payload.after
      return true
    }
  )
  const sessions = new SessionManager()
  sessions.registerSession(SESSION, FEATURE, 100, true, 'rollback', {
    onStart: () => ({ startedAt: state.value }),
    onUpdate: (snapshot) => {
      recordValue(state, snapshot.nextValue)
      if (snapshot.fail === true) {
        throw new Error('app mutation rejected')
      }
    },
    onEnd: () => undefined,
    onCancel: () => 'rollback'
  })

  try {
    await sessions.handleStart(SESSION, {})
    await sessions.handleUpdate(SESSION, { nextValue: 5 })
    await sessions.handleEnd(SESSION, {})
    const committedDepth = factory.getUndoHistoryDepth()
    factory.undo()
    const undone = state.value
    factory.redo()
    const redone = state.value

    await sessions.handleStart(SESSION, {})
    let rollbackError
    try {
      await sessions.handleUpdate(SESSION, { fail: true, nextValue: 9 })
    } catch (error) {
      rollbackError = error
    }
    const result = {
      committedDepth,
      rollbackDepth: factory.getUndoHistoryDepth(),
      rollbackError: rollbackError?.message,
      rolledBackValue: state.value,
      undone,
      redone
    }

    assertExampleResult(committedDepth === 1, 'session creates one Undo unit')
    assertExampleResult(undone === 0, 'Undo restores the starting value')
    assertExampleResult(redone === 5, 'Redo restores the committed value')
    assertExampleResult(
      result.rolledBackValue === 5,
      'failed update rolls back completely'
    )
    assertExampleResult(
      result.rollbackDepth === 1,
      'rollback adds no history entry'
    )
    return Object.freeze(result)
  } finally {
    sessions.unregisterSession(SESSION, FEATURE)
    stopReplay()
  }
}
// #endregion example

export const runExample = runFeatureSessionUndoExample
