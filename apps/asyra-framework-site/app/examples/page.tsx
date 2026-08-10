import type { Metadata } from 'next'
import { ArrowUpRight, Terminal } from 'lucide-react'
import { EvidenceHero } from '@/components/evidence-hero'
import { loadContentBundle, sourceHref } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Executable examples',
  description:
    'Run maintained Asyra examples that prove current public Framework behavior.',
  alternates: { canonical: '/examples' }
}

export default function ExamplesPage() {
  const bundle = loadContentBundle()
  return (
    <div className="evidence-page">
      <EvidenceHero
        coordinate="03"
        description="Start with a small, maintained behavior. Every example names its owner, environment, command, and expected result so people and AI coding agents can extend from evidence instead of guesswork."
        eyebrow="Learn by running"
        title="Eleven proofs. One public runtime boundary."
      >
        <p className="candidate-line">
          <span>CANDIDATE</span>
          {bundle.examples.length} executable paths · Node {bundle.runtime.node}
        </p>
      </EvidenceHero>
      <ol className="example-ledger">
        {bundle.examples.map((example, index) => (
          <li key={example.id}>
            <div className="example-ledger__index">
              {String(index + 1).padStart(2, '0')}
            </div>
            <div className="example-ledger__body">
              <p className="technical-label">{example.id}</p>
              <h2>{example.title}</h2>
              <p>{example.objective}</p>
              <dl>
                <div>
                  <dt>Environment</dt>
                  <dd>{example.environment}</dd>
                </div>
                <div>
                  <dt>Expected result</dt>
                  <dd>{example.expectedResult}</dd>
                </div>
              </dl>
            </div>
            <div className="example-ledger__evidence">
              <code>
                <Terminal aria-hidden="true" size={15} />
                {example.runCommand}
              </code>
              <a href={sourceHref(bundle, example.source)} rel="noreferrer">
                Inspect maintained source
                <ArrowUpRight aria-hidden="true" size={15} />
              </a>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
