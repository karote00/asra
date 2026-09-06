import { type Workcell } from '../../domain/workcell'

export interface PlaybackView {
  workcell: Workcell
  joints: Readonly<Record<string, number>>
  time: number
  historical: boolean
  bodyIds: readonly string[]
}
