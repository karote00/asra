import { memo } from 'react'
import { IDENTITY_POSE } from '../../domain/math'
import type { Body, Collider, Geometry } from '../../domain/workcell'
import { NumberField, VectorField } from '../shared/fields'
import { newGeometry, shapeUpdate } from './native-part-edits'

export const NativeParts = memo(function NativeParts({
  body,
  update,
  lengthUnit,
  lengthScale
}: {
  body: Body
  lengthUnit: string
  lengthScale: number
  update: (patch: Partial<Body>) => void
}) {
  const shape = (id: string, change: Partial<Collider>) =>
    shapeUpdate(body, update, id, change)

  const geometry = (id: string, value: Geometry) =>
    shape(id, { geometry: value })

  return (
    <section className="shape-list flex flex-col gap-3">
      <div className="section-heading flex items-center justify-between [&_>_span]:text-[10px] [&_>_span]:text-sim-muted">
        <h3>Native parts</h3>

        <span>{body.colliders.length} shapes</span>
      </div>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Use these only for genuinely simple parts. Imported parts are never
        replaced by these shapes. Empty bodies cannot enter analysis.
      </p>

      {body.colliders.map((collider, index) => (
        <details key={collider.id} open>
          <summary>
            Shape {index + 1}
            <span>{collider.geometry.kind}</span>
          </summary>

          <label>
            Shape type
            <select
              aria-label={`Shape ${index + 1} type`}
              value={collider.geometry.kind}
              onChange={(event) =>
                geometry(collider.id, newGeometry(event.target.value))
              }
            >
              <option>box</option>

              <option>sphere</option>

              <option>capsule</option>
            </select>
          </label>

          {collider.geometry.kind === 'box' ? (
            <VectorField
              label={`Shape ${index + 1} size (${lengthUnit})`}
              value={collider.geometry.size}
              scale={lengthScale}
              onChange={(size) => geometry(collider.id, { kind: 'box', size })}
            />
          ) : null}
          {collider.geometry.kind === 'sphere' ||
          collider.geometry.kind === 'capsule' ? (
            <>
              <NumberField
                label={`Shape ${index + 1} radius (${lengthUnit})`}
                value={collider.geometry.radius * lengthScale}
                onChange={(radius) =>
                  geometry(collider.id, {
                    ...collider.geometry,
                    radius: radius / lengthScale
                  } as Geometry)
                }
              />

              {collider.geometry.kind === 'capsule' && (
                <NumberField
                  label={`Shape ${index + 1} length (${lengthUnit})`}
                  value={collider.geometry.length * lengthScale}
                  onChange={(length) =>
                    geometry(collider.id, {
                      ...collider.geometry,
                      length: length / lengthScale
                    } as Geometry)
                  }
                />
              )}
            </>
          ) : (
            <p>Original mesh geometry is edited through its source binding.</p>
          )}

          <VectorField
            label={`Shape ${index + 1} offset (${lengthUnit})`}
            value={collider.pose.position}
            scale={lengthScale}
            onChange={(position) =>
              shape(collider.id, { pose: { ...collider.pose, position } })
            }
          />

          <button
            type="button"
            className="text-button border-0 py-[5px] px-0 bg-transparent text-[11px] text-left danger text-sim-error-text"
            onClick={() =>
              update({
                colliders: body.colliders.filter(
                  (item) => item.id !== collider.id
                )
              })
            }
          >
            Remove shape
          </button>
        </details>
      ))}

      <button
        type="button"
        className="wide w-full"
        onClick={() =>
          update({
            colliders: [
              ...body.colliders,
              {
                id: crypto.randomUUID(),
                geometry: { kind: 'box', size: [0.2, 0.2, 0.2] },
                pose: IDENTITY_POSE
              }
            ]
          })
        }
      >
        + Add analysis shape
      </button>
    </section>
  )
})
