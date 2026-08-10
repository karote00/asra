/**
 * Executable workspace example.
 *
 * Run with:
 * yarn workspace @asyra/ai-agent-runtime example:ai-agent-runtime
 *
 * The deterministic provider stands in for any AiProvider implementation.
 * It requires no endpoint, network request, or API key.
 */
import { createAiAgentRuntime } from '@asyra/ai-agent-runtime'

import {
  assertExampleResult,
  definePublicExample
} from './example-contract.mjs'

export const exampleDefinition = definePublicExample({
  id: 'ai-registered-action',
  title: 'Execute one prepared action through a registered boundary',
  objective:
    'Compose a deterministic replaceable provider, permission policy, action catalog, and transaction runner without credentials or network access.',
  publicPackages: ['@asyra/ai-agent-runtime'],
  environment:
    'Supported browser composition with Node.js artifact verification',
  runCommand: 'yarn examples:run ai-registered-action',
  sourceRegion: 'example',
  expectedResult:
    'One schema-backed visibility action commits once and preserves prepared argument identity.',
  ownership: {
    framework:
      'AI Runtime owns orchestration, validation, permission, and transaction sequencing.',
    preset: 'Not composed in this example.',
    app: 'Owns provider behavior, action schema, permissions, and visibility meaning.'
  }
})

const SET_VISIBILITY = 'set_visibility'

// #region example
export const createExampleAiRuntime = () => {
  const state = {
    visible: true
  }
  const transactionEvidence = {
    commits: 0,
    rollbacks: 0
  }
  const providerInputs = []
  const serverArguments = {
    visible: false
  }

  const runtime = createAiAgentRuntime({
    provider: {
      requestActionBatch: async (input) => {
        providerInputs.push(input)
        return {
          batchId: 'example-batch',
          explanation: 'Apply one registered action.',
          actions: [
            {
              arguments: serverArguments,
              id: 'visibility-1',
              name: SET_VISIBILITY,
              summary: {
                affectedCount: 1,
                kind: 'visibility'
              }
            }
          ]
        }
      }
    },
    actionDefinitions: [
      {
        name: SET_VISIBILITY,
        description: 'Set example visibility.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['visible'],
          properties: {
            visible: {
              type: 'boolean'
            }
          }
        },
        execute: async (args) => {
          if (args !== serverArguments) {
            throw new Error('Runtime replaced the server-prepared arguments.')
          }
          const { visible } = args
          state.visible = visible
          return {
            visible
          }
        }
      }
    ],
    contextProvider: {
      getContext: async () => ({
        currentVisibility: state.visible
      })
    },
    permissionPolicy: {
      evaluate: async ({ action }) => {
        if (action.arguments !== serverArguments) {
          throw new Error('Permission received different action arguments.')
        }
        return 'allow'
      }
    },
    confirmationHandler: {
      confirm: async () => false
    },
    transactionRunner: {
      run: async (_label, execute) => {
        try {
          const result = await execute()
          transactionEvidence.commits += 1
          return result
        } catch (error) {
          transactionEvidence.rollbacks += 1
          throw error
        }
      }
    }
  })

  return Object.freeze({
    dispose: () => runtime.dispose(),
    getEvidence: () => ({
      providerInputs: [...providerInputs],
      transaction: {
        ...transactionEvidence
      },
      visible: state.visible
    }),
    run: (intent = 'hide the example') =>
      runtime.run({
        intent,
        signal: new AbortController().signal
      })
  })
}
// #endregion example

export const runExample = async () => {
  const example = createExampleAiRuntime()
  try {
    const outcome = await example.run()
    const evidence = example.getEvidence()
    assertExampleResult(outcome.status === 'executed', 'action executes')
    assertExampleResult(
      evidence.transaction.commits === 1 &&
        evidence.transaction.rollbacks === 0,
      'the transaction commits exactly once'
    )
    assertExampleResult(evidence.visible === false, 'visibility is updated')
    return Object.freeze({
      batchId: outcome.batchId,
      status: outcome.status,
      transaction: evidence.transaction,
      visible: evidence.visible
    })
  } finally {
    await example.dispose()
  }
}
