import { useExperimentController } from './use-experiment-controller'

type Props = Pick<
  ReturnType<typeof useExperimentController>,
  'draft' | 'preflight' | 'warnings' | 'setWarnings' | 'changed'
>

export function PreflightView({
  draft,
  preflight,
  warnings,
  setWarnings,
  changed
}: Props) {
  return (
    <>
      {preflight && (
        <section
          className="preflight-card grid gap-[10px] p-[13px] rounded-[7px] border
            border-sim-border bg-sim-raised [&_progress]:w-full [&_progress]:h-[7px]
            [&_progress]:accent-sim-focus"
          data-testid="preflight-report"
        >
          <div className="section-heading flex items-center justify-between [&_>_span]:text-[10px] [&_>_span]:text-sim-muted">
            <h3>Preflight</h3>

            <span>
              {preflight.estimate.pairCount} pairs -{' '}
              {preflight.estimate.workUnits} work units
            </span>
          </div>

          <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
            No reliable time estimate yet.
          </p>

          {preflight.blockers.map((issue, index) => (
            <p
              className="issue flex flex-col gap-[6px] p-[10px] text-[11px] leading-[1.6]
                rounded-[5px] [&.blocker]:text-sim-error-text [&.blocker]:bg-sim-error
                [&.assumption]:bg-sim-warning [&.assumption]:text-sim-warning-text
                [&.warning]:bg-sim-warning [&.warning]:text-sim-warning-text
                [&.checkbox]:flex-row [&.checkbox]:items-start
                [&.checkbox_input]:shrink-0 [&.ready]:bg-sim-success
                [&.ready]:text-sim-success-text blocker"
              key={index}
            >
              <strong>Blocked - {issue.code}</strong>

              {issue.message}
            </p>
          ))}

          {preflight.assumptions.map((issue, index) => (
            <div
              className="issue flex flex-col gap-[6px] p-[10px] text-[11px] leading-[1.6]
                rounded-[5px] [&.blocker]:text-sim-error-text [&.blocker]:bg-sim-error
                [&.assumption]:bg-sim-warning [&.assumption]:text-sim-warning-text
                [&.warning]:bg-sim-warning [&.warning]:text-sim-warning-text
                [&.checkbox]:flex-row [&.checkbox]:items-start
                [&.checkbox_input]:shrink-0 [&.ready]:bg-sim-success
                [&.ready]:text-sim-success-text assumption"
              key={index}
            >
              <strong>Assumption</strong>

              <span>{issue.message}</span>

              {issue.bodyIds && (
                <button
                  onClick={() =>
                    changed({
                      ...draft,
                      scope: {
                        ...draft.scope,
                        acknowledgedExcludedVisibleBodyIds: [
                          ...new Set([
                            ...draft.scope.acknowledgedExcludedVisibleBodyIds,
                            ...(issue.bodyIds ?? [])
                          ])
                        ]
                      }
                    })
                  }
                >
                  Acknowledge in draft
                </button>
              )}
            </div>
          ))}

          {preflight.resourceWarnings.map((issue) => (
            <label
              className="issue flex flex-col gap-[6px] p-[10px] text-[11px] leading-[1.6]
                rounded-[5px] [&.blocker]:text-sim-error-text [&.blocker]:bg-sim-error
                [&.assumption]:bg-sim-warning [&.assumption]:text-sim-warning-text
                [&.warning]:bg-sim-warning [&.warning]:text-sim-warning-text
                [&.checkbox]:flex-row [&.checkbox]:items-start
                [&.checkbox_input]:shrink-0 [&.ready]:bg-sim-success
                [&.ready]:text-sim-success-text warning checkbox flex-row items-center
                gap-[6px] [&_span]:text-sim-muted [&_span]:font-normal"
              key={issue.code}
            >
              <input
                type="checkbox"
                checked={warnings.includes(issue.code)}
                onChange={(event) =>
                  setWarnings((current) =>
                    event.target.checked
                      ? [...new Set([...current, issue.code])]
                      : current.filter((code) => code !== issue.code)
                  )
                }
              />

              <span>{issue.message}</span>
            </label>
          ))}

          {!preflight.blockers.length &&
            !preflight.assumptions.length &&
            !preflight.resourceWarnings.length && (
              <p
                className="issue flex flex-col gap-[6px] p-[10px] text-[11px] leading-[1.6]
                  rounded-[5px] [&.blocker]:text-sim-error-text [&.blocker]:bg-sim-error
                  [&.assumption]:bg-sim-warning [&.assumption]:text-sim-warning-text
                  [&.warning]:bg-sim-warning [&.warning]:text-sim-warning-text
                  [&.checkbox]:flex-row [&.checkbox]:items-start
                  [&.checkbox_input]:shrink-0 [&.ready]:bg-sim-success
                  [&.ready]:text-sim-success-text ready"
              >
                Ready for formal local analysis.
              </p>
            )}
        </section>
      )}
    </>
  )
}
