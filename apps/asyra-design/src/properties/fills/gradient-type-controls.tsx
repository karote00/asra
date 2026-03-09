import { type FillGradientType } from '@asyra/utils'

interface GradientTypeControlsProps {
  index: number
  value: FillGradientType
  options: FillGradientType[]
  onChange: (nextType: FillGradientType) => void
  onFlip: () => void
}

const FlipIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    className="h-3.5 w-3.5"
    fill="none"
  >
    <path
      d="M3 5.25h7.5M8.5 2.75l2.5 2.5-2.5 2.5M13 10.75H5.5M7.5 8.25l-2.5 2.5 2.5 2.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const GradientTypeControls = ({
  index,
  value,
  options,
  onChange,
  onFlip
}: GradientTypeControlsProps) => (
  <div className="flex items-center gap-2">
    <div className="flex flex-1 items-center gap-2">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as FillGradientType)}
        className="min-w-24 flex-1 rounded-md border border-[#434445] bg-[#1d1e1f] px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-gray-200 outline-none"
        data-testid={`prop-fill-gradient-type-${index}`}
      >
        {options.map((gradientType) => (
          <option key={gradientType} value={gradientType}>
            {gradientType}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onFlip}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#434445] bg-[#1d1e1f] text-[#c7ccd1] transition-colors hover:border-[#626467] hover:text-white"
        data-testid={`prop-fill-gradient-flip-${index}`}
        aria-label="Flip gradient"
        title="Flip gradient"
      >
        <FlipIcon />
      </button>
    </div>
  </div>
)

export default GradientTypeControls
