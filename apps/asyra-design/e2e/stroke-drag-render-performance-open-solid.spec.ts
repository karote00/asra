import {
  runStrokeDragRenderPerformanceUXGate,
  STROKE_DRAG_PERFORMANCE_CASE_GROUPS
} from './stroke-drag-render-performance.helpers'

runStrokeDragRenderPerformanceUXGate({
  suiteLabel: 'open solid',
  strokeCases: STROKE_DRAG_PERFORMANCE_CASE_GROUPS.openSolid
})
