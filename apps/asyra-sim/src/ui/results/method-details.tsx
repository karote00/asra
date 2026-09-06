import type { MethodDescriptor } from '../../analysis/contracts'

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
      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
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

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        {manifest.name}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Origin: {manifest.origin} - Declared validation:{' '}
        {manifest.validation.status}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Static: {descriptor.supportsStatic ? 'supported' : 'unsupported'} -
        Motion: {descriptor.supportsMotion ? 'supported' : 'unsupported'} -
        Shapes: {descriptor.geometryKinds.join(', ')}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        {manifest.purpose}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        {manifest.applicability}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        {manifest.numericalSemantics}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        {manifest.controls}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        {manifest.reproducibility}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        {manifest.resources}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        {manifest.validation.evidence}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Author: {manifest.author} - License: {manifest.license}
      </p>

      <p className="asset-digest col-span-full wrap-anywhere">
        Source: {manifest.source}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Units: {manifest.units} - Coordinates: {manifest.coordinates}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Declared services — network: {String(manifest.services.network)};
        additional files: {String(manifest.services.additionalFiles)};
        commercial runtime: {String(manifest.services.commercialRuntime)}.
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Trusted pre-start code only. A Worker is not a security sandbox. This
        declaration is not a safety certification or an endorsement of private
        methods.
      </p>
    </details>
  )
}
