# Build a custom render boundary

Wrap a concrete rendering SDK behind `@asyra/render-engine` so canonical state,
Core, Render, and app Features remain engine-neutral.

## Prerequisites

- a concrete engine adapter owned by your app or provider package
- the public `@asyra/render-engine` contract
- `PresetProfiles.CUSTOM` when the app also uses `@asyra/preset`

## Ownership

Render Engine owns the semantic lifecycle, command, query, interaction, frame,
capability, and error contracts. Render owns projection and layer orchestration.
The app/provider owns the concrete SDK and adapter. Core stores one provider
before startup and does not inspect concrete engine resources.

## Public APIs

- `RenderEngine` and `RenderEngineProvider`
- `core.setRenderEngineProvider(...)`
- `PresetProfiles.CUSTOM` with `applyPreset(...)` when Preset is composed
- `new Render({ engineProvider })` only for intentional lower-level composition

## Where this runs

Put the adapter in an app-owned or dedicated provider package. Only that
boundary imports the browser Canvas API or a concrete SDK. The app bootstrap
passes a `RenderEngineProvider` to Core before startup; Render calls the
adapter's semantic commands after initialization.

## Implementation

The central job is translating engine-neutral draw operations into concrete
output. This is a complete Canvas 2D translation for the current public draw
union; place it behind your adapter's `execute({ type: 'draw' })` branch:

```ts
import type {
  RenderEngineDrawOperation,
  RenderEnginePaint
} from '@asyra/render-engine'

const toCanvasColor = (paint: RenderEnginePaint): string => {
  if (paint.resource) {
    throw new Error('Resolve the resource handle through the adapter first')
  }
  if (typeof paint.color === 'number') {
    return `#${paint.color.toString(16).padStart(6, '0')}`
  }
  return paint.color ?? '#000000'
}

export const drawToCanvas = (
  context: CanvasRenderingContext2D,
  operations: readonly RenderEngineDrawOperation[]
) => {
  let path = new Path2D()
  for (const operation of operations) {
    switch (operation.type) {
      case 'clear':
        context.clearRect(0, 0, context.canvas.width, context.canvas.height)
        path = new Path2D()
        break
      case 'rect':
        path.rect(operation.x, operation.y, operation.width, operation.height)
        break
      case 'ellipse':
        path.ellipse(
          operation.x,
          operation.y,
          operation.radiusX,
          operation.radiusY,
          0,
          0,
          Math.PI * 2
        )
        break
      case 'circle':
        path.arc(operation.x, operation.y, operation.radius, 0, Math.PI * 2)
        break
      case 'poly': {
        const [first, ...rest] = operation.points
        if (!first) break
        path.moveTo(first.x, first.y)
        rest.forEach(({ x, y }) => path.lineTo(x, y))
        if (operation.close) path.closePath()
        break
      }
      case 'move-to':
        path.moveTo(operation.x, operation.y)
        break
      case 'line-to':
        path.lineTo(operation.x, operation.y)
        break
      case 'bezier-curve-to':
        path.bezierCurveTo(
          operation.controlPoint1.x,
          operation.controlPoint1.y,
          operation.controlPoint2.x,
          operation.controlPoint2.y,
          operation.destination.x,
          operation.destination.y
        )
        break
      case 'close-path':
        path.closePath()
        break
      case 'fill':
        context.save()
        context.globalAlpha = operation.paint.alpha ?? 1
        context.fillStyle = toCanvasColor(operation.paint)
        context.fill(path)
        context.restore()
        break
      case 'stroke':
        context.save()
        context.globalAlpha = operation.paint.alpha ?? 1
        context.strokeStyle = toCanvasColor(operation.paint)
        context.lineWidth = operation.width
        context.stroke(path)
        context.restore()
        break
    }
  }
}
```

Back each graphics handle with an object-owned Canvas surface or retained
`Path2D` record. If multiple objects share one visible Canvas, retain their
paths and redraw the ordered object tree during `flush`; clearing one object
must not erase unrelated handles. Your `RenderEngine` implementation also
creates the visible `<canvas>` in `initialize(...)`, implements resize and
viewport commands, answers bounds/coordinate/hit queries, normalizes pointer
events, schedules one frame callback, and releases its DOM/resources in
`destroy()`. Declare only capabilities that those methods truly support.

## Flow

1. Implement `initialize`, `execute`, `query`, interaction subscription,
   request/cancel frame, and `destroy` behind one adapter.
2. Keep concrete SDK objects and resources private.
3. Translate semantic commands, as `drawToCanvas(...)` does above.
4. For Core composition, bind the provider before `core.start(...)`.
5. Let startup invoke and validate the provider exactly once.
6. Treat missing capability, invalid engine, initialization, and cleanup errors
   as real failures.

Follow the
[replacement golden path](../../ai/framework/golden-paths/replace-render-engine.md)
for the composition call site.

## Expected result

Render sends the same semantic draw command regardless of whether the adapter
targets Canvas, SVG, WebGL, a BIM engine, or another SDK. The
adapter creates real output, returns normalized query/interaction results, and
remains the only module that sees concrete engine objects.

When no provider is selected, direct `Render.init()` fails. Core's narrow
default-renderer no-provider compatibility path must not be copied into a
custom adapter or described as a Headless runtime.

## Validate

Add product integration tests for canonical create/update/remove, viewport, hit
testing, interaction, load/replay, undo/redo, resource release, and instance
isolation. Inspect real output in the selected engine, but keep canonical
geometry and transaction assertions at their source owners rather than using
pixels as the only oracle.

## Forbidden shortcuts

- no concrete SDK import outside the provider package
- no engine object stored as canonical product state
- no fallback to Pixi after provider or capability failure
- no binding or replacing the provider after startup
- no pixel-only oracle for canonical geometry or transaction correctness
- no renderer-specific branch in Core

## Canonical sources

- [Render contract](../../ai/framework/packages/render.md)
- [Render Engine contract](../../ai/framework/packages/render-engine.md)
- [Replace the default engine](../../ai/framework/golden-paths/replace-render-engine.md)

## Next

- [Learn registration and replacement](../learn/projection-registration-replacement.md)
- [Read the Render Engine guide](../reference/packages/render-engine.md)
