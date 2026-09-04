import { validateRunRecord, type RunRecord } from './run-record'

const escapeHtml = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character] ?? character
  )
const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value)
  if (
    typeof value === 'string' &&
    (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
  )
    text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
function bounded(text: string): string {
  if (new TextEncoder().encode(text).length > 64 * 1024 * 1024)
    throw new Error('Report exceeds 64 MiB')
  return text
}

export function exportRunJson(input: RunRecord): string {
  const run = validateRunRecord(input)
  return bounded(
    JSON.stringify({ format: 'asyra-sim-run-report', version: 1, run }, null, 2)
  )
}

export function exportRunCsv(input: RunRecord): string {
  const run = validateRunRecord(input),
    { snapshot, result } = run
  const prefix = [
    run.name,
    result.runId,
    snapshot.snapshotId,
    snapshot.source.candidateId,
    snapshot.source.experimentId,
    snapshot.source.experimentRevision,
    result.method.id,
    result.method.version,
    result.rule.revision,
    result.rule.minimumClearance,
    result.execution,
    result.coverage,
    result.verdict,
    result.summary,
    JSON.stringify(snapshot.sourceUnits),
    JSON.stringify(snapshot.scope),
    JSON.stringify(snapshot.method.settings),
    JSON.stringify(snapshot.budget),
    JSON.stringify(run.environment),
    JSON.stringify(run.lineage ?? null)
  ]
  const rows: unknown[][] = [
    [
      'run_name',
      'run_id',
      'snapshot_id',
      'candidate_id',
      'experiment_id',
      'experiment_revision',
      'method_id',
      'method_version',
      'rule_revision',
      'minimum_clearance_m',
      'execution',
      'coverage',
      'verdict',
      'summary',
      'source_units_json',
      'scope_json',
      'method_settings_json',
      'budget_json',
      'environment_json',
      'lineage_json',
      'pair_id',
      'start_s',
      'end_s',
      'lower_m',
      'upper_m',
      'witness_time_s',
      'penetration',
      'state',
      'reason'
    ]
  ]
  const evidence = new Map(
    result.pairEvidence.map((pair) => [pair.pairId, pair.evidence])
  )
  for (const pair of snapshot.pairs) {
    const item = evidence.get(pair.id)
    if (!item)
      rows.push([
        ...prefix,
        pair.id,
        ...snapshot.interval,
        null,
        null,
        null,
        null,
        'no-retained-evidence',
        result.errors.join('; ')
      ])
    else
      for (const leaf of item.leaves)
        rows.push([
          ...prefix,
          pair.id,
          leaf.start,
          leaf.end,
          leaf.lower,
          leaf.upper,
          leaf.witnessTime,
          leaf.penetration,
          leaf.state,
          leaf.reason
        ])
  }
  return bounded(rows.map((row) => row.map(csvCell).join(',')).join('\r\n'))
}

export function exportRunHtml(input: RunRecord): string {
  const run = validateRunRecord(input),
    { snapshot, result } = run
  const evidence = new Map(
    result.pairEvidence.map((pair) => [pair.pairId, pair.evidence])
  )
  const row = (values: readonly unknown[]) =>
    `<tr>${values.map((value) => `<td>${escapeHtml(value === null ? 'unknown' : value)}</td>`).join('')}</tr>`
  const pairRows = snapshot.pairs
    .flatMap((pair) => {
      const item = evidence.get(pair.id)
      if (!item)
        return [
          row([
            pair.id,
            snapshot.interval.join(' – '),
            'unknown',
            'unknown',
            'No retained evidence',
            result.errors.join('; ')
          ])
        ]
      return item.leaves.map((leaf) =>
        row([
          pair.id,
          `${leaf.start} – ${leaf.end}`,
          leaf.lower,
          leaf.upper,
          leaf.state,
          leaf.reason
        ])
      )
    })
    .join('')
  return bounded(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(run.name)} · Asyra Sim</title>
<style>body{font:14px/1.6 system-ui,sans-serif;color:#213442;max-width:1200px;margin:40px auto;padding:0 24px}h1{font-size:28px}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{border:1px solid #cbd8df;padding:9px;text-align:left;overflow-wrap:anywhere}th{background:#edf4f4}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f8f9;padding:16px}.notice{background:#fff5df;padding:16px}summary{cursor:pointer;font-weight:bold}</style></head><body>
<h1>${escapeHtml(run.name)}</h1><p>Asyra Sim ${escapeHtml(run.environment.appVersion)} · retained ${escapeHtml(run.retainedAt)}</p>
<p class="notice">This report describes a modeled experiment. Unresolved means unknown. A completed run does not establish real-world safety. Analysis runtime is not robot cycle time.</p>
<table><thead><tr><th>Execution</th><th>Coverage</th><th>Verdict</th><th>Summary</th></tr></thead><tbody>${row([result.execution, result.coverage, result.verdict, result.summary])}</tbody></table>
<p>Run ${escapeHtml(result.runId)} · snapshot ${escapeHtml(snapshot.snapshotId)} · experiment revision ${snapshot.source.experimentRevision}</p>
<p>Method ${escapeHtml(result.method.id)}@${escapeHtml(result.method.version)} · rule revision ${result.rule.revision} · minimum clearance ${result.rule.minimumClearance} m</p>
<p>Pairs with evidence ${result.coveredPairCount}/${result.totalPairCount} · findings ${result.findingPairCount} · unresolved or absent ${result.unresolvedPairCount + result.totalPairCount - result.coveredPairCount}</p>
<p>${escapeHtml(snapshot.scope.backgroundNote)}</p><p>${escapeHtml(result.errors.join('; '))}</p>
<table><thead><tr><th>Pair</th><th>Interval (s)</th><th>Lower (m)</th><th>Upper (m)</th><th>Evidence</th><th>Reason</th></tr></thead><tbody>${pairRows}</tbody></table>
<details><summary>Frozen inputs, source units, exclusions, method settings, environment and lineage</summary><pre>${escapeHtml(JSON.stringify({ snapshot, environment: run.environment, lineage: run.lineage ?? null }, null, 2))}</pre></details>
<details><summary>Complete immutable result (including witness times)</summary><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre></details>
</body></html>`)
}
