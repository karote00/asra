import { useRef, useState } from 'react'
import type { Vec3 } from '../domain/math'

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
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        step={step}
        value={draft ?? value}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (
            !cancelled.current &&
            draft !== null &&
            draft.trim() !== '' &&
            Number.isFinite(Number(draft))
          )
            onChange(Number(draft))
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
    <fieldset className="vector-field">
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
    <div className="error-notice" role="alert">
      <span>{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss error">
        ×
      </button>
    </div>
  )
}
