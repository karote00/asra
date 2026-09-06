import { useState } from 'react'
import type { Body, Workcell } from '../../domain/workcell'
import { ViewSource, type ReadonlyView } from '../shared/view-source'
import { useViewValue } from '../shared/use-view-value'
import { type BodySource, type DisplayUnits } from './body-subscriptions'
import {
  BodyHeading,
  BodyName,
  BodyUnits,
  BodyParent,
  BodyRole,
  BodyVisibility,
  BodyColor
} from './body-metadata'
import { MountFields } from './mount-fields'
import { JointFields } from './joint-fields'
import { OriginalParts } from './original-parts'
import { NativeParts } from './native-parts'
import { useBodyUpdate } from './use-body-update'

function NativeSection({
  source,
  units,
  update
}: {
  source: BodySource
  units: ReadonlyView<DisplayUnits>
  update: (patch: Partial<Body>) => void
}) {
  const hasOriginal = useViewValue(source, (body) => !!body.visuals?.length)

  return hasOriginal ? null : (
    <NativeParts source={source} units={units} update={update} />
  )
}

export function BodyEditor({
  body,
  workcell,
  onChange,
  onRemove
}: {
  body: BodySource
  workcell: ReadonlyView<Workcell | null>
  onChange: (body: Body) => Promise<void>
  onRemove: () => void
}) {
  const update = useBodyUpdate(body, onChange)

  const [units] = useState(
    () => new ViewSource<DisplayUnits>({ lengthUnit: 'm', angleUnit: 'deg' })
  )

  return (
    <div
      className="body-editor h-full flex flex-col [&_>_.panel-heading]:border-b
        [&_>_.panel-heading]:border-b-sim-divider [&_>_.panel-heading]:min-h-21
        [&_>_.panel-heading]:flex-none [&_h2]:max-w-50 [&_h2]:wrap-anywhere"
    >
      <BodyHeading source={body} />

      <div className="editor-content pt-[18px] px-[18px] pb-6 overflow-auto flex flex-col gap-[17px] flex-1 min-h-0">
        <OriginalParts source={body} update={update} />

        <BodyName source={body} update={update} />

        <BodyUnits units={units} />

        <BodyParent source={body} workcell={workcell} update={update} />

        <BodyRole source={body} update={update} />

        <MountFields source={body} units={units} update={update} />

        <JointFields source={body} units={units} update={update} />

        <NativeSection source={body} units={units} update={update} />

        <BodyVisibility source={body} update={update} />

        <BodyColor source={body} update={update} />

        <button
          className="text-button border-0 py-[5px] px-0 bg-transparent text-[11px] text-left danger text-sim-error-text"
          type="button"
          onClick={onRemove}
        >
          Delete object and descendants
        </button>
      </div>
    </div>
  )
}
