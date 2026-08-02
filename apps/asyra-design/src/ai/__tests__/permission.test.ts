import { describe, expect, it } from 'vitest'
import type {
  AiPermissionDecision,
  AiPreparedAction
} from '@asyra/ai-agent-runtime'
import {
  AiPermissionConfigurationError,
  createAiPermissionPolicy
} from '../permission'

const action = (name: string): AiPreparedAction =>
  Object.freeze({
    id: `${name}-1`,
    name,
    arguments: Object.freeze({}),
    summary: Object.freeze({
      affectedCount: 0
    }),
    execute: async () => null
  })

describe('Asyra Design AI permission policy', () => {
  it('defaults every action to deny', async () => {
    const policy = createAiPermissionPolicy()

    await expect(
      policy.evaluate({
        action: action('resize'),
        context: {}
      })
    ).resolves.toBe('deny')
  })

  it('uses only explicit app-owned allow and confirm rules', async () => {
    const rules: Record<string, AiPermissionDecision> = {
      resize: 'allow',
      delete_elements: 'confirm'
    }
    const policy = createAiPermissionPolicy(rules)
    rules.resize = 'confirm'

    await expect(
      policy.evaluate({
        action: action('resize'),
        context: {}
      })
    ).resolves.toBe('allow')
    await expect(
      policy.evaluate({
        action: action('delete_elements'),
        context: {}
      })
    ).resolves.toBe('confirm')
    await expect(
      policy.evaluate({
        action: action('model_added_action'),
        context: {}
      })
    ).resolves.toBe('deny')
  })

  it('rejects invalid app rule configuration before policy use', () => {
    expect(() =>
      createAiPermissionPolicy({
        resize: 'model-allow' as never
      })
    ).toThrow(AiPermissionConfigurationError)
  })
})
