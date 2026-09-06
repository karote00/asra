import { useRef, useState, type ComponentProps } from 'react'
import type { Vec3 } from '../../domain/math'

export function CommittedInput({
  value,
  onCommit,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string | number
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState<{
    source: string | number
    text: string
  } | null>(null)

  if (draft !== null && draft.source !== value) setDraft(null)

  const cancelled = useRef(false)

  return (
    <input
      {...props}
      value={draft?.source === value ? draft.text : value}
      onChange={(event) =>
        setDraft({ source: value, text: event.target.value })
      }
      onBlur={() => {
        if (
          !cancelled.current &&
          draft?.source === value &&
          draft.text !== String(value)
        )
          onCommit(draft.text)

        cancelled.current = false

        setDraft(null)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()

          event.currentTarget.blur()
        }

        if (event.key === 'Escape') {
          event.preventDefault()

          cancelled.current = true

          setDraft(null)

          event.currentTarget.blur()
        }
      }}
    />
  )
}

export function NumberField({
  label,
  value,
  onChange,
  step = 0.01
}: {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
}) {
  return (
    <label className="number-field [&_span]:text-[10px]">
      <span>{label}</span>

      <CommittedInput
        aria-label={label}
        type="number"
        step={step}
        value={value}
        onCommit={(text) => {
          if (text.trim() !== '' && Number.isFinite(Number(text)))
            onChange(Number(text))
        }}
      />
    </label>
  )
}

export function VectorField({
  label,
  value,
  onChange,
  scale = 1
}: {
  label: string
  value: Vec3
  onChange: (value: Vec3) => void
  scale?: number
}) {
  return (
    <fieldset
      className="vector-field border-0 m-0 p-0 min-w-0 [&_legend]:text-[11px]
        [&_legend]:text-sim-secondary [&_legend]:font-semibold
        [&_legend]:mb-[6px] [&_>_div]:grid
        [&_>_div]:grid-cols-[repeat(3,_minmax(0,_1fr))] [&_>_div]:gap-[6px]
        [&_.number-field_span]:text-[0]
        [&_.number-field_span::first-letter]:text-[0] [&_input]:p-[7px]"
    >
      <legend>{label}</legend>

      <div>
        {value.map((entry, index) => (
          <NumberField
            key={index}
            label={`${label} ${'XYZ'[index]}`}
            value={Number((entry * scale).toPrecision(10))}
            onChange={(next) =>
              onChange(
                value.map((v, i) =>
                  i === index ? next / scale : v
                ) as unknown as Vec3
              )
            }
          />
        ))}
      </div>
    </fieldset>
  )
}

export function ErrorNotice({
  message,
  onDismiss
}: {
  message: string
  onDismiss: () => void
}) {
  return (
    <div
      className="error-notice flex items-center justify-between bg-sim-warning
        text-sim-warning-text py-[10px] px-5 border-b border-b-sim-warning-text
        gap-4 [&_button]:bg-transparent [&_button]:border-0"
      role="alert"
    >
      <span>{message}</span>

      <button onClick={onDismiss} aria-label="Dismiss error">
        ×
      </button>
    </div>
  )
}
