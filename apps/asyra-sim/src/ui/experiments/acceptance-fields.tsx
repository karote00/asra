import {
  ACCEPTANCE_LIMITS,
  validateAcceptanceExpression,
  type AcceptanceExpression
} from '../../analysis/contracts-rules'

const clearance = (value: number): AcceptanceExpression => ({
  kind: 'clearance',
  operator: 'above',
  value
})

const countNodes = (node: AcceptanceExpression): number =>
  node.kind === 'all' || node.kind === 'any'
    ? 1 + node.conditions.reduce((sum, child) => sum + countNodes(child), 0)
    : 1

export function AcceptanceFields({
  value,
  baseline,
  onChange
}: {
  value?: AcceptanceExpression
  baseline: number
  onChange: (value?: AcceptanceExpression) => void
}) {
  let error = ''

  if (value) {
    try {
      validateAcceptanceExpression(value)
    } catch (reason) {
      error =
        reason instanceof Error
          ? reason.message
          : 'Invalid acceptance expression'
    }
  }

  const total = value ? countNodes(value) : 0

  return (
    <details className="acceptance-fields [&_>_p]:my-[10px] [&_>_p]:mx-0">
      <summary>
        User acceptance rules{' '}
        <span>
          {value
            ? `${total}/${ACCEPTANCE_LIMITS.nodes} nodes`
            : 'Baseline only'}
        </span>
      </summary>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        These conditions change only your verdict. Method findings and
        incomplete evidence remain visible. All conditions cover the
        experiment's full pair scope.
      </p>

      {value ? (
        <>
          <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
            The minimum-clearance field remains the method's baseline threshold.
            Additional rules do not silently retune the solver. Changing a node
            type replaces its contents.
          </p>

          <AcceptanceNode
            value={value}
            onChange={onChange}
            path="1"
            depth={1}
            total={total}
            baseline={baseline}
          />

          <button onClick={() => onChange(undefined)}>
            Use baseline verdict only
          </button>
        </>
      ) : (
        <button onClick={() => onChange(clearance(baseline))}>
          Add acceptance conditions
        </button>
      )}

      {error && (
        <p
          className="inline-error text-sim-error-text bg-sim-error p-[11px] rounded-[5px]
            text-[11px] leading-[1.6] wrap-anywhere"
        >
          {error}. Save and preflight will reject this draft.
        </p>
      )}
    </details>
  )
}

function AcceptanceNode({
  value,
  onChange,
  path,
  depth,
  total,
  baseline
}: {
  value: AcceptanceExpression
  onChange: (value: AcceptanceExpression) => void
  path: string
  depth: number
  total: number
  baseline: number
}) {
  const group = value.kind === 'all' || value.kind === 'any'

  const canGroup =
    group ||
    (depth < ACCEPTANCE_LIMITS.depth && total + 2 <= ACCEPTANCE_LIMITS.nodes)

  const select = (kind: string) => {
    if (kind === value.kind) return

    if (kind === 'all' || kind === 'any') {
      if (canGroup)
        onChange({
          kind,
          conditions: group ? value.conditions : [value, clearance(baseline)]
        })
    } else if (kind === 'penetration') onChange({ kind, expected: 'absent' })
    else if (kind === 'clearance') onChange(clearance(baseline))
  }

  return (
    <fieldset
      className="acceptance-node min-w-0 p-[10px] my-[10px] mx-0 border border-sim-border
        rounded-[6px] grid gap-[9px] [&_legend]:text-sim-secondary
        [&_legend]:text-[10px] [&_legend]:py-0 [&_legend]:px-[5px]
        [&_select]:p-[6px] [&_select]:text-[10px] [&_input]:p-[6px]
        [&_input]:text-[10px] [&_.field-pair]:gap-[6px] [&_.acceptance-node]:m-0
        [&_.acceptance-node]:bg-sim-raised [&_.text-button]:text-[9px]
        [&_.text-button]:pt-1 [&_.text-button]:px-0 [&_.text-button]:pb-0"
    >
      <legend>Condition {path}</legend>

      <label>
        Condition type
        <select
          aria-label={`Condition ${path} type`}
          value={value.kind}
          onChange={(event) => select(event.target.value)}
        >
          <option value="clearance">Minimum clearance</option>

          <option value="penetration">Penetration evidence</option>

          <option value="all" disabled={!canGroup}>
            AND — all conditions
          </option>

          <option value="any" disabled={!canGroup}>
            OR — any condition
          </option>
        </select>
      </label>

      {value.kind === 'clearance' && (
        <div className="field-pair grid grid-cols-[1fr_1fr] gap-[10px]">
          <label>
            Comparison
            <select
              aria-label={`Condition ${path} comparison`}
              value={value.operator}
              onChange={(event) => {
                const operator = event.target.value

                if (operator === 'above' || operator === 'below')
                  onChange({ ...value, operator })
              }}
            >
              <option value="above">Strictly above</option>

              <option value="below">Strictly below</option>
            </select>
          </label>

          <label>
            Threshold (mm)
            <input
              aria-label={`Condition ${path} threshold (mm)`}
              type="number"
              min="0"
              max="20000"
              step="any"
              value={Number.isFinite(value.value) ? value.value * 1000 : ''}
              onChange={(event) =>
                onChange({
                  ...value,
                  value:
                    event.target.value === ''
                      ? NaN
                      : Number(event.target.value) / 1000
                })
              }
            />
          </label>
        </div>
      )}

      {value.kind === 'penetration' && (
        <label>
          Expected evidence
          <select
            aria-label={`Condition ${path} expected penetration`}
            value={value.expected}
            onChange={(event) => {
              const expected = event.target.value

              if (expected === 'present' || expected === 'absent')
                onChange({ ...value, expected })
            }}
          >
            <option value="absent">Proven separation</option>

            <option value="present">Established penetration</option>
          </select>
        </label>
      )}

      {(value.kind === 'all' || value.kind === 'any') && (
        <>
          {value.conditions.map((child, index) => (
            <div key={index}>
              <AcceptanceNode
                value={child}
                onChange={(next) =>
                  onChange({
                    ...value,
                    conditions: value.conditions.map((item, i) =>
                      i === index ? next : item
                    )
                  })
                }
                path={`${path}.${index + 1}`}
                depth={depth + 1}
                total={total}
                baseline={baseline}
              />

              <button
                className="text-button border-0 py-[5px] px-0 bg-transparent text-[11px] text-left"
                disabled={value.conditions.length <= 2}
                onClick={() =>
                  onChange({
                    ...value,
                    conditions: value.conditions.filter((_, i) => i !== index)
                  })
                }
                aria-label={`Remove condition ${path}.${index + 1}`}
              >
                Remove condition
              </button>
            </div>
          ))}

          <button
            disabled={
              depth >= ACCEPTANCE_LIMITS.depth ||
              value.conditions.length >= ACCEPTANCE_LIMITS.children ||
              total >= ACCEPTANCE_LIMITS.nodes
            }
            onClick={() =>
              onChange({
                ...value,
                conditions: [...value.conditions, clearance(baseline)]
              })
            }
            aria-label={`Add condition to ${path}`}
          >
            Add condition
          </button>
        </>
      )}
    </fieldset>
  )
}
