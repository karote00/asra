interface AsyraMarkProps {
  className?: string
}

export function AsyraMark({ className }: AsyraMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 64 76"
    >
      <path d="M7 68 32 8l25 60M17 54l15-17 15 17M32 8v29" />
    </svg>
  )
}
