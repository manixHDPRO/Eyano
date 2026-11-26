import { createPortal } from "react-dom";
import { usePosThermalPrint } from "../pos/usePosThermalPrint";
import { ProductsCatalogPrintSheet } from "./ProductsCatalogPrintSheet";
import type { ProductsCatalogPrintPayload } from "./products-catalog-print-data";

type ProductsCatalogPrintProps = {
  payload: ProductsCatalogPrintPayload;
  onPrinted: () => void;
};

export function ProductsCatalogPrint({ payload, onPrinted }: ProductsCatalogPrintProps) {
  usePosThermalPrint(onPrinted, payload.generatedAt);

  return createPortal(
    <div id="eyano-products-catalog-print" className="products-catalog-print-root">
      <ProductsCatalogPrintSheet payload={payload} />
    </div>,
    document.body,
  );
}