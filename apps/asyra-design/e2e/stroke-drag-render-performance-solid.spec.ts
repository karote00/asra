import {
  runStrokeDragRenderPerformanceUXGate,
  STROKE_DRAG_PERFORMANCE_CASE_GROUPS
} from './stroke-drag-render-performance.helpers'

runStrokeDragRenderPerformanceUXGate({
  suiteLabel: 'closed solid',
  strokeCases: STROKE_DRAG_PERFORMANCE_CASE_GROUPS.solid,
  includeMoveVector: true
})
