import { createPortal } from "react-dom";
import type { SaleDetail } from "../../lib/api/types";
import { PosTicketPrintSheet } from "./PosTicketPrintSheet";
import { usePosThermalPrint } from "./usePosThermalPrint";

type PosTicketPrintProps = {
  sale: SaleDetail;
  onPrinted: () => void;
};

export function PosTicketPrint({ sale, onPrinted }: PosTicketPrintProps) {
  usePosThermalPrint(onPrinted, sale.id);

  return createPortal(
    <div id="eyano-pos-ticket-print" className="pos-ticket-print-root pos-thermal-print-host">
      <PosTicketPrintSheet sale={sale} />
    </div>,
    document.body,
  );
}