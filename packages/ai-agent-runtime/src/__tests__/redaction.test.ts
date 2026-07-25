import { describe, expect, it, vi } from 'vitest'
import { AI_REDACTED_VALUE, redactAiValue } from '..'

describe('AI runtime redaction', () => {
  it('redacts default and configured secret keys recursively', () => {
    const redacted = redactAiValue(
      {
        authorization: 'Bearer top-secret',
        nested: {
          api_key: 'api-secret',
          safe: 'visible',
          customCredential: 'custom-secret'
        },
        values: [
          {
            refreshToken: 'refresh-secret'
          }
        ]
      },
      {
        additionalSecretKeys: ['customCredential']
      }
    )

    expect(redacted).toEqual({
      authorization: AI_REDACTED_VALUE,
      nested: {
        api_key: AI_REDACTED_VALUE,
        safe: 'visible',
        customCredential: AI_REDACTED_VALUE
      },
      values: [
        {
          refreshToken: AI_REDACTED_VALUE
        }
      ]
    })
    expect(Object.isFrozen(redacted)).toBe(true)
  })

  it('redacts authorization-shaped values even under an unknown key', () => {
    expect(
      redactAiValue({
        value: 'Bearer token-value',
        another: 'Basic credential-value',
        safe: 'bearer is just a word here'
      })
    ).toEqual({
      value: AI_REDACTED_VALUE,
      another: AI_REDACTED_VALUE,
      safe: 'bearer is just a word here'
    })
  })

  it('never invokes accessors and emits JSON-safe markers for unsafe values', () => {
    const getter = vi.fn(() => 'secret')
    const value: Record<string, unknown> = {
      bigint: BigInt(1),
      callback: () => undefined,
      number: Number.NaN
    }
    Object.defineProperty(value, 'accessor', {
      enumerable: true,
      get: getter
    })
    value.self = value

    const redacted = redactAiValue(value)

    expect(getter).not.toHaveBeenCalled()
    expect(redacted).toEqual({
      bigint: AI_REDACTED_VALUE,
      callback: AI_REDACTED_VALUE,
      number: AI_REDACTED_VALUE,
      accessor: AI_REDACTED_VALUE,
      self: AI_REDACTED_VALUE
    })
    expect(() => JSON.stringify(redacted)).not.toThrow()
  })
})
