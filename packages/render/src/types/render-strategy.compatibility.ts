import type { RenderElementData } from '../types'
import type {
  EngineNeutralRenderStrategy,
  RenderStrategy,
  RenderStrategyGraphic
} from './render-strategy'
import type { RenderGraphics } from './render-object'

type Assert<T extends true> = T

interface LegacyPixiGraphicsLike {
  bezierCurveTo(
    controlPoint1X: number,
    controlPoint1Y: number,
    controlPoint2X: number,
    controlPoint2Y: number,
    destinationX: number,
    destinationY: number
  ): LegacyPixiGraphicsLike
  clear(): LegacyPixiGraphicsLike
  closePath(): LegacyPixiGraphicsLike
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number
  ): LegacyPixiGraphicsLike
  fill(style: unknown): LegacyPixiGraphicsLike
  lineTo(x: number, y: number): LegacyPixiGraphicsLike
  moveTo(x: number, y: number): LegacyPixiGraphicsLike
  rect(
    x: number,
    y: number,
    width: number,
    height: number
  ): LegacyPixiGraphicsLike
  stroke(style: unknown): LegacyPixiGraphicsLike
  hitArea?: unknown
  renderable: boolean
  visible: boolean
  x: number
  y: number
  readonly legacyPixiGraphicsBrand: 'legacy-pixi-graphics'
}

type LegacyAnnotatedStrategy = (
  graphic: LegacyPixiGraphicsLike,
  data: RenderElementData
) => void

type _RenderStrategyAcceptsLegacyAnnotatedGraphic = Assert<
  LegacyAnnotatedStrategy extends RenderStrategy ? true : false
>

type _RenderGraphicsImplementsCompatibilityFacade = Assert<
  RenderGraphics extends RenderStrategyGraphic ? true : false
>

interface AppDeclaredRenderData {
  customCount: number
  customLabel: string
}

type AppStrategyData = Parameters<
  EngineNeutralRenderStrategy<AppDeclaredRenderData>
>[1]

type _AppStrategyDataRetainsCanonicalAndCustomFields = Assert<
  AppStrategyData extends RenderElementData & AppDeclaredRenderData
    ? RenderElementData & AppDeclaredRenderData extends AppStrategyData
      ? true
      : false
    : false
>
