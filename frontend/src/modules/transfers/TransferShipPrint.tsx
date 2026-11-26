import { createPortal } from "react-dom";
import { usePosThermalPrint } from "../pos/usePosThermalPrint";
import type { TransferShipPrintPayload } from "./transfer-ship-print-data";
import { TransferShipPrintSheet } from "./TransferShipPrintSheet";

type TransferShipPrintProps = {
  payload: TransferShipPrintPayload;
  onPrinted: () => void;
};

export function TransferShipPrint({ payload, onPrinted }: TransferShipPrintProps) {
  usePosThermalPrint(onPrinted, payload.generatedAt);

  return createPortal(
    <div id="eyano-transfer-ship-print" className="transfer-ship-print-root">
      <TransferShipPrintSheet payload={payload} />
    </div>,
    document.body,
  );
}