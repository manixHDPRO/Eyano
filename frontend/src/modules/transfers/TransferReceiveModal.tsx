import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { modalFieldClassName } from "../../components/ui/form-styles";
import type { TransferDetail, TransferListItem, TransferListLineItem } from "../../lib/api/types";
import { fetchTransfer } from "../../lib/api/transfers";
import { formatApiErrorMessage } from "../../lib/api/errors";

type TransferReceiveModalProps = {
  transfer: TransferListItem;
  onClose: () => void;
  onConfirm: (items: Array<{ transferItemId: string; quantityReceived: number }>) => void;
  busy: boolean;
};

export function TransferReceiveModal({ transfer, onClose, onConfirm, busy }: TransferReceiveModalProps) {
  const [detail, setDetail] = useState<TransferDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [receivedMap, setReceivedMap] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const full = await fetchTransfer(transfer.id);
        if (cancelled) return;
        setDetail(full);
        setReceivedMap(
          Object.fromEntries(
            full.items.map((line) => [
              line.id,
              line.quantityReceived > 0 ? line.quantityReceived : line.quantityShipped,
            ]),
          ),
        );
      } catch (error) {
        if (!cancelled) {
          setLoadError(formatApiErrorMessage(error, "Impossible de charger le bordereau."));
          setReceivedMap(
            Object.fromEntries(
              transfer.items.map((line) => [line.id, line.quantityShipped]),
            ),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transfer.id, transfer.items]);

  const lines: TransferListLineItem[] = useMemo(() => {
    if (detail) {
      return detail.items.map((line) => ({
        id: line.id,
        productId: line.productId,
        productReference: line.productReference,
        productName: line.productName,
        quantityRequested: line.quantityRequested,
        quantityShipped: line.quantityShipped,
        quantityReceived: line.quantityReceived,
        discrepancy: line.quantityShipped - line.quantityReceived,
      }));
    }
    return transfer.items;
  }, [detail, transfer.items]);

  function submit() {
    onConfirm(
      lines.map((line) => ({
        transferItemId: line.id,
        quantityReceived: Number(receivedMap[line.id] ?? line.quantityShipped),
      })),
    );
  }

  const hasInvalid = lines.some((line) => Number(receivedMap[line.id] ?? 0) > line.quantityShipped);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Confirmation de réception — {transfer.reference}</h3>
        <p className="mt-1 text-xs text-slate-500">
          Confirmez les quantités réellement reçues à{" "}
          <span className="font-medium text-slate-700">{transfer.store.name}</span>. Tout écart sera signalé
          automatiquement.
        </p>

        {loadError ? <p className="mt-2 text-xs text-amber-700">{loadError}</p> : null}

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_3rem] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <span>Article</span>
            <span className="text-center">Reçu</span>
            <span className="text-right">Écart</span>
          </div>
          <ul className="divide-y divide-slate-100 text-xs">
            {lines.map((line) => {
              const qty = Number(receivedMap[line.id] ?? line.quantityShipped);
              const discrepancy = line.quantityShipped - qty;
              return (
                <li
                  key={line.id}
                  className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_3rem] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{line.productName}</p>
                    <p className="mt-0.5 text-slate-500">Expédié : {line.quantityShipped}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:block">
                    <span className="shrink-0 text-slate-500 sm:sr-only">Quantité reçue</span>
                    <input
                      type="number"
                      min={0}
                      max={line.quantityShipped}
                      value={receivedMap[line.id] ?? line.quantityShipped}
                      disabled={busy}
                      onChange={(event) =>
                        setReceivedMap((current) => ({
                          ...current,
                          [line.id]: Number(event.target.value),
                        }))
                      }
                      className={`${modalFieldClassName} box-border !w-20 max-w-[5.5rem] text-right font-mono tabular-nums sm:!w-[5.5rem] sm:mx-auto`}
                      aria-label={`Quantité reçue pour ${line.productName}`}
                    />
                  </div>
                  <div className="text-right font-mono text-[11px] tabular-nums text-slate-500 sm:pt-0">
                    {discrepancy !== 0 ? (
                      <span className="text-red-700" title="Écart (expédié − reçu)">
                        {discrepancy > 0 ? `−${discrepancy}` : `+${Math.abs(discrepancy)}`}
                      </span>
                    ) : (
                      <span className="text-emerald-700">OK</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <Button disabled={busy || hasInvalid || lines.length === 0} onClick={submit}>
            {busy ? "Enregistrement…" : "Confirmer la réception"}
          </Button>
        </div>
      </div>
    </div>
  );
}