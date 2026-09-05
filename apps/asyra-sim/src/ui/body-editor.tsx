import { useState } from 'react'
import { IDENTITY_POSE } from '../domain/math'
import type { Body, Collider, Geometry, Workcell } from '../domain/workcell'
import { CommittedInput, NumberField, VectorField } from './fields'
import { RotationFields } from './rotation-fields'
import { VisualPlacementFields } from './visual-placement-fields'

function newGeometry(kind: string): Geometry {
  if (kind === 'box') return { kind: 'box', size: [0.2, 0.2, 0.2] }
  if (kind === 'sphere') return { kind: 'sphere', radius: 0.1 }
  return { kind: 'capsule', radius: 0.1, length: 0.3 }
}

export function BodyEditor({
  body,
  workcell,
  onChange,
  onRemove
}: {
  body: Body
  workcell: Workcell
  onChange: (body: Body) => Promise<void>
  onRemove: () => void
}) {
  const update = (next: Body) => {
    void onChange(next)
  }
  const [lengthUnit, setLengthUnit] = useState<'m' | 'mm'>('m')
  const [angleUnit, setAngleUnit] = useState<'rad' | 'deg'>('deg')
  const lengthScale = lengthUnit === 'mm' ? 1000 : 1,
    angleScale = angleUnit === 'deg' ? 180 / Math.PI : 1
  const shape = (id: string, change: Partial<Collider>) =>
    update({
      ...body,
      colliders: body.colliders.map((item) =>
        item.id === id ? { ...item, ...change } : item
      )
    })
  const geometry = (id: string, value: Geometry) =>
    shape(id, { geometry: value })
  return (
    <div className="body-editor">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PROPERTIES</span>
          <h2>{body.name}</h2>
        </div>
        <span className="role-tag">{body.role}</span>
      </div>
      <div className="editor-content">
        <details className="visual-bindings">
          <summary>
            Original parts <span>{body.visuals?.length ?? 0}</span>
          </summary>
          <p className="hint">
            Import a GLB in Experiments to attach a complete part. Placement
            affects both display and analysis. Each field edit is one Undo
            action.
          </p>
          {(body.visuals ?? []).map((binding, index) => (
            <fieldset
              key={binding.id}
              aria-label={`Original part ${index + 1}`}
            >
              <legend>Part {index + 1}</legend>
              <p className="asset-digest">SHA-256: {binding.assetId}</p>
              <VisualPlacementFields
                value={binding}
                onChange={(placement) =>
                  update({
                    ...body,
                    visuals: body.visuals?.map((entry) =>
                      entry.id === binding.id
                        ? { ...entry, ...placement }
                        : entry
                    )
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  update({
                    ...body,
                    colliders: body.visuals?.length === 1 ? [] : body.colliders,
                    visuals: body.visuals?.filter(
                      (entry) => entry.id !== binding.id
                    )
                  })
                }
              >
                Remove original part {index + 1}
              </button>
            </fieldset>
          ))}
        </details>
        <label>
          Name
          <CommittedInput
            aria-label="Object name"
            maxLength={200}
            value={body.name}
            onCommit={(name) => update({ ...body, name })}
          />
        </label>
        <div className="field-pair">
          <label>
            Length unit
            <select
              aria-label="Length unit"
              value={lengthUnit}
              onChange={(event) =>
                setLengthUnit(event.target.value as 'm' | 'mm')
              }
            >
              <option value="m">Meters (m)</option>
              <option value="mm">Millimeters (mm)</option>
            </select>
          </label>
          <label>
            Angle unit
            <select
              aria-label="Angle unit"
              value={angleUnit}
              onChange={(event) =>
                setAngleUnit(event.target.value as 'deg' | 'rad')
              }
            >
              <option value="deg">Degrees (°)</option>
              <option value="rad">Radians</option>
            </select>
          </label>
        </div>
        <label>
          Parent frame
          <select
            aria-label="Parent frame"
            value={body.parentId ?? ''}
            onChange={(event) =>
              update({ ...body, parentId: event.target.value || null })
            }
          >
            <option value="">Workcell origin</option>
            {workcell.bodies
              .filter((item) => item.id !== body.id)
              .map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Body role
          <select
            aria-label="Body role"
            value={body.role}
            onChange={(event) =>
              update({ ...body, role: event.target.value as Body['role'] })
            }
          >
            {['robot', 'link', 'tool', 'workpiece', 'fixture', 'group'].map(
              (role) => (
                <option key={role}>{role}</option>
              )
            )}
          </select>
        </label>
        <VectorField
          label={`Mount position (${lengthUnit})`}
          value={body.pose.position}
          scale={lengthScale}
          onChange={(position) =>
            update({ ...body, pose: { ...body.pose, position } })
          }
        />
        <details>
          <summary>Mount rotation</summary>
          <p className="hint">
            Set an absolute axis-angle rotation. Current quaternion:{' '}
            {body.pose.rotation.map((v) => v.toFixed(4)).join(', ')}.
          </p>
          <RotationFields
            axisLabel="Rotation axis"
            angleLabel={`Rotation angle (${angleUnit})`}
            angleScale={angleScale}
            value={body.pose.rotation}
            onChange={(rotation) =>
              update({ ...body, pose: { ...body.pose, rotation } })
            }
          />
        </details>
        <details open={body.joint.kind !== 'fixed'}>
          <summary>
            Joint definition <span>{body.joint.kind}</span>
          </summary>
          <label>
            Joint type
            <select
              aria-label="Joint type"
              value={body.joint.kind}
              onChange={(event) =>
                update({
                  ...body,
                  joint: {
                    ...body.joint,
                    kind: event.target.value as Body['joint']['kind']
                  }
                })
              }
            >
              <option>fixed</option>
              <option>revolute</option>
              <option>prismatic</option>
            </select>
          </label>
          {body.joint.kind !== 'fixed' && (
            <>
              <VectorField
                label="Joint axis"
                value={body.joint.axis}
                onChange={(axis) =>
                  update({ ...body, joint: { ...body.joint, axis } })
                }
              />
              {(['min', 'value', 'max'] as const).map((key) => (
                <NumberField
                  key={key}
                  label={`Joint ${key} (${body.joint.kind === 'revolute' ? angleUnit : lengthUnit})`}
                  value={Number(
                    (
                      body.joint[key] *
                      (body.joint.kind === 'revolute'
                        ? angleScale
                        : lengthScale)
                    ).toPrecision(10)
                  )}
                  onChange={(value) =>
                    update({
                      ...body,
                      joint: {
                        ...body.joint,
                        [key]:
                          value /
                          (body.joint.kind === 'revolute'
                            ? angleScale
                            : lengthScale)
                      }
                    })
                  }
                />
              ))}
            </>
          )}
        </details>
        {!body.visuals?.length && (
          <section className="shape-list">
            <div className="section-heading">
              <h3>Native parts</h3>
              <span>{body.colliders.length} shapes</span>
            </div>
            <p className="hint">
              Use these only for genuinely simple parts. Imported parts are
              never replaced by these shapes. Empty bodies cannot enter
              analysis.
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
                    onChange={(size) =>
                      geometry(collider.id, { kind: 'box', size })
                    }
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
                  <p>
                    Original mesh geometry is edited through its source binding.
                  </p>
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
                  className="text-button danger"
                  onClick={() =>
                    update({
                      ...body,
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
              className="wide"
              onClick={() =>
                update({
                  ...body,
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
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={body.visible}
            onChange={(event) =>
              update({ ...body, visible: event.target.checked })
            }
          />
          Visible in viewport <span>(not analysis scope)</span>
        </label>
        <label>
          Display color
          <CommittedInput
            aria-label="Display color"
            type="color"
            value={`#${body.color.toString(16).padStart(6, '0')}`}
            onCommit={(color) =>
              update({
                ...body,
                color: parseInt(color.slice(1), 16)
              })
            }
          />
        </label>
        <button className="text-button danger" type="button" onClick={onRemove}>
          Delete object and descendants
        </button>
      </div>
    </div>
  )
}
