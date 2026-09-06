import type { Body, Workcell } from '../../domain/workcell'
import { CommittedInput } from '../shared/fields'
import { useViewValue } from '../shared/use-view-value'
import type { ReadonlyView, ViewSource } from '../shared/view-source'
import type { BodySource, DisplayUnits } from './body-subscriptions'

interface FieldProps {
  source: BodySource
  update: (patch: Partial<Body>) => void
}

export function BodyHeading({ source }: { source: BodySource }) {
  const name = useViewValue(source, (body) => body.name)

  const role = useViewValue(source, (body) => body.role)

  return (
    <div
      className="panel-heading flex items-center justify-between pt-[23px] px-5 pb-[17px]
          gap-[10px] [&_h2]:mt-[6px]"
    >
      <div>
        <span className="eyebrow text-[9px] tracking-[1.3px] text-sim-muted font-bold">
          PROPERTIES
        </span>

        <h2>{name}</h2>
      </div>

      <span className="role-tag text-[10px] bg-sim-subtle text-sim-secondary py-1 px-[7px] rounded-[4px]">
        {role}
      </span>
    </div>
  )
}

export function BodyName({ source, update }: FieldProps) {
  const name = useViewValue(source, (body) => body.name)

  return (
    <label>
      Name
      <CommittedInput
        aria-label="Object name"
        maxLength={200}
        value={name}
        onCommit={(name) =>
          update({
            name
          })
        }
      />
    </label>
  )
}

export function BodyRole({ source, update }: FieldProps) {
  const role = useViewValue(source, (body) => body.role)

  return (
    <label>
      Body role
      <select
        aria-label="Body role"
        value={role}
        onChange={(event) =>
          update({
            role: event.target.value as Body['role']
          })
        }
      >
        {['robot', 'link', 'tool', 'workpiece', 'fixture', 'group'].map(
          (role) => (
            <option key={role}>{role}</option>
          )
        )}
      </select>
    </label>
  )
}

export function BodyVisibility({ source, update }: FieldProps) {
  const visible = useViewValue(source, (body) => body.visible)

  return (
    <label className="checkbox flex-row items-center gap-[6px] [&_span]:text-sim-muted [&_span]:font-normal">
      <input
        type="checkbox"
        checked={visible}
        onChange={(event) =>
          update({
            visible: event.target.checked
          })
        }
      />
      Visible in viewport <span>(not analysis scope)</span>
    </label>
  )
}

export function BodyColor({ source, update }: FieldProps) {
  const color = useViewValue(source, (body) => body.color)

  return (
    <label>
      Display color
      <CommittedInput
        aria-label="Display color"
        type="color"
        value={`#${color.toString(16).padStart(6, '0')}`}
        onCommit={(color) =>
          update({
            color: parseInt(color.slice(1), 16)
          })
        }
      />
    </label>
  )
}

export function BodyUnits({ units }: { units: ViewSource<DisplayUnits> }) {
  const lengthUnit = useViewValue(units, (value) => value.lengthUnit)

  const angleUnit = useViewValue(units, (value) => value.angleUnit)

  const setLengthUnit = (lengthUnit: DisplayUnits['lengthUnit']) =>
    units.publish({ ...units.getSnapshot(), lengthUnit })

  const setAngleUnit = (angleUnit: DisplayUnits['angleUnit']) =>
    units.publish({ ...units.getSnapshot(), angleUnit })

  return (
    <div className="field-pair grid grid-cols-[1fr_1fr] gap-[10px]">
      <label>
        Length unit
        <select
          aria-label="Length unit"
          value={lengthUnit}
          onChange={(event) => setLengthUnit(event.target.value as 'm' | 'mm')}
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
  )
}

function ParentOption({
  source,
  id
}: {
  source: ReadonlyView<Workcell | null>
  id: string
}) {
  const name = useViewValue(
    source,
    (cell) => cell?.bodies.find((body) => body.id === id)?.name
  )

  return <option value={id}>{name}</option>
}

export function BodyParent({
  source,
  workcell,
  update
}: FieldProps & { workcell: ReadonlyView<Workcell | null> }) {
  const id = source.getSnapshot().id

  const parentId = useViewValue(source, (body) => body.parentId)

  const membership = useViewValue(workcell, (cell) =>
    JSON.stringify(
      cell?.bodies.filter((body) => body.id !== id).map((body) => body.id) ?? []
    )
  )

  const ids = JSON.parse(membership) as string[]

  return (
    <label>
      Parent frame
      <select
        aria-label="Parent frame"
        value={parentId ?? ''}
        onChange={(event) => update({ parentId: event.target.value || null })}
      >
        <option value="">Workcell origin</option>

        {ids.map((id) => (
          <ParentOption key={id} id={id} source={workcell} />
        ))}
      </select>
    </label>
  )
}
