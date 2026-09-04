import type {
  ExperimentMethodSelection,
  MethodDescriptor
} from '../analysis/contracts'
import {
  defaultMethodParameters,
  validParameterValues
} from '../extensions/descriptor'
import { MethodDetails } from './method-details'

export function MethodFields({
  value,
  methods,
  onChange
}: {
  value: ExperimentMethodSelection
  methods: readonly MethodDescriptor[]
  onChange: (value: ExperimentMethodSelection) => void
}) {
  const selected = methods.find(
    (item) => item.id === value.id && item.version === value.version
  )
  const update = (key: string, entry?: number | string | boolean) => {
    const parameters = Object.fromEntries(
      Object.entries(value.settings.parameters ?? {}).filter(
        ([name]) => name !== key
      )
    )
    if (entry !== undefined) parameters[key] = entry
    onChange({ ...value, settings: { ...value.settings, parameters } })
  }
  return (
    <>
      <label>
        Method
        <select
          aria-label="Analysis method"
          value={`${value.id}@${value.version}`}
          onChange={(event) => {
            const method = methods.find(
              (item) => `${item.id}@${item.version}` === event.target.value
            )
            if (method)
              onChange({
                id: method.id,
                version: method.version,
                settings: {
                  ...value.settings,
                  parameters: defaultMethodParameters(
                    method.parameterSchema ?? {}
                  )
                }
              })
          }}
        >
          {!selected && (
            <option value={`${value.id}@${value.version}`}>
              {value.id}@{value.version} (unavailable)
            </option>
          )}
          {methods.map((item) => (
            <option
              key={`${item.id}@${item.version}`}
              value={`${item.id}@${item.version}`}
            >
              {item.manifest?.name ?? item.id} · {item.version}
            </option>
          ))}
        </select>
      </label>
      {!selected && (
        <p className="hint">
          Method unavailable. Historical results remain readable; install the
          exact version before rerunning.
        </p>
      )}
      {selected && (
        <>
          <MethodDetails descriptor={selected} />
          {Object.entries(selected.parameterSchema ?? {}).map(
            ([key, field]) => {
              const current = value.settings.parameters?.[key],
                label = `Method parameter ${key}`
              let control
              if (field.kind === 'number')
                control = (
                  <input
                    aria-label={label}
                    type="number"
                    min={field.min}
                    max={field.max}
                    step="any"
                    value={
                      typeof current === 'number' && Number.isFinite(current)
                        ? current
                        : ''
                    }
                    onChange={(event) =>
                      update(
                        key,
                        event.target.value === ''
                          ? undefined
                          : Number(event.target.value)
                      )
                    }
                  />
                )
              else if (field.kind === 'boolean')
                control = (
                  <select
                    aria-label={label}
                    value={typeof current === 'boolean' ? String(current) : ''}
                    onChange={(event) =>
                      update(
                        key,
                        event.target.value === ''
                          ? undefined
                          : event.target.value === 'true'
                      )
                    }
                  >
                    <option value="">Choose a value</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                )
              else
                control = (
                  <select
                    aria-label={label}
                    value={typeof current === 'string' ? current : ''}
                    onChange={(event) =>
                      update(key, event.target.value || undefined)
                    }
                  >
                    <option value="">Choose a value</option>
                    {field.values.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                )
              return (
                <label key={key}>
                  {field.label}
                  {field.kind === 'number' ? ` (${field.unit})` : ''}
                  {control}
                </label>
              )
            }
          )}
          {!validParameterValues(
            selected.parameterSchema ?? {},
            value.settings.parameters ?? {}
          ) && (
            <p className="hint">
              Required method parameters are missing or outside their declared
              limits. Preflight will block execution.
            </p>
          )}
        </>
      )}
    </>
  )
}
