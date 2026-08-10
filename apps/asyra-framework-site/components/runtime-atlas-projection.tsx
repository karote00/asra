'use client'

import { useEffect, useRef } from 'react'

interface ProjectionOutput {
  canonical?: {
    id?: string
    label?: string
    revision?: number
    status?: string
    bounds?: { x?: number; y?: number; width?: number; height?: number }
  }
  projections?: {
    canvas?: { x?: number; y?: number; width?: number; height?: number }
    hierarchy?: { id?: string; label?: string; parentId?: string }[]
    properties?: Record<string, unknown>
    serialized?: unknown
  }
}

const asProjectionOutput = (value: unknown): ProjectionOutput =>
  value && typeof value === 'object' ? (value as ProjectionOutput) : {}

const DRAWING_WIDTH = 360
const DRAWING_HEIGHT = 240

export function RuntimeAtlasProjection({ output }: { output: unknown }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const projection = asProjectionOutput(output)
  const bounds = projection.projections?.canvas

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const draw = () => {
      const cssWidth = canvas.clientWidth || DRAWING_WIDTH
      const cssHeight = cssWidth * (DRAWING_HEIGHT / DRAWING_WIDTH)
      const pixelRatio = Math.max(1, globalThis.devicePixelRatio || 1)
      const backingWidth = Math.round(cssWidth * pixelRatio)
      const backingHeight = Math.round(cssHeight * pixelRatio)
      if (canvas.width !== backingWidth) canvas.width = backingWidth
      if (canvas.height !== backingHeight) canvas.height = backingHeight

      context.setTransform(
        backingWidth / DRAWING_WIDTH,
        0,
        0,
        backingHeight / DRAWING_HEIGHT,
        0,
        0
      )
      context.clearRect(0, 0, DRAWING_WIDTH, DRAWING_HEIGHT)
      context.fillStyle = '#fbf8f0'
      context.fillRect(0, 0, DRAWING_WIDTH, DRAWING_HEIGHT)
      context.strokeStyle = '#b8b2a5'
      context.lineWidth = 1
      for (let x = 24; x < DRAWING_WIDTH; x += 24) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, DRAWING_HEIGHT)
        context.stroke()
      }
      for (let y = 24; y < DRAWING_HEIGHT; y += 24) {
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(DRAWING_WIDTH, y)
        context.stroke()
      }
      if (!bounds) return

      context.fillStyle = '#144bd6'
      context.strokeStyle = '#080e15'
      context.lineWidth = 3
      context.fillRect(
        Number(bounds.x),
        Number(bounds.y),
        Number(bounds.width),
        Number(bounds.height)
      )
      context.strokeRect(
        Number(bounds.x),
        Number(bounds.y),
        Number(bounds.width),
        Number(bounds.height)
      )
      context.fillStyle = '#fbf8f0'
      context.font = '600 15px ui-sans-serif, system-ui, sans-serif'
      context.fillText(
        projection.canonical?.label ?? 'Information record',
        Number(bounds.x) + 16,
        Number(bounds.y) + 32
      )
    }

    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    draw()
    return () => observer.disconnect()
  }, [bounds, projection.canonical?.label])

  if (!projection.canonical || !projection.projections) return null

  return (
    <section
      className="atlas-projections"
      aria-labelledby="atlas-projections-title"
    >
      <div className="atlas-section-heading">
        <p className="technical-label">DOWNSTREAM / APP-OWNED</p>
        <h2 id="atlas-projections-title">One accepted state, four views.</h2>
        <p>
          These views consume the worker result. They help people work, but they
          do not become a second source of truth.
        </p>
      </div>
      <div className="atlas-projection-grid">
        <article className="atlas-projection-panel atlas-projection-panel--canvas">
          <header>
            <span>01</span>
            <h3>Canvas projection</h3>
            <small>App-owned</small>
          </header>
          <canvas
            ref={canvasRef}
            aria-label={`${projection.canonical.label} visual projection at x ${bounds?.x}, y ${bounds?.y}, width ${bounds?.width}, height ${bounds?.height}`}
            height={240}
            width={360}
          />
        </article>
        <article className="atlas-projection-panel">
          <header>
            <span>02</span>
            <h3>Hierarchy projection</h3>
            <small>App-owned</small>
          </header>
          <ol className="atlas-hierarchy-list">
            {projection.projections.hierarchy?.map((item, index) => (
              <li key={item.id} data-depth={index}>
                <span>{index === 0 ? 'WORKSPACE' : 'RECORD'}</span>
                {item.label}
              </li>
            ))}
          </ol>
        </article>
        <article className="atlas-projection-panel">
          <header>
            <span>03</span>
            <h3>Properties projection</h3>
            <small>App-owned</small>
          </header>
          <dl className="atlas-property-list">
            {Object.entries(projection.projections.properties ?? {}).map(
              ([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              )
            )}
          </dl>
        </article>
        <article className="atlas-projection-panel">
          <header>
            <span>04</span>
            <h3>Serialized projection</h3>
            <small>App-owned</small>
          </header>
          <pre aria-label="Detached serialized projection">
            {JSON.stringify(projection.projections.serialized, null, 2)}
          </pre>
        </article>
      </div>
    </section>
  )
}
