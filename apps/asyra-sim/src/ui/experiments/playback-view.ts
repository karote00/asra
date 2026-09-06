import { type Workcell } from '../../domain/workcell'
import type { PlaybackFeedback } from './playback-feedback'

export interface PlaybackView {
  workcell: Workcell
  joints: Readonly<Record<string, number>>
  time: number
  pendingTime?: number
  historical: boolean
  bodyIds: readonly string[]
  feedback?: PlaybackFeedback
}
