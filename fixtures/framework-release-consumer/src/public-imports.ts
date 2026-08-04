import * as aiAgentRuntime from '@asyra/ai-agent-runtime'
import * as collaboration from '@asyra/collaboration'
import * as core from '@asyra/core'
import * as coreDebugger from '@asyra/core/canvas-pipeline-debugger'
import * as designSystem from '@asyra/design-system'
import * as factory from '@asyra/factory'
import * as featureSystem from '@asyra/feature-system'
import * as inputSystem from '@asyra/input-system'
import * as persistence from '@asyra/persistence'
import * as preset from '@asyra/preset'
import * as propsManager from '@asyra/props-manager'
import * as reactiveEvents from '@asyra/reactive-events'
import * as render from '@asyra/render'
import * as renderDebugger from '@asyra/render/canvas-pipeline-debugger'
import * as renderEngine from '@asyra/render-engine'
import * as renderEngineTesting from '@asyra/render-engine/testing'
import * as renderEnginePixi from '@asyra/render-engine-pixi'
import * as sceneTree from '@asyra/scene-tree'
import * as selection from '@asyra/selection'
import * as systemContext from '@asyra/system-context'
import * as uiContext from '@asyra/ui-context'
import * as utils from '@asyra/utils'

export const publicReleaseSurfaces = Object.freeze([
  aiAgentRuntime,
  collaboration,
  core,
  coreDebugger,
  designSystem,
  factory,
  featureSystem,
  inputSystem,
  persistence,
  preset,
  propsManager,
  reactiveEvents,
  render,
  renderDebugger,
  renderEngine,
  renderEngineTesting,
  renderEnginePixi,
  sceneTree,
  selection,
  systemContext,
  uiContext,
  utils
])
