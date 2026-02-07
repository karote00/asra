/**
 * Subscribers - Simple forwarding layer
 *
 * DISABLED: Now using feature-system for selection
 * Old subscribers disabled to avoid duplicate selection handling
 */

// import { subscribeToDecideToSelectElements } from '../events'
// import { selectionApis } from '../apis'

export const initSelectElementsSubscribers = () => {
  // Disabled - moved to feature-system selection feature
  // subscribeToDecideToSelectElements((payload) => {
  //   const { elementIds } = payload as any
  //   selectionApis.selectElements(elementIds)
  // })
}
