import Group from './svgs/Group.svg?react'
import Rect from './svgs/Rect.svg?react'
import Oval from './svgs/Oval.svg?react'
import Visible from './svgs/Visible.svg?react'
import Invisible from './svgs/Invisible.svg?react'
import Lock from './svgs/Lock.svg?react'
import Unlock from './svgs/Unlock.svg?react'
import Select from './svgs/Select.svg?react'

const Icons = {
  Group,
  Rect,
  Oval,
  Visible,
  Invisible,
  Lock,
  Unlock,
  Select
} as const

export type IconName = keyof typeof Icons

export { Icons }
