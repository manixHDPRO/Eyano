import { createPortal } from "react-dom";
import type { BarcodeCatalogItem } from "../../lib/api/types";
import { BarcodeLabel } from "./BarcodeLabel";
import { BARCODE_LABELS_PER_A4 } from "./barcode-print-sheet.constants";

type PrintJob = {
  items: BarcodeCatalogItem[];
  copies: number;
};

type BarcodePrintSheetProps = {
  job: PrintJob | null;
};

export function BarcodePrintSheet({ job }: BarcodePrintSheetProps) {
  if (!job || typeof document === "undefined") {
    return null;
  }
  const labels = expandLabels(job);
  const pages = chunk(labels, BARCODE_LABELS_PER_A4);
  return createPortal(
    <div id="eyano-barcode-print" aria-hidden="true">
      {pages.map((page, pageIndex) => (
        <div key={pageIndex} className="barcode-print-page">
          {page.map((item, index) =>
            item.barcode ? (
              <BarcodeLabel
                key={`${item.id}-${pageIndex}-${index}`}
                name={item.name}
                reference={item.reference}
                code={item.barcode.code}
                price={item.finalPrice}
                variant="sheet"
              />
            ) : null,
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const pages: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    pages.push(items.slice(offset, offset + size));
  }
  return pages;
}

function expandLabels(job: PrintJob): BarcodeCatalogItem[] {
  const copies = Math.max(1, job.copies);
  const expanded: BarcodeCatalogItem[] = [];
  for (const item of job.items) {
    if (!item.barcode) {
      continue;
    }
    for (let copy = 0; copy < copies; copy += 1) {
      expanded.push(item);
    }
  }
  return expanded;
}
