import Group from './svgs/Group.svg?react'
import Visible from './svgs/Visible.svg?react'
import Invisible from './svgs/Invisible.svg?react'
import Lock from './svgs/Lock.svg?react'
import Unlock from './svgs/Unlock.svg?react'

const Icons = { Group, Visible, Invisible, Lock, Unlock } satisfies Record<
  string,
  React.FC<React.SVGProps<SVGElement>>
>

export type IconName = keyof typeof Icons

export { Icons }
