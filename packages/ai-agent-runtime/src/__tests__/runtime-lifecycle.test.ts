import { describe, expect, it, vi } from 'vitest'
import {
  AI_REDACTED_VALUE,
  AiProviderError,
  createAiAgentRuntime,
  type AiActionBatch,
  type AiActionDefinition,
  type AiTransactionRunner,
  type CreateAiAgentRuntimeInput
} from '..'

const visibilityAction = (
  execute = vi.fn(async () => ({
    apiKey: 'executor-secret',
    changed: true
  }))
): AiActionDefinition<{ elementId: string; visible: boolean }> => ({
  name: 'set_element_visibility',
  description: 'Set element visibility.',
  inputSchema: {
    type: 'object'
  },
  execute
})

const candidateActionBatch = () => ({
  batchId: 'batch-1',
  explanation: 'Bearer provider-explanation-secret',
  actions: [
    {
      id: 'action-1',
      name: 'set_element_visibility',
      arguments: {
        elementId: 'shape-1',
        visible: false
      },
      summary: {
        affectedCount: 1,
        actionKind: 'visibility'
      }
    }
  ]
})

interface TransactionEvidence {
  commits: number
  rollbacks: number
  runner: AiTransactionRunner
  run: ReturnType<typeof vi.fn>
}

const transactionEvidence = (): TransactionEvidence => {
  const run = vi.fn()
  const evidence: TransactionEvidence = {
    commits: 0,
    rollbacks: 0,
    run,
    runner: {
      run: async <T>(label: string, execute: () => Promise<T>) => {
        run(label)
        try {
          const result = await execute()
          evidence.commits += 1
          return result
        } catch (error) {
          evidence.rollbacks += 1
          throw error
        }
      }
    }
  }
  return evidence
}

const runtimeInput = (
  overrides: Partial<CreateAiAgentRuntimeInput> = {}
): CreateAiAgentRuntimeInput => ({
  provider: {
    requestActionBatch: vi.fn(async () => candidateActionBatch())
  },
  actionDefinitions: [visibilityAction()],
  contextProvider: {
    getContext: vi.fn(async () => ({
      app: 'test',
      accessToken: 'context-secret'
    }))
  },
  permissionPolicy: {
    evaluate: vi.fn(async () => 'allow' as const)
  },
  confirmationHandler: {
    confirm: vi.fn(async () => true)
  },
  transactionRunner: transactionEvidence().runner,
  ...overrides
})

describe('AI runtime invocation lifecycle', () => {
  it('orchestrates one complete accepted action batch and returns detached terminal output', async () => {
    const transaction = transactionEvidence()
    const execute = vi.fn(async () => ({
      apiKey: 'executor-secret',
      changed: true
    }))
    const input = runtimeInput({
      actionDefinitions: [visibilityAction(execute)],
      transactionRunner: transaction.runner
    })
    const runtime = createAiAgentRuntime(input)
    const signal = new AbortController().signal

    const result = await runtime.run({
      intent: 'hide the selected shape',
      metadata: {
        authorization: 'Bearer request-secret',
        requestId: 'request-1'
      },
      signal
    })

    expect(input.contextProvider.getContext).toHaveBeenCalledWith({
      intent: 'hide the selected shape',
      signal: expect.any(AbortSignal)
    })
    expect(input.provider.requestActionBatch).toHaveBeenCalledWith(
      {
        intent: 'hide the selected shape',
        context: {
          app: 'test',
          accessToken: AI_REDACTED_VALUE
        },
        metadata: {
          authorization: AI_REDACTED_VALUE,
          requestId: 'request-1'
        },
        actions: [
          {
            name: 'set_element_visibility',
            description: 'Set element visibility.',
            inputSchema: {
              type: 'object'
            }
          }
        ],
        attempt: 1
      },
      {
        signal: expect.any(AbortSignal)
      }
    )
    expect(result).toEqual({
      status: 'executed',
      batchId: 'batch-1',
      preview: {
        batchId: 'batch-1',
        explanation: AI_REDACTED_VALUE,
        actions: [
          {
            id: 'action-1',
            name: 'set_element_visibility',
            permission: 'allow',
            summary: {
              affectedCount: 1,
              actionKind: 'visibility'
            }
          }
        ]
      },
      actionResults: [
        {
          actionId: 'action-1',
          actionName: 'set_element_visibility',
          result: {
            apiKey: AI_REDACTED_VALUE,
            changed: true
          }
        }
      ],
      transaction: {
        status: 'committed'
      },
      audit: {
        batchId: 'batch-1',
        outcome: 'executed',
        retryCount: 0,
        explanation: AI_REDACTED_VALUE,
        actions: [
          {
            actionId: 'action-1',
            actionName: 'set_element_visibility',
            result: {
              apiKey: AI_REDACTED_VALUE,
              changed: true
            }
          }
        ]
      }
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(execute).toHaveBeenCalledOnce()
    expect(transaction.run).toHaveBeenCalledOnce()
    expect(transaction.commits).toBe(1)
    expect(transaction.rollbacks).toBe(0)

    await runtime.dispose()
  })

  it('retries only the provider request and never repeats accepted execution', async () => {
    const requestActionBatch = vi
      .fn()
      .mockRejectedValueOnce(
        new AiProviderError({
          code: 'AI_PROVIDER_TRANSPORT_FAILED',
          message: 'Bearer raw-provider-secret',
          retryable: true
        })
      )
      .mockResolvedValueOnce(candidateActionBatch())
    const transaction = transactionEvidence()
    const execute = vi.fn(async () => ({
      changed: true
    }))
    const runtime = createAiAgentRuntime(
      runtimeInput({
        provider: {
          requestActionBatch
        },
        actionDefinitions: [visibilityAction(execute)],
        transactionRunner: transaction.runner,
        options: {
          retryPolicy: {
            maxAttempts: 2
          }
        }
      })
    )

    const result = await runtime.run({
      intent: 'hide the selected shape',
      signal: new AbortController().signal
    })

    expect(
      requestActionBatch.mock.calls.map(([input]) => input.attempt)
    ).toEqual([1, 2])
    expect(result).toMatchObject({
      status: 'executed',
      audit: {
        retryCount: 1
      }
    })
    expect(execute).toHaveBeenCalledOnce()
    expect(transaction.run).toHaveBeenCalledOnce()

    await runtime.dispose()
  })

  it('owns retry callback failures at the provider stage without leaking app errors', async () => {
    const runtime = createAiAgentRuntime(
      runtimeInput({
        provider: {
          requestActionBatch: vi.fn(async () => {
            throw new AiProviderError({
              code: 'AI_PROVIDER_TRANSPORT_FAILED',
              message: 'AI provider transport failed.',
              retryable: true
            })
          })
        },
        options: {
          retryPolicy: {
            maxAttempts: 2,
            shouldRetry: () => {
              throw new Error('Bearer raw-retry-policy-secret')
            }
          }
        }
      })
    )

    const result = await runtime.run({
      intent: 'hide the selected shape',
      signal: new AbortController().signal
    })

    expect(result).toMatchObject({
      status: 'failed',
      code: 'AI_RETRY_POLICY_FAILED',
      message: 'AI provider retry policy failed.',
      stage: 'provider',
      retryCount: 0
    })
    expect(JSON.stringify(result)).not.toContain('raw-retry-policy-secret')

    await runtime.dispose()
  })

  it('returns confirmation cancellation without opening a transaction', async () => {
    const transaction = transactionEvidence()
    const runtime = createAiAgentRuntime(
      runtimeInput({
        permissionPolicy: {
          evaluate: vi.fn(async () => 'confirm' as const)
        },
        confirmationHandler: {
          confirm: vi.fn(async () => false)
        },
        transactionRunner: transaction.runner
      })
    )

    await expect(
      runtime.run({
        intent: 'hide the selected shape',
        signal: new AbortController().signal
      })
    ).resolves.toMatchObject({
      status: 'cancelled',
      reason: 'confirmation-cancelled',
      audit: {
        outcome: 'cancelled',
        batchId: 'batch-1'
      }
    })
    expect(transaction.run).not.toHaveBeenCalled()

    await runtime.dispose()
  })

  it.each([
    {
      code: 'AI_EXECUTION_FAILED',
      createInput: (preview: { current?: unknown }) => {
        const transaction = transactionEvidence()
        return runtimeInput({
          actionDefinitions: [
            visibilityAction(
              vi.fn(async () => {
                throw new Error('executor failed')
              })
            )
          ],
          confirmationHandler: {
            confirm: vi.fn(async (value) => {
              preview.current = value
              return true
            })
          },
          permissionPolicy: {
            evaluate: vi.fn(async () => 'confirm' as const)
          },
          transactionRunner: transaction.runner
        })
      },
      stage: 'execution'
    },
    {
      code: 'AI_TRANSACTION_FAILED',
      createInput: (preview: { current?: unknown }) =>
        runtimeInput({
          confirmationHandler: {
            confirm: vi.fn(async (value) => {
              preview.current = value
              return true
            })
          },
          permissionPolicy: {
            evaluate: vi.fn(async () => 'confirm' as const)
          },
          transactionRunner: {
            run: vi.fn(async () => {
              throw new Error('transaction failed')
            })
          }
        }),
      stage: 'transaction'
    }
  ] as const)(
    'retains the accepted batch and preview after a $stage failure',
    async ({ code, createInput, stage }) => {
      const preview: { current?: unknown } = {}
      const runtime = createAiAgentRuntime(createInput(preview))

      const result = await runtime.run({
        intent: 'hide the selected shape',
        signal: new AbortController().signal
      })

      expect(result).toMatchObject({
        batchId: 'batch-1',
        code,
        preview: {
          actions: [
            {
              id: 'action-1',
              name: 'set_element_visibility',
              permission: 'confirm',
              summary: {
                affectedCount: 1,
                actionKind: 'visibility'
              }
            }
          ],
          batchId: 'batch-1'
        },
        stage,
        status: 'failed'
      })
      expect(Reflect.get(result, 'preview')).toBe(preview.current)
      expect(JSON.stringify(Reflect.get(result, 'preview'))).not.toContain(
        'arguments'
      )

      await runtime.dispose()
    }
  )

  it('returns stable resolution and execution failures with no raw error values', async () => {
    const resolutionTransaction = transactionEvidence()
    const resolutionRuntime = createAiAgentRuntime(
      runtimeInput({
        provider: {
          requestActionBatch: vi.fn(async () => ({
            ...candidateActionBatch(),
            actions: [
              {
                id: 'unknown-1',
                name: 'unknown_action',
                arguments: {
                  arbitraryCode: 'run()'
                },
                summary: {
                  actionKind: 'unknown'
                }
              }
            ]
          }))
        },
        transactionRunner: resolutionTransaction.runner
      })
    )

    await expect(
      resolutionRuntime.run({
        intent: 'run an unknown action',
        signal: new AbortController().signal
      })
    ).resolves.toMatchObject({
      status: 'failed',
      code: 'AI_ACTION_BATCH_UNKNOWN_ACTION',
      stage: 'resolution',
      retryCount: 0
    })
    expect(resolutionTransaction.run).not.toHaveBeenCalled()

    const transaction = transactionEvidence()
    const runtime = createAiAgentRuntime(
      runtimeInput({
        actionDefinitions: [
          visibilityAction(
            vi.fn(async () => {
              throw new Error('Bearer raw-executor-secret')
            })
          )
        ],
        transactionRunner: transaction.runner
      })
    )
    const result = await runtime.run({
      intent: 'hide the selected shape',
      signal: new AbortController().signal
    })

    expect(result).toMatchObject({
      status: 'failed',
      code: 'AI_EXECUTION_FAILED',
      message: 'AI action execution failed.',
      stage: 'execution',
      retryCount: 0
    })
    expect(JSON.stringify(result)).not.toContain('raw-executor-secret')
    expect(transaction.commits).toBe(0)
    expect(transaction.rollbacks).toBe(1)

    await resolutionRuntime.dispose()
    await runtime.dispose()
  })

  it('returns promptly on abort even when the provider request ignores the signal', async () => {
    const controller = new AbortController()
    const addListener = vi.spyOn(controller.signal, 'addEventListener')
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    const runtime = createAiAgentRuntime(
      runtimeInput({
        provider: {
          requestActionBatch: vi.fn(
            async () => new Promise<AiActionBatch>(() => undefined)
          )
        }
      })
    )
    const pending = runtime.run({
      intent: 'hide the selected shape',
      signal: controller.signal
    })

    await vi.waitFor(() =>
      expect(addListener).toHaveBeenCalledWith(
        'abort',
        expect.any(Function),
        expect.objectContaining({
          once: true
        })
      )
    )
    controller.abort()

    await expect(pending).resolves.toMatchObject({
      status: 'cancelled',
      reason: 'aborted'
    })
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))

    await runtime.dispose()
  })

  it('dispose aborts and awaits active work, cleans owned resources, and rejects new work as a terminal result', async () => {
    const ownedDispose = vi.fn()
    const providerStarted = vi.fn()
    const runtime = createAiAgentRuntime(
      runtimeInput({
        provider: {
          requestActionBatch: vi.fn(
            async (_input, { signal }) =>
              new Promise<AiActionBatch>((_resolve, reject) => {
                providerStarted()
                signal.addEventListener(
                  'abort',
                  () =>
                    reject(
                      new AiProviderError({
                        code: 'AI_PROVIDER_ABORTED',
                        message: 'AI provider request was aborted.'
                      })
                    ),
                  { once: true }
                )
              })
          )
        },
        ownedResources: [
          {
            dispose: ownedDispose
          }
        ]
      })
    )
    const active = runtime.run({
      intent: 'hide the selected shape',
      signal: new AbortController().signal
    })
    await vi.waitFor(() => expect(providerStarted).toHaveBeenCalledOnce())

    await runtime.dispose()

    await expect(active).resolves.toMatchObject({
      status: 'cancelled',
      reason: 'aborted'
    })
    expect(ownedDispose).toHaveBeenCalledOnce()
    await expect(
      runtime.run({
        intent: 'new work',
        signal: new AbortController().signal
      })
    ).resolves.toMatchObject({
      status: 'failed',
      code: 'AI_RUNTIME_DISPOSED',
      stage: 'runtime'
    })
  })
})
