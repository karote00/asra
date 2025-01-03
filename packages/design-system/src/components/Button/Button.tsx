import React from 'react'

// Button Variants and Sizes
type Variant = 'primary' | 'secondary' | 'accent' | 'warning'
type Size = 'sm' | 'md' | 'lg'

// ButtonProps Interface
export interface ButtonProps {
  /** The variant of the button */
  variant?: Variant
  /** The size of the button */
  size?: Size
  /** Whether the button is disabled */
  disabled?: boolean
  /** Content inside the button */
  label: string
  /** Click event handler */
  onClick?: () => void
}

// Variant and Size Classes
const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-70',
  secondary: 'bg-secondary text-white hover:bg-secondary-70',
  accent: 'bg-accent text-white hover:bg-accent-70',
  warning: 'bg-warning text-white hover:bg-warning-70'
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-4 py-2 text-md',
  lg: 'px-6 py-3 text-lg'
}

// Button Component
const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  label,
  onClick
}) => {
  return (
    <button
      className={`font-sans rounded-md shadow-subtle transition-colors duration-200
        ${variantClasses[variant]} ${sizeClasses[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

export default Button
