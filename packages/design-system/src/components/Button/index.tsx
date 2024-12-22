import React from 'react'

export interface ButtonProps {
  /** Is this the principal call to action on the page? */
  primary?: boolean
  /** What background color to use */
  backgroundColor?: string
  /** How large should the button be? */
  size?: 'small' | 'medium' | 'large'
  /** Button contents */
  label: string
  /** Optional click handler */
  onClick?: () => void
}

/** Primary UI component for user interaction */
const Button: React.FC<ButtonProps> = ({
  primary = false,
  size = 'medium',
  backgroundColor,
  label,
  ...props
}: ButtonProps) => {
  return (
    <div
      className="bg-primary-20 bg-secondary-20 h-8 py-12"
      style={{ backgroundColor }}
      {...props}
    >
      {label}
    </div>
  )
}

export { Button }
