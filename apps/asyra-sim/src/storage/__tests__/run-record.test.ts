import { describe, expect, it } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { createExperimentSnapshot } from '../../analysis/snapshot'
import { OFFICIAL_CLEARANCE_METHOD } from '../../analysis/methods/official-method'
import { terminalAnalysisResult } from '../../analysis/result'
import { validateRunRecord, RunArchive } from '../run-record'
import { compareRuns } from '../run-comparison'
import { exportRunCsv, exportRunHtml, exportRunJson } from '../run-reports'
import { encodeProject, decodeProject } from '../project-format'

function record(id = 'run-a') {
  const example = createSyntheticExample(),
    draft = createSyntheticExperimentDraft(example)
  const snapshot = createExperimentSnapshot({
    snapshotId: `snapshot-${id}`,
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: example.workcell,
    definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
    methods: [OFFICIAL_CLEARANCE_METHOD],
    acknowledgedWarningCodes: []
  })
  return {
    version: 1 as const,
    name: id,
    retainedAt: '2026-09-05T00:00:00.000Z',
    environment: {
      appVersion: '0.1.0-alpha.0',
      userAgent: 'Test browser',
      hardwareConcurrency: 8
    },
    snapshot,
    result: terminalAnalysisResult(snapshot, [], {
      runId: id,
      startedAt: 0,
      endedAt: 1,
      execution: 'cancelled',
      error: 'Cancelled by user'
    })
  }
}

describe('retained runs and portable reporting', () => {
  it('preserves immutable evidence and refuses identity reuse with different content', () => {
    const archive = new RunArchive(),
      input = record()
    archive.add(input)
    input.name = 'Modified outside'
    expect(archive.get('run-a')?.name).toBe('run-a')
    expect(
      Object.isFrozen(archive.get('run-a')?.snapshot.workcell.bodies)
    ).toBe(true)
    expect(() => archive.add(input)).toThrow('different')
    expect(() => archive.add(record())).not.toThrow()
  })

  it('roundtrips historical data with native projects and validates before exposing records', () => {
    const run = record()
    const snapshot = {
      document: {
        version: '1.0.0',
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {}
      },
      loadIssues: [],
      runs: [run]
    }
    expect(decodeProject(encodeProject(snapshot))).toEqual(snapshot)
    const corrupt = structuredClone(snapshot)
    corrupt.runs[0].result.verdict = 'meets'
    expect(() => encodeProject(corrupt)).toThrow()
    const content = JSON.parse(encodeProject(snapshot))
    content.runs.push(content.runs[0])
    expect(() => decodeProject(JSON.stringify(content))).toThrow('Duplicate')
    const privateRun = structuredClone(run)
    privateRun.snapshot.method.id = 'missing-private-method'
    privateRun.result.method.id = 'missing-private-method'
    expect(validateRunRecord(privateRun).result.execution).toBe('cancelled')
  })

  it('compares three runs without choosing a winner and discloses incompatible rules', () => {
    const a = record('a'),
      b = record('b'),
      c = record('c')
    b.snapshot = structuredClone(b.snapshot)
    b.result = structuredClone(b.result)
    b.snapshot.rule.minimumClearance = 0.05
    b.result.rule.minimumClearance = 0.05
    const comparison = compareRuns([a, b, c])
    expect(comparison.directlyComparable).toBe(false)
    expect(comparison.incompatibilities).toContain('Decision rules differ')
    expect(
      comparison.differences.some((item) =>
        item.path.includes('rule.minimumClearance')
      )
    ).toBe(true)
    expect(comparison).not.toHaveProperty('winner')
    expect(compareRuns([a, record('other')]).directlyComparable).toBe(true)
  })

  it('exports the same terminal states, missing evidence and source identities safely', () => {
    const run = record()
    run.name =
      '=HYPERLINK("https://invalid.example","<script>alert(1)</script>")'
    const json = JSON.parse(exportRunJson(run))
    expect(json.run).toEqual(run)
    const csv = exportRunCsv(run),
      html = exportRunHtml(run)
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain('no-retained-evidence')
    expect(csv).toContain('cannot-determine')
    expect(csv).toContain(run.snapshot.snapshotId)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('cancelled')
    expect(html).toContain('partial')
    expect(html).toContain('No retained evidence')
    expect(html).not.toMatch(/<\w+[^>]+(?:src|href)=/)
  })
})
