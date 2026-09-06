import type { ButtonHTMLAttributes } from 'react'

type ToolbarButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label'
> & { label: string }

/** Presentation only; the caller retains command, state and shortcut ownership. */
export function ToolbarButton({
  label,
  children,
  className = '',
  title = label,
  ...props
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`toolbar-button inline-flex items-center justify-center flex-none w-9 h-9
        p-[5px] [&_>_svg]:block [&_>_svg]:flex-none ${className}`}
      aria-label={label}
      title={title}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {children}
      </svg>
    </button>
  )
}
