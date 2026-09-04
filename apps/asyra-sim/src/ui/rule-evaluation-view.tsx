import type { RuleEvaluation } from '../analysis/result-rules'

export function RuleEvaluationView({ value }: { value: RuleEvaluation }) {
  return (
    <details className="rule-evaluation" open>
      <summary>
        User acceptance evaluation <span>{value.value}</span>
      </summary>
      <p className="hint">
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
    <div className="evaluation-node">
      <p>
        Condition {path} · {value.value}
      </p>
      <p className="hint">{value.reason}</p>
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
