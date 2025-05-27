import Group from './svgs/Group.svg?react'
import Rectangle from './svgs/Rectangle.svg?react'
import Visible from './svgs/Visible.svg?react'
import Invisible from './svgs/Invisible.svg?react'
import Lock from './svgs/Lock.svg?react'
import Unlock from './svgs/Unlock.svg?react'
import Select from './svgs/Select.svg?react'

const Icons = {
  Group,
  Rectangle,
  Visible,
  Invisible,
  Lock,
  Unlock,
  Select
} satisfies Record<string, React.FC<React.SVGProps<SVGElement>>>

export type IconName = keyof typeof Icons

export { Icons }
