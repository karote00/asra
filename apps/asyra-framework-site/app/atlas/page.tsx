import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SiteFrame } from '@/components/site-frame'

export default function AtlasFoundationPage() {
  return (
    <div className="foundation-page">
      <SiteFrame coordinate="07" eyebrow="Runtime Atlas foundation">
        <div className="foundation-page__content">
          <div>
            <h1>The runtime lab has a stable place to land.</h1>
            <p className="lede">
              Runtime execution and its formal cases belong to the dedicated
              Atlas implementation stage. This route currently proves only the
              shared shell.
            </p>
          </div>
          <Link className="primary-action" href="/docs/learn/canonical-state">
            Learn the canonical state model
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </SiteFrame>
    </div>
  )
}
