interface BrandLogoProps {
  className?: string
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 114 26"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth="1.75"
      >
        <g className="brand-logo__letter" data-letter="A">
          <path d="M1.5 23 10 3l8.5 20M5.7 14.2h8.6" />
        </g>
        <g className="brand-logo__letter" data-letter="S">
          <path d="m41 5-4-2H28l-4 3v4l4 3h8l4 3v4l-4 3H27l-4-3" />
        </g>
        <g className="brand-logo__letter" data-letter="Y">
          <path d="m47 3 8 10 8-10M55 13v10" />
        </g>
        <g className="brand-logo__letter" data-letter="R">
          <path d="M70 23V3h9.5c5 0 7.5 2.2 7.5 6s-2.5 6-7.5 6H70M79.5 15 88 23" />
        </g>
        <g className="brand-logo__letter" data-letter="A">
          <path d="m95.5 23 8.5-20 8.5 20m-12.8-8.8h8.6" />
        </g>
      </g>
    </svg>
  )
}
