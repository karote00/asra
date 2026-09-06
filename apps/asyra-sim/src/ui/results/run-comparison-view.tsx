import { type RunComparison } from '../../storage/run-comparison'

export function RunComparisonView({
  comparison
}: {
  comparison: RunComparison
}) {
  return (
    <section
      className="run-comparison border-t border-t-sim-border pt-5 grid gap-3"
      aria-label="Run comparison"
    >
      <h3>
        {comparison.directlyComparable
          ? 'Matching method, scope, rule and interval'
          : 'Not directly comparable'}
      </h3>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Read differences and unresolved evidence before making your own
        selection. Matching comparison conditions do not prove real-world
        feasibility.
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Body correspondence uses explicit candidate lineage where available,
        otherwise original canonical identities. Names do not establish
        correspondence. Raw identities remain in each report.
      </p>

      {comparison.incompatibilities.length > 0 && (
        <ul className="diagnostic-list text-[11px] leading-[1.7] pl-[18px] text-sim-error-text">
          {comparison.incompatibilities.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      <div
        className="comparison-columns grid grid-flow-col auto-cols-[minmax(0,_1fr)] gap-3
          [&_>_*]:border [&_>_*]:border-sim-divider [&_>_*]:p-3
          [&_>_*]:rounded-[6px] [&_>_*]:min-w-0 [&_>_*]:wrap-anywhere
          [&_p]:text-[11px] [&_p]:leading-[1.7] [&_p]:mt-2 [&_pre]:max-h-60
          [&_pre]:overflow-auto [&_pre]:whitespace-pre-wrap [&_pre]:text-[10px]"
      >
        {comparison.runs.map((run, index) => (
          <article key={run.result.runId}>
            <h4>
              {String.fromCharCode(65 + index)} - {run.name}
            </h4>

            <p>
              {run.result.execution} - {run.result.coverage} -{' '}
              {run.result.verdict}
            </p>

            <p>
              {run.result.findingPairCount} finding pairs -{' '}
              {run.result.unresolvedPairCount +
                run.result.totalPairCount -
                run.result.coveredPairCount}{' '}
              unresolved/missing pairs
            </p>

            <p>
              {run.snapshot.method.id}@{run.snapshot.method.version}
            </p>

            <p>
              Threshold {run.snapshot.rule.minimumClearance * 1000} mm -{' '}
              {run.snapshot.pairs.length} pairs - interval{' '}
              {run.snapshot.interval.join('–')} s
            </p>
          </article>
        ))}
      </div>

      <h4>{comparison.differences.length} input differences</h4>

      {comparison.differences.length === 0 && (
        <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
          No modeled input differences. Source identities and execution
          timestamps are not ranked.
        </p>
      )}

      {comparison.differences.map((difference) => (
        <details key={difference.path}>
          <summary>{difference.path}</summary>

          <div
            className="comparison-columns grid grid-flow-col auto-cols-[minmax(0,_1fr)] gap-3
              [&_>_*]:border [&_>_*]:border-sim-divider [&_>_*]:p-3
              [&_>_*]:rounded-[6px] [&_>_*]:min-w-0 [&_>_*]:wrap-anywhere
              [&_p]:text-[11px] [&_p]:leading-[1.7] [&_p]:mt-2 [&_pre]:max-h-60
              [&_pre]:overflow-auto [&_pre]:whitespace-pre-wrap [&_pre]:text-[10px]"
          >
            {difference.values.map((value, index) => {
              const text = JSON.stringify(value, null, 2) ?? '(absent)'

              return (
                <div key={index}>
                  <strong>{String.fromCharCode(65 + index)}</strong>

                  <pre>{text.slice(0, 8000)}</pre>

                  {text.length > 8000 && (
                    <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
                      Preview limited to 8,000 characters. Export the run JSON
                      for the complete value.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </details>
      ))}
    </section>
  )
}
