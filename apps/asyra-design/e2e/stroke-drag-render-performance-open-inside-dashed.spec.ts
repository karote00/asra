import {
  runStrokeDragRenderPerformanceUXGate,
  STROKE_DRAG_PERFORMANCE_CASE_GROUPS
} from './stroke-drag-render-performance.helpers'

runStrokeDragRenderPerformanceUXGate({
  suiteLabel: 'open inside dashed',
  strokeCases: STROKE_DRAG_PERFORMANCE_CASE_GROUPS.openInsideDashed
})
