import type { PartHighlight } from '../../render-app/workcell-frame'
import type { PlaybackView } from './playback-view'

export function playbackHighlight(
  view: PlaybackView | null
): PartHighlight | undefined {
  const feedback = view?.feedback

  if (
    view &&
    feedback &&
    feedback.checkedTime !== null &&
    feedback.checkedTime <= view.time
  ) {
    if (feedback.kind === 'collision')
      return { bodyIds: feedback.bodyIds, color: 0xff625e }

    if (feedback.kind === 'clearance')
      return { bodyIds: feedback.bodyIds, color: 0xffbd59 }
  }

  if (view?.historical && view.bodyIds.length)
    return { bodyIds: view.bodyIds, color: 0x62e6c1 }

  return undefined
}
