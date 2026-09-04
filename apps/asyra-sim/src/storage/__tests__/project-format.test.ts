import { describe, expect, it } from 'vitest'
import { IndexedProjectRepository } from '../indexed-db'
import {
  decodeProject,
  encodeProject,
  validateSummary
} from '../project-format'

const snapshot = () => ({
  document: {
    version: '1.0.0',
    sceneTree: { workspace: '', workspaceList: [], elements: {} },
    props: {}
  },
  loadIssues: [
    {
      path: 'props.test.body',
      message: 'Repaired dimension needs confirmation'
    }
  ]
})

describe('local project envelope', () => {
  it('reports unavailable native storage rather than substituting memory', async () => {
    const repository = new IndexedProjectRepository()
    await expect(repository.list()).rejects.toThrow('IndexedDB is unavailable')
    repository.close()
  })
  it('roundtrips detached document data and retained load repair diagnostics', () => {
    const original = snapshot(),
      decoded = decodeProject(encodeProject(original))
    expect(decoded).toEqual(original)
    expect(decoded.document).not.toBe(original.document)
    original.loadIssues[0].message = 'changed'
    expect(decoded.loadIssues[0].message).toBe(
      'Repaired dimension needs confirmation'
    )
  })
  it('rejects nonfinite data rather than serializing it as null', () => {
    for (const value of [NaN, Infinity, -Infinity])
      expect(() =>
        encodeProject({
          ...snapshot(),
          document: { ...snapshot().document, props: { value } }
        })
      ).toThrow('Nonfinite')
  })
  it('rejects malformed and unsupported envelopes before canonical application', () => {
    for (const text of [
      'null',
      '{}',
      '{',
      '{"format":"asyra-sim-project","version":2}',
      JSON.stringify({
        format: 'asyra-sim-project',
        version: 1,
        ...snapshot(),
        document: {}
      }),
      JSON.stringify({
        format: 'asyra-sim-project',
        version: 1,
        ...snapshot(),
        loadIssues: 'lost'
      })
    ])
      expect(() => decodeProject(text)).toThrow()
  })
  it('rejects missing or invalid metadata without fabricating a project', () => {
    expect(() => validateSummary(null)).toThrow()
    expect(() =>
      validateSummary({
        id: 'x',
        name: '',
        revision: 'a',
        savedAt: 'yesterday'
      })
    ).toThrow()
  })
})
