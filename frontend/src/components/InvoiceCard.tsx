import { useId, useRef, useState } from "react";
import { DownloadSimple, FilePdf, UploadSimple } from "@phosphor-icons/react";
import { useDownloadInvoice, useUploadInvoice } from "../api/queries";
import type { ShipmentDetail } from "../api/contract";
import { dateTimeTz } from "../lib/time";
import { Button, Card, CardHeader } from "./ui";

/*
  Invoice for a shipment (bonus item, brief page 7). The coordinator uploads or replaces one PDF;
  the customer downloads it. The API repeats these checks; they are here so the reason is shown at once.
*/
export const MAX_INVOICE_BYTES = 2 * 1024 * 1024;

export function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InvoiceCard({ shipment, canUpload = false }: { shipment: ShipmentDetail; canUpload?: boolean }) {
  const invoice = shipment.invoice ?? null;
  const upload = useUploadInvoice(shipment.id);
  const download = useDownloadInvoice(shipment.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const headingId = useId();

  function onFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ""; // so the same file can be chosen again
    upload.reset();
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setProblem("Choose a PDF file.");
    if (file.size > MAX_INVOICE_BYTES) return setProblem(`That file is ${fileSize(file.size)}. The limit is 2 MB.`);
    setProblem(null);
    upload.mutate(file);
  }

  const error = problem ?? upload.error?.message ?? download.error?.message ?? null;

  return (
    <Card aria-labelledby={headingId}>
      <CardHeader title="Invoice" id={headingId} />
      <div className="space-y-3 p-5">
        {invoice ? (
          <div className="flex flex-wrap items-center gap-3">
            <FilePdf size={28} aria-hidden className="shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium text-ink">{invoice.filename}</p>
              <p className="tnum text-meta text-muted">
                {fileSize(invoice.size_bytes)} · Uploaded {dateTimeTz(invoice.uploaded_at)}
                {canUpload && ` by ${invoice.uploaded_by_name}`}
              </p>
            </div>
            <Button variant={canUpload ? "secondary" : "primary"} disabled={download.isPending} onClick={() => download.mutate(invoice.filename)}>
              <DownloadSimple size={16} weight="bold" aria-hidden />
              {download.isPending ? "Downloading…" : "Download"}
            </Button>
          </div>
        ) : (
          <p className="text-body text-muted">{canUpload ? "No invoice uploaded yet. The customer is told as soon as you add one." : "Your invoice is not ready yet. We will tell you here when it is."}</p>
        )}

        {canUpload && (
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              tabIndex={-1}
              aria-label={`Invoice PDF for ${shipment.id}`}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button variant={invoice ? "secondary" : "primary"} disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
              <UploadSimple size={16} weight="bold" aria-hidden />
              {upload.isPending ? "Uploading…" : invoice ? "Replace PDF" : "Upload PDF"}
            </Button>
            <p className="text-meta text-muted">PDF only, up to 2 MB.</p>
          </div>
        )}

        {upload.isSuccess && !error && <p role="status" className="text-meta text-low">Invoice saved. The customer has been notified.</p>}
        {error && <p role="alert" className="rounded-md bg-high-soft px-3 py-2 text-meta text-high">{error}</p>}
      </div>
    </Card>
  );
}
