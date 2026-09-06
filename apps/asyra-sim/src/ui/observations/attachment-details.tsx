import { type ObservationAttachmentReference } from '../../common-apis/observation-contract'

export function AttachmentDetails({
  reference
}: {
  reference: ObservationAttachmentReference
}) {
  return (
    <div
      className="observation-attachment-details grid gap-1 min-w-0 flex-[1_1_250px]
        wrap-anywhere text-[11px] [&_code]:text-[10px] [&_code]:text-sim-muted"
    >
      <strong>{reference.filename}</strong>

      <span>
        {reference.byteLength.toLocaleString()} bytes - declared{' '}
        {reference.mediaType}
      </span>

      <code>{reference.sourceId}</code>
    </div>
  )
}
