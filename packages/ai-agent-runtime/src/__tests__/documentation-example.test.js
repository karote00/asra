import fs from 'node:fs'
import { URL } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  createExampleAiRuntime,
  exampleDefinition
} from '../../../../docs/examples/ai-agent-runtime.mjs'

describe('AI agent runtime documentation example', () => {
  it('declares the supported workspace example runner', () => {
    const manifest = JSON.parse(
      fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    )

    expect(manifest.scripts?.['example:ai-agent-runtime']).toBe(
      'vitest run src/__tests__/documentation-example.test.js'
    )
  })

  it('executes one registered action in one transaction without a live provider', async () => {
    expect(exampleDefinition.id).toBe('ai-registered-action')
    const example = createExampleAiRuntime()

    await expect(example.run()).resolves.toMatchObject({
      status: 'executed',
      batchId: 'example-batch',
      transaction: {
        status: 'committed'
      }
    })
    expect(example.getEvidence()).toMatchObject({
      visible: false,
      transaction: {
        commits: 1,
        rollbacks: 0
      },
      providerInputs: [
        {
          actions: [
            {
              name: 'set_visibility'
            }
          ],
          attempt: 1
        }
      ]
    })

    await example.dispose()
  })
})
