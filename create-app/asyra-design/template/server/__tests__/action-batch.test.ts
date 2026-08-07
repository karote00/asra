import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import type { AiActionBatch, AiProviderInput } from '@asyra/ai-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import {
  ActionBatchServerError,
  createActionBatchMiddleware,
  resolveActionBatchRequest
} from '../action-batch'
import { ACTION_BATCH_ENDPOINT } from '../../src/ai/action-batch-endpoint'

const sampleRoot = new URL('../../samples/crdt-7076/', import.meta.url)

const sampleActionBatch = async (): Promise<AiActionBatch> =>
  JSON.parse(
    await readFile(new URL('action-batch.json', sampleRoot), 'utf8')
  ) as AiActionBatch

const sampleInput = async (): Promise<AiProviderInput> => {
  const [image, instruction] = await Promise.all([
    readFile(new URL('reference-image.png', sampleRoot)),
    readFile(new URL('instruction.txt', sampleRoot), 'utf8')
  ])
  return {
    actions: [
      {
        description: 'Insert one prepared vector composition',
        inputSchema: {},
        name: 'insert_vector_composition'
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

const postActionBatch = async (
  middleware: ReturnType<typeof createActionBatchMiddleware>,
  input: AiProviderInput
): Promise<{ readonly body: unknown; readonly status: number }> => {
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
        body: JSON.stringify(input),
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        method: 'POST'
      }
    )
    return {
      body: await response.json(),
      status: response.status
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

describe('crdt-7076 action-batch backend sample', () => {
  it('bypasses the model provider for the exact 7076 sample', async () => {
    const requestModelActionBatch = vi.fn(async (): Promise<AiActionBatch> => {
      throw new Error('The exact 7076 sample must not call the model provider.')
    })

    await expect(
      resolveActionBatchRequest(await sampleInput(), {
        requestId: 'request-7076',
        requestModelActionBatch
      })
    ).resolves.toEqual(await sampleActionBatch())
    expect(requestModelActionBatch).not.toHaveBeenCalled()
  })

  it('uses the configured model path for an ordinary request', async () => {
    const expectedBatch: AiActionBatch = {
      actions: [
        {
          arguments: { height: 40, width: 80 },
          id: 'action-1',
          name: 'create_rectangle',
          summary: 'Create one rectangle'
        }
      ],
      batchId: 'model-batch'
    }
    const requestModelActionBatch = vi.fn(async () => expectedBatch)
    const input: AiProviderInput = {
      actions: [],
      attempt: 1,
      context: {},
      intent: 'Create one rectangle'
    }

    await expect(
      resolveActionBatchRequest(input, {
        requestId: 'ordinary-request',
        requestModelActionBatch
      })
    ).resolves.toEqual(expectedBatch)
    expect(requestModelActionBatch).toHaveBeenCalledOnce()
    expect(requestModelActionBatch).toHaveBeenCalledWith(input, {
      signal: undefined
    })
  })

  it('returns the exact ordered instruction file after the image and instruction match', async () => {
    const expectedBatch = await sampleActionBatch()
    const batch = await resolveActionBatchRequest(await sampleInput(), {
      requestId: 'request-7076'
    })
    const action = batch.actions[0]
    const artifact = action.arguments as {
      elementCount: number
      groupDescriptor: { id: string }
      slices: readonly { descriptors: readonly unknown[] }[]
    }

    expect(batch).toEqual(expectedBatch)
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

  it('returns the exact instruction file through the formal HTTP endpoint', async () => {
    const expectedBatch = await sampleActionBatch()
    const response = await postActionBatch(
      createActionBatchMiddleware(),
      await sampleInput()
    )
    const batch = response.body as {
      actions: readonly {
        arguments: {
          elementCount: number
          groupDescriptor: { id: string }
        }
      }[]
    }

    expect(response.status).toBe(200)
    expect(batch).toEqual(expectedBatch)
    expect(batch.actions).toHaveLength(1)
    expect(batch.actions[0].arguments.elementCount).toBe(7_075)
    expect(batch.actions[0].arguments.groupDescriptor.id).toMatch(
      /^grp-[a-f0-9]+-1$/
    )
  })

  it('maps incomplete configuration and upstream failure before Runtime', async () => {
    const ordinaryInput: AiProviderInput = {
      actions: [],
      attempt: 1,
      context: {},
      intent: 'Create one rectangle'
    }
    const cases = [
      {
        backendCode: 'AI_MODEL_BACKEND_INVALID_CONFIGURATION',
        responseCode: 'ACTION_BATCH_MODEL_CONFIGURATION_REQUIRED',
        status: 503
      },
      {
        backendCode: 'AI_MODEL_BACKEND_TRANSPORT_FAILED',
        responseCode: 'ACTION_BATCH_MODEL_FAILED',
        status: 502
      }
    ] as const

    for (const testCase of cases) {
      const response = await postActionBatch(
        createActionBatchMiddleware({
          requestModelActionBatch: async () => {
            throw Object.assign(new Error('bounded backend failure'), {
              code: testCase.backendCode
            })
          }
        }),
        ordinaryInput
      )

      expect(response).toEqual({
        body: { code: testCase.responseCode },
        status: testCase.status
      })
    }
  })

  it('rejects a different instruction or image before action preparation', async () => {
    const input = await sampleInput()
    const requestModelActionBatch = vi.fn(async (): Promise<AiActionBatch> => {
      throw new Error(
        'A mismatched 7076 sample must fail without model fallback.'
      )
    })

    await expect(
      resolveActionBatchRequest(
        {
          ...input,
          intent: 'draw something else'
        },
        { requestId: 'wrong-instruction', requestModelActionBatch }
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
        { requestId: 'wrong-image', requestModelActionBatch }
      )
    ).rejects.toBeInstanceOf(ActionBatchServerError)
    expect(requestModelActionBatch).not.toHaveBeenCalled()
  })

  it('keeps only the ordered instruction file as the sample drawing authority', async () => {
    const instructionFile = JSON.parse(
      await readFile(new URL('action-batch.json', sampleRoot), 'utf8')
    ) as AiActionBatch

    expect(instructionFile.batchId).toBe('create-cat-only-white-background')
    expect(instructionFile.actions).toHaveLength(1)
    await expect(
      readFile(new URL('action-batch.json', sampleRoot), 'utf8')
    ).resolves.toContain('"insert_vector_composition"')
    await expect(
      readFile(new URL('converted-vector-data.svg', sampleRoot), 'utf8')
    ).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(
      readFile(new URL('instruction.txt', sampleRoot), 'utf8')
    ).resolves.toMatch(/Draw only the cat/)
    expect(fileURLToPath(new URL('reference-image.png', sampleRoot))).toContain(
      '/samples/crdt-7076/'
    )
  })

  it('keeps one canonical 7,076-element generated regression document', async () => {
    const compressedDocument = await readFile(
      new URL('document.json.gz', sampleRoot)
    )
    const document = JSON.parse(gunzipSync(compressedDocument).toString()) as {
      version: string
      sceneTree: {
        workspaceList: readonly string[]
        elements: Readonly<Record<string, unknown>>
      }
    }
    const workspaceIds = new Set(document.sceneTree.workspaceList)
    const documentElementIds = Object.keys(document.sceneTree.elements).filter(
      (elementId) => !workspaceIds.has(elementId)
    )

    expect(compressedDocument.byteLength).toBeLessThan(16 * 1024 * 1024)
    expect(document.version).toBe('1.0.0')
    expect(documentElementIds).toHaveLength(7_076)
  })
})
