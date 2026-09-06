import { Viewport } from '../viewport/viewport'
import { useWorkbenchField, useWorkbenchValue } from './workbench-context'

export function ViewportPanel() {
  return (
    <section
      className="viewport-panel relative bg-[#101f2a] min-w-0 overflow-hidden"
      aria-label="3D workcell"
    >
      <ViewportOptions />

      <ViewportSurface />

      <ViewportSummary />
    </section>
  )
}

function ViewportOptions() {
  const grid = useWorkbenchField('grid')

  const setGrid = useWorkbenchField('setGrid')

  const wireframe = useWorkbenchField('wireframe')

  const setWireframe = useWorkbenchField('setWireframe')

  const ready = useWorkbenchField('ready')

  return (
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
  )
}

function ViewportSurface() {
  const host = useWorkbenchField('host')

  const setHost = useWorkbenchField('setHost')

  const selectedId = useWorkbenchField('selectedId')

  const playback = useWorkbenchField('playback')

  const visualPreview = useWorkbenchField('visualPreview')

  const grid = useWorkbenchField('grid')

  const wireframe = useWorkbenchField('wireframe')

  const runtime = useWorkbenchField('runtime')

  const isCurrent = useWorkbenchField('isCurrent')

  const workcell = useWorkbenchField('workcell')

  const select = useWorkbenchField('select')

  const generation = useWorkbenchValue((state) => state.lifecycle.generation)

  return (
    <>
      <div
        className="canvas-host absolute inset-0 touch-none [&_canvas]:block [&_canvas]:max-w-full"
        ref={setHost}
        data-testid="workcell-canvas"
      />

      <Viewport
        key={generation}
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
    </>
  )
}

function ViewportSummary() {
  return (
    <div
      className="viewport-summary absolute bottom-0 h-[37px] left-0 right-0
          bg-[#0c1922cc] border-t border-t-[#2a3d49] flex items-center
          justify-between py-0 px-[18px] gap-[10px] text-[#8da6b4] text-[10px]
          [&_>_span:first-child]:text-[#c4d6df]
          max-[800px]:[&_>_span:last-child]:hidden"
    >
      <ViewportCaption />

      <ViewportPartsCount />
    </div>
  )
}

function ViewportCaption() {
  const visualPreview = useWorkbenchValue((state) => !!state.visualPreview)

  const playback = useWorkbenchField('playback')

  const name = useWorkbenchValue((state) => state.selected?.name)

  return (
    <>
      {visualPreview && <strong>Visual preview - not accepted</strong>}

      <span>
        {playback
          ? `${playback.historical ? 'Historical run replay' : 'Sampled preview'} - ${playback.time.toFixed(4)} s`
          : (name ?? 'Select an object to inspect')}
      </span>
    </>
  )
}

function ViewportPartsCount() {
  const workcell = useWorkbenchField('workcell')

  const count =
    workcell?.bodies.reduce(
      (sum, body) => sum + (body.visuals?.length || body.colliders.length),
      0
    ) ?? 0

  return <span>{count} analysis parts - meters</span>
}
