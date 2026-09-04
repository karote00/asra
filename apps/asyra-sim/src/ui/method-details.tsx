import type { MethodDescriptor } from '../analysis/contracts'

export function MethodDetails({
  descriptor,
  historical = false
}: {
  descriptor?: MethodDescriptor
  historical?: boolean
}) {
  const manifest = descriptor?.manifest
  if (!manifest)
    return (
      <p className="hint">
        No method declaration was retained. Method identity alone is not
        validation evidence.
      </p>
    )
  return (
    <details className="method-details">
      <summary>
        {historical
          ? 'Retained method declaration'
          : 'Method capabilities and trust'}
      </summary>
      <p className="hint">
        Origin: {manifest.origin} · Declared validation:{' '}
        {manifest.validation.status}
      </p>
      <p className="hint">
        Static: {descriptor.supportsStatic ? 'supported' : 'unsupported'} ·
        Motion: {descriptor.supportsMotion ? 'supported' : 'unsupported'} ·
        Shapes: {descriptor.geometryKinds.join(', ')}
      </p>
      <p className="hint">{manifest.purpose}</p>
      <p className="hint">{manifest.applicability}</p>
      <p className="hint">{manifest.numericalSemantics}</p>
      <p className="hint">{manifest.controls}</p>
      <p className="hint">{manifest.reproducibility}</p>
      <p className="hint">{manifest.resources}</p>
      <p className="hint">{manifest.validation.evidence}</p>
      <p className="hint">
        Author: {manifest.author} · License: {manifest.license}
      </p>
      <p className="asset-digest">Source: {manifest.source}</p>
      <p className="hint">
        Units: {manifest.units} · Coordinates: {manifest.coordinates}
      </p>
      <p className="hint">
        Declared services — network: {String(manifest.services.network)};
        additional files: {String(manifest.services.additionalFiles)};
        commercial runtime: {String(manifest.services.commercialRuntime)}.
      </p>
      <p className="hint">
        Trusted pre-start code only. A Worker is not a security sandbox. This
        declaration is not a safety certification or an endorsement of private
        methods.
      </p>
    </details>
  )
}
