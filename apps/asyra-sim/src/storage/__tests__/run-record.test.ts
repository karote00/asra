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
import { INSTALLED_METHOD_CATALOG } from '../../extensions/installed-methods'

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

  it('discloses changed or missing retained declarations even when method identity matches', () => {
    const a = record('a'),
      b = record('b'),
      legacy = record('legacy')
    a.snapshot = structuredClone(a.snapshot)
    b.snapshot = structuredClone(b.snapshot)
    a.snapshot.methodDescriptor = structuredClone(
      INSTALLED_METHOD_CATALOG.descriptors[0]
    )
    b.snapshot.methodDescriptor = structuredClone(a.snapshot.methodDescriptor)
    expect(compareRuns([a, b]).directlyComparable).toBe(true)
    if (!b.snapshot.methodDescriptor.manifest)
      throw new Error('Missing test declaration')
    b.snapshot.methodDescriptor.manifest.validation.evidence =
      'Different private validation evidence'
    const changed = compareRuns([a, b])
    expect(changed.directlyComparable).toBe(false)
    expect(changed.incompatibilities).toContain(
      'Retained method declarations differ'
    )
    expect(changed.differences.map((item) => item.path)).toContain(
      'methodDescriptor.manifest.validation.evidence'
    )
    expect(compareRuns([a, legacy]).incompatibilities).toContain(
      'Retained method declarations differ'
    )
    b.snapshot.methodDescriptor = Object.fromEntries(
      Object.entries(a.snapshot.methodDescriptor).reverse()
    ) as typeof a.snapshot.methodDescriptor
    expect(compareRuns([a, b]).directlyComparable).toBe(true)
  })

  it('exports retained declarations in every report without looking up installed code', () => {
    const run = record()
    run.snapshot = structuredClone(run.snapshot)
    run.snapshot.methodDescriptor = structuredClone(
      INSTALLED_METHOD_CATALOG.descriptors[0]
    )
    if (!run.snapshot.methodDescriptor.manifest)
      throw new Error('Missing test declaration')
    run.snapshot.methodDescriptor.manifest.source =
      '<private source & evidence>'
    const csv = exportRunCsv(run)
    expect(csv.split('\r\n')[0]).toContain('"method_descriptor_json"')
    expect(csv).toContain('""source"":""<private source & evidence>""')
    expect(
      JSON.parse(exportRunJson(run)).run.snapshot.methodDescriptor
    ).toEqual(run.snapshot.methodDescriptor)
    expect(exportRunHtml(run)).toContain(
      '&lt;private source &amp; evidence&gt;'
    )
  })

  it('compares acceptance content and exports the exact retained evaluation in every format', () => {
    const runs = [record('a'), record('b'), record('c')]
    for (const [index, run] of runs.entries()) {
      run.snapshot = structuredClone(run.snapshot)
      run.snapshot.rule.acceptance = {
        kind: 'clearance',
        operator: 'above',
        value: index === 1 ? 0.04 : 0.03
      }
      run.snapshot.rule.revision = index + 1
      run.result = terminalAnalysisResult(run.snapshot, [], {
        runId: run.result.runId,
        startedAt: 0,
        endedAt: 1,
        execution: 'cancelled',
        error: 'Cancelled'
      })
    }
    expect(compareRuns(runs).incompatibilities).toContain(
      'Decision rules differ'
    )
    expect(compareRuns([runs[0], runs[2]]).directlyComparable).toBe(true)
    expect(compareRuns(runs).differences.map((item) => item.path)).toContain(
      'rule.acceptance.value'
    )
    const run = runs[0],
      csv = exportRunCsv(run),
      html = exportRunHtml(run)
    expect(csv).toContain('"rule_json"')
    expect(csv).toContain('"rule_evaluation_json"')
    expect(csv).toContain('""acceptance""')
    expect(csv).toContain('""value"":""unknown""')
    expect(html).toContain('User acceptance evaluation')
    expect(html).toContain(run.result.decision?.reason)
    expect(JSON.parse(exportRunJson(run)).run.result.decision).toEqual(
      run.result.decision
    )
  })
})
