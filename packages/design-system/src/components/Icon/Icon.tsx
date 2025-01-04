import React from 'react'
import { Size } from '@asra/utils'
import { Icons, IconName } from './svgs-components'

type IconSize = Size

interface IconProps {
  name: IconName | string
  showCursor?: boolean
  size?: IconSize
  className?: string
}

const sizeMap: Record<IconSize, string> = {
  lg: 'text-4xl',
  md: 'text-2xl',
  sm: 'text-xl'
}

const Icon: React.FC<IconProps> = ({
  name,
  size = Size.MD,
  showCursor = true,
  className
}) => {
  const SvgIcon = (
    Icons as Record<string, React.FC<React.SVGProps<SVGElement>>>
  )[name]

  return (
    <span
      className={`inline-flex items-center justify-center ${showCursor ? 'cursor-pointer' : ''} ${sizeMap[size]} ${
        className || ''
      }`}
    >
      {SvgIcon ? <SvgIcon /> : <span>{name}</span>}
    </span>
  )
}

export default Icon
