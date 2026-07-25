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

  const runtime = createAiAgentRuntime({
    provider: {
      generateActionPlan: async (input) => {
        providerInputs.push(input)
        return {
          planId: 'example-plan',
          explanation: 'Apply one registered action.',
          actions: [
            {
              id: 'visibility-1',
              name: SET_VISIBILITY,
              arguments: {
                visible: false
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
        schema: {
          providerSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['visible'],
            properties: {
              visible: {
                type: 'boolean'
              }
            }
          },
          parse: (value) => {
            if (
              value &&
              typeof value === 'object' &&
              Reflect.ownKeys(value).length === 1 &&
              typeof value.visible === 'boolean'
            ) {
              return {
                success: true,
                value: {
                  visible: value.visible
                }
              }
            }
            return {
              success: false,
              issues: [
                {
                  code: 'invalid_visibility',
                  message: 'visible must be a boolean',
                  path: ['visible']
                }
              ]
            }
          }
        },
        execute: async ({ visible }) => {
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
      evaluate: async () => 'allow'
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
