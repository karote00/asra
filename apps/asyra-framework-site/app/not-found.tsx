import { FoundationStatus } from '@/components/foundation-status'

export default function NotFound() {
  return (
    <FoundationStatus
      actionHref="/docs"
      actionLabel="Browse verified documentation"
      code="404 / NO ROUTE"
      eyebrow="Nothing is hidden behind this address"
      title="This public route does not exist."
    >
      <p>
        No fallback page or guessed documentation was substituted. Use the
        public index to choose a maintained route.
      </p>
    </FoundationStatus>
  )
}
