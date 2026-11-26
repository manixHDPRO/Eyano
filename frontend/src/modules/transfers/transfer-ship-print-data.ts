import type { TransferDetail, TransferStatus } from "../../lib/api/types";

/** Transferts pour lesquels la fiche d’expédition est disponible (y compris réimpression). */
export const TRANSFER_SHIP_PRINT_STATUSES: TransferStatus[] = ["SHIPPED", "PARTIALLY_RECEIVED", "RECEIVED"];

export function canPrintTransferShipFiche(status: TransferStatus): boolean {
  return TRANSFER_SHIP_PRINT_STATUSES.includes(status);
}

export type TransferShipPrintPayload = {
  generatedAt: string;
  detail: TransferDetail;
};

export function buildTransferShipPrintPayload(detail: TransferDetail): TransferShipPrintPayload {
  return {
    generatedAt: new Date().toISOString(),
    detail,
  };
}