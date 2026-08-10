import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SiteFrame } from '@/components/site-frame'

export default function PlatformFoundationPage() {
  return (
    <div className="foundation-page">
      <SiteFrame eyebrow="Website platform foundation">
        <div className="foundation-page__content">
          <div>
            <h1>The public Asyra experience is being assembled.</h1>
            <p className="lede">
              The documentation platform is ready. The complete product
              narrative is owned by the next Landing implementation stage.
            </p>
          </div>
          <Link className="primary-action" href="/docs">
            Read the Framework documentation
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </SiteFrame>
    </div>
  )
}
