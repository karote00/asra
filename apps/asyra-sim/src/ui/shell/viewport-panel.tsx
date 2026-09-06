import { memo } from 'react'
import { Viewport } from '../viewport/viewport'
import { useWorkbenchController } from './use-workbench-controller'

type Props = Pick<
  ReturnType<typeof useWorkbenchController>,
  | 'host'
  | 'setHost'
  | 'selectedId'
  | 'playback'
  | 'visualPreview'
  | 'wireframe'
  | 'setWireframe'
  | 'grid'
  | 'setGrid'
  | 'lifecycle'
  | 'runtime'
  | 'ready'
  | 'isCurrent'
  | 'workcell'
  | 'selected'
  | 'select'
>

export const ViewportPanel = memo(function ViewportPanel({
  host,
  setHost,
  selectedId,
  playback,
  visualPreview,
  wireframe,
  setWireframe,
  grid,
  setGrid,
  lifecycle,
  runtime,
  ready,
  isCurrent,
  workcell,
  selected,
  select
}: Props) {
  return (
    <section
      className="viewport-panel relative bg-[#101f2a] min-w-0 overflow-hidden"
      aria-label="3D workcell"
    >
      <div
        className="viewport-top absolute top-[18px] left-5 right-5 flex items-center
          justify-between z-1 pointer-events-none text-[#8fa8b7] text-[9px]
          tracking-[1px] [&_b]:ml-[13px] [&_b]:text-[#b9cbd4] [&_b]:font-medium
          [&_i]:inline-block [&_i]:w-[5px] [&_i]:h-[5px] [&_i]:rounded-full
          [&_i]:bg-[#62bda6] [&_i]:mr-2 [&_label]:pointer-events-auto
          [&_label]:flex-row [&_label]:items-center [&_label]:text-[10px]
          [&_label]:text-[#93a9b8] max-[700px]:left-3 max-[700px]:right-3
          max-[700px]:[&_>_span]:hidden"
      >
        <span>
          <i />
          PERSPECTIVE <b>Y ↑</b>
        </span>

        <label>
          <input
            type="checkbox"
            checked={grid}
            disabled={!ready}
            onChange={(event) => setGrid(event.target.checked)}
          />
          Grid
        </label>

        <label>
          <input
            type="checkbox"
            checked={wireframe}
            disabled={!ready}
            onChange={(event) => setWireframe(event.target.checked)}
          />
          Wireframe
        </label>
      </div>

      <div
        className="canvas-host absolute inset-0 touch-none [&_canvas]:block [&_canvas]:max-w-full"
        ref={setHost}
        data-testid="workcell-canvas"
      />

      <Viewport
        key={lifecycle.generation}
        host={host}
        runtime={runtime}
        workcell={visualPreview?.workcell ?? playback?.workcell ?? workcell}
        selectedId={playback?.bodyIds[0] ?? selectedId}
        grid={grid}
        wireframe={wireframe}
        joints={playback?.joints}
        pending={visualPreview?.prepared}
        onSelect={select}
        isCurrent={isCurrent}
      />

      <div
        className="viewport-summary absolute bottom-0 h-[37px] left-0 right-0
          bg-[#0c1922cc] border-t border-t-[#2a3d49] flex items-center
          justify-between py-0 px-[18px] gap-[10px] text-[#8da6b4] text-[10px]
          [&_>_span:first-child]:text-[#c4d6df]
          max-[800px]:[&_>_span:last-child]:hidden"
      >
        {visualPreview && <strong>Visual preview - not accepted</strong>}
        <span>
          {playback
            ? `${playback.historical ? 'Historical run replay' : 'Sampled preview'} - ${playback.time.toFixed(4)} s`
            : (selected?.name ?? 'Select an object to inspect')}
        </span>

        <span>
          {workcell?.bodies.reduce(
            (sum, body) =>
              sum + (body.visuals?.length || body.colliders.length),
            0
          ) ?? 0}{' '}
          analysis parts - meters
        </span>
      </div>
    </section>
  )
})
