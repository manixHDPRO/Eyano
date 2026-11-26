import { createPortal } from "react-dom";
import { usePosThermalPrint } from "../pos/usePosThermalPrint";
import type { TopSellingPrintPayload } from "./top-selling-print-data";
import { TopSellingProductsPrintSheet } from "./TopSellingProductsPrintSheet";

type TopSellingProductsPrintProps = {
  payload: TopSellingPrintPayload;
  onPrinted: () => void;
};

export function TopSellingProductsPrint({ payload, onPrinted }: TopSellingProductsPrintProps) {
  usePosThermalPrint(onPrinted, payload.generatedAt);

  return createPortal(
    <div id="eyano-top-selling-print" className="top-selling-print-root">
      <TopSellingProductsPrintSheet payload={payload} />
    </div>,
    document.body,
  );
}