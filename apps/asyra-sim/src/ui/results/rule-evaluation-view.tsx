import type { RuleEvaluation } from '../../analysis/result-rules'

export function RuleEvaluationView({ value }: { value: RuleEvaluation }) {
  return (
    <details className="rule-evaluation wrap-anywhere" open>
      <summary>
        User acceptance evaluation <span>{value.value}</span>
      </summary>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        This is your rule evaluation, not a safety approval. A successful user
        verdict requires completed execution and complete coverage; method
        findings are unchanged.
      </p>

      <EvaluationNode value={value} path="1" />
    </details>
  )
}

function EvaluationNode({
  value,
  path
}: {
  value: RuleEvaluation
  path: string
}) {
  return (
    <div
      className="evaluation-node [border-left:2px_solid_var(--sim-divider)] pt-2 pr-0
        pb-1 pl-[10px] mt-2 text-[10px] [&_>_p:first-child]:font-[650]
        [&_>_p:first-child]:mb-[3px]"
    >
      <p>
        Condition {path} - {value.value}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        {value.reason}
      </p>

      {value.children?.map((child, index) => (
        <EvaluationNode
          key={index}
          value={child}
          path={`${path}.${index + 1}`}
        />
      ))}
    </div>
  )
}
