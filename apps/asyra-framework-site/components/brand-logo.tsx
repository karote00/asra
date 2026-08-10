interface BrandLogoProps {
  className?: string
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 154 32"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      >
        <path d="M2 27 14 4l12 23M7.5 18h13" />
        <path d="M52 7.5c-2.4-2.4-5.6-3.5-9.1-3.5-5.6 0-9.4 2.7-9.4 6.8 0 4.5 4 5.6 9.5 6.7 5.2 1 8.7 2.1 8.7 6.3 0 3.5-3.4 5.7-9.1 5.7-4.3 0-7.9-1.5-10.5-4.4" />
        <path d="m59 4 10.8 13.2L80.5 4M69.8 17.2V28" />
        <path d="M89 28V4h10.4c6.3 0 10.1 2.8 10.1 7.6 0 4.9-3.8 7.8-10.1 7.8H89M100.1 19.4 111 28" />
        <path d="m121 27 12-23 12 23M126.5 18h13" />
      </g>
    </svg>
  )
}
