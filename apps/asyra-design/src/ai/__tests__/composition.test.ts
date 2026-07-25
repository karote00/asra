import { describe, expect, it, vi } from 'vitest'
import type { CreateAiAgentRuntimeInput } from '@asyra/ai-agent-runtime'
import { composeAiAgentRuntime } from '../composition'

const createRuntimeInput = (): CreateAiAgentRuntimeInput => ({
  provider: {
    generateActionPlan: vi.fn()
  },
  actionDefinitions: [],
  contextProvider: {
    getContext: vi.fn()
  },
  permissionPolicy: {
    evaluate: vi.fn()
  },
  confirmationHandler: {
    confirm: vi.fn()
  },
  transactionRunner: {
    run: vi.fn()
  }
})

describe('Asyra Design AI runtime composition', () => {
  it('returns a zero-side-effect bypass when AI is disabled', async () => {
    const createInput = vi.fn(createRuntimeInput)
    const composition = composeAiAgentRuntime({
      enabled: false,
      createRuntimeInput: createInput
    })

    expect(composition.enabled).toBe(false)
    expect(composition.providerEnabled).toBe(false)
    expect(composition.runtime).toBeNull()
    expect(createInput).not.toHaveBeenCalled()

    await composition.dispose()

    expect(createInput).not.toHaveBeenCalled()
  })

  it('keeps the Feature available without constructing a provider-disabled runtime', async () => {
    const createInput = vi.fn(createRuntimeInput)
    const composition = composeAiAgentRuntime({
      enabled: true,
      providerEnabled: false,
      createRuntimeInput: createInput
    })

    expect(composition.enabled).toBe(true)
    expect(composition.providerEnabled).toBe(false)
    expect(composition.runtime).toBeNull()
    expect(createInput).not.toHaveBeenCalled()

    await composition.dispose()

    expect(createInput).not.toHaveBeenCalled()
  })

  it('creates one isolated runtime only after explicit enablement', async () => {
    const ownedDispose = vi.fn()
    const createInput = vi.fn(() => ({
      ...createRuntimeInput(),
      ownedResources: [{ dispose: ownedDispose }]
    }))
    const composition = composeAiAgentRuntime({
      enabled: true,
      providerEnabled: true,
      createRuntimeInput: createInput
    })

    expect(composition.enabled).toBe(true)
    expect(composition.providerEnabled).toBe(true)
    expect(composition.runtime).not.toBeNull()
    expect(createInput).toHaveBeenCalledOnce()

    await composition.dispose()
    await composition.dispose()

    expect(ownedDispose).toHaveBeenCalledOnce()
  })

  it('rejects enabled composition without an app-owned runtime factory', () => {
    expect(() =>
      composeAiAgentRuntime({
        enabled: true,
        providerEnabled: true
      })
    ).toThrow('createRuntimeInput is required when AI is enabled')
  })
})
