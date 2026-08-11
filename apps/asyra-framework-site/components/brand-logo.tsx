interface BrandLogoProps {
  className?: string
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 124 24"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      >
        <g className="brand-logo__letter" data-letter="A">
          <path d="M2.5 22 12.25 2 22 22M6.3 14.2h11.9" />
        </g>
        <g className="brand-logo__letter" data-letter="S">
          <path d="M44.75 3.5h-9.9c-3.1 0-5 1.7-5 4.2 0 1.9 1.1 3 3.2 3.6l7.9 2.8c2.5.8 3.8 2 3.8 4 0 2.4-2 3.9-5 3.9h-9.9" />
        </g>
        <g className="brand-logo__letter" data-letter="Y">
          <path d="m52.35 2.5 8.75 10.2 8.75-10.2m-8.75 10.2V22" />
        </g>
        <g className="brand-logo__letter" data-letter="R">
          <path d="M78.25 22V2.5h6.7c5.1 0 7.8 2.4 7.8 6.1s-2.7 6.1-7.8 6.1h-6.7m6.95 0 8.55 7.3" />
        </g>
        <g className="brand-logo__letter" data-letter="A">
          <path d="m102.15 22 9.75-20 9.75 20m-15.7-7.8h11.9" />
        </g>
      </g>
    </svg>
  )
}
