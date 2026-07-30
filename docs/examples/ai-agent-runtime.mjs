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

const SET_VISIBILITY = 'set_visibility'

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
