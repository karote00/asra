import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import type { AiProviderInput } from '@asyra/ai-agent-runtime'
import { describe, expect, it } from 'vitest'
import {
  ActionBatchServerError,
  createActionBatchMiddleware,
  resolveActionBatchRequest
} from '../action-batch'
import { ACTION_BATCH_ENDPOINT } from '../../src/ai/action-batch-endpoint'

const sampleRoot = new URL('../../samples/crdt-7076/', import.meta.url)

const sampleInput = async (): Promise<AiProviderInput> => {
  const [image, instruction] = await Promise.all([
    readFile(new URL('reference-image.png', sampleRoot)),
    readFile(new URL('instruction.txt', sampleRoot), 'utf8')
  ])
  return {
    actions: [
      {
        description: 'Insert one prepared vector composition',
        name: 'insert_vector_composition',
        parameters: {}
      }
    ],
    attempt: 1,
    context: {},
    intent: instruction.trim(),
    metadata: {
      imageAttachments: [
        {
          dataUrl: `data:image/png;base64,${image.toString('base64')}`,
          mediaType: 'image/png',
          name: 'reference-image.png',
          size: image.byteLength
        }
      ]
    }
  }
}

describe('crdt-7076 action-batch backend sample', () => {
  it('reads the stored conversion after the exact image and instruction match', async () => {
    const batch = await resolveActionBatchRequest(await sampleInput(), {
      requestId: 'request-7076'
    })
    const action = batch.actions[0]
    const artifact = action.arguments as {
      elementCount: number
      groupDescriptor: { id: string }
      slices: readonly { descriptors: readonly unknown[] }[]
    }

    expect(batch.actions).toHaveLength(1)
    expect(batch.batchId).toBe('create-cat-only-white-background')
    expect(artifact.elementCount).toBe(7_075)
    expect(artifact.groupDescriptor.id).toMatch(/^grp-[a-f0-9]+-1$/)
    expect(
      artifact.slices.reduce(
        (total, slice) => total + slice.descriptors.length,
        0
      )
    ).toBe(7_075)
  })

  it('returns the stored conversion through the formal HTTP endpoint', async () => {
    const middleware = createActionBatchMiddleware()
    const server = createServer((request, response) => {
      void middleware(request, response, () => {
        response.statusCode = 404
        response.end()
      })
    })

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
      })
      const address = server.address() as AddressInfo
      const response = await fetch(
        `http://127.0.0.1:${address.port}${ACTION_BATCH_ENDPOINT}`,
        {
          body: JSON.stringify(await sampleInput()),
          headers: {
            accept: 'application/json',
            'content-type': 'application/json'
          },
          method: 'POST'
        }
      )
      const batch = (await response.json()) as {
        actions: readonly {
          arguments: {
            elementCount: number
            groupDescriptor: { id: string }
          }
        }[]
      }

      expect(response.status).toBe(200)
      expect(batch.actions).toHaveLength(1)
      expect(batch.actions[0].arguments.elementCount).toBe(7_075)
      expect(batch.actions[0].arguments.groupDescriptor.id).toMatch(
        /^grp-[a-f0-9]+-1$/
      )
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })

  it('rejects a different instruction or image before action preparation', async () => {
    const input = await sampleInput()

    await expect(
      resolveActionBatchRequest(
        {
          ...input,
          intent: 'draw something else'
        },
        { requestId: 'wrong-instruction' }
      )
    ).rejects.toBeInstanceOf(ActionBatchServerError)

    const metadata = input.metadata as {
      imageAttachments: readonly Record<string, unknown>[]
    }
    await expect(
      resolveActionBatchRequest(
        {
          ...input,
          metadata: {
            imageAttachments: [
              {
                ...metadata.imageAttachments[0],
                dataUrl: 'data:image/png;base64,AQID',
                size: 3
              }
            ]
          }
        },
        { requestId: 'wrong-image' }
      )
    ).rejects.toBeInstanceOf(ActionBatchServerError)
  })

  it('keeps the stored conversion and instruction inside the sample folder', async () => {
    await expect(
      readFile(new URL('converted-vector-data.svg', sampleRoot), 'utf8')
    ).resolves.toMatch(/<svg[\s\S]*<path/)
    await expect(
      readFile(new URL('instruction.txt', sampleRoot), 'utf8')
    ).resolves.toMatch(/Draw only the cat/)
    expect(fileURLToPath(new URL('reference-image.png', sampleRoot))).toContain(
      '/samples/crdt-7076/'
    )
  })
})
