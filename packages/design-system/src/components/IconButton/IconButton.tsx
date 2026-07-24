import { forwardRef, type ButtonHTMLAttributes, type ForwardedRef } from 'react'
import { Icon, type IconName } from '../Icon'

export interface IconButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'aria-label' | 'children'
  > {
  'aria-label': string
  icon: IconName
  iconClassName?: string
}

const IconButton = (
  { icon, iconClassName, type = 'button', ...buttonProps }: IconButtonProps,
  ref: ForwardedRef<HTMLButtonElement>
) => {
  return (
    <button ref={ref} type={type} {...buttonProps}>
      <Icon name={icon} showCursor={false} className={iconClassName} />
    </button>
  )
}

const ForwardedIconButton = forwardRef(IconButton)
ForwardedIconButton.displayName = 'IconButton'

export { ForwardedIconButton as IconButton }
