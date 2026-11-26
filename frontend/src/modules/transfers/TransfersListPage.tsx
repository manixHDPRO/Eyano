import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { inputClassName } from "../../components/ui/FormField";
import { Pagination } from "../../components/ui/Pagination";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import {
  cancelTransfer,
  fetchTransfer,
  fetchTransfers,
  prepareTransfer,
  receiveTransfer,
  shipTransfer,
  submitTransfer,
  validateTransfer,
} from "../../lib/api/transfers";
import type { TransferDetail, TransferListItem } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { TransferCreateModal } from "./TransferCreateModal";
import { TransferReceiveModal } from "./TransferReceiveModal";
import { TransferShipPrint } from "./TransferShipPrint";
import {
  buildTransferShipPrintPayload,
  canPrintTransferShipFiche,
  type TransferShipPrintPayload,
} from "./transfer-ship-print-data";
import { transferStatusLabel } from "./transfer-status";

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Tous" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "PENDING", label: "En attente" },
  { value: "VALIDATED", label: "Validés" },
  { value: "PREPARING", label: "En préparation" },
  { value: "SHIPPED", label: "Expédiés" },
  { value: "PARTIALLY_RECEIVED", label: "Partiels" },
  { value: "RECEIVED", label: "Réceptionnés" },
  { value: "CANCELLED", label: "Annulés" },
];

type TransfersListPageProps = {
  /** Vue caisse : réception uniquement, sans liens administration. */
  posReceiveMode?: boolean;
};

export function TransfersListPage({ posReceiveMode = false }: TransfersListPageProps) {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const canCreate = hasPermission(user, "transfers.create");
  const canValidate = hasPermission(user, "transfers.validate");
  const canShip = hasPermission(user, "transfers.prepare_ship");
  const canReceive = hasPermission(user, "transfers.receive");
  const cashierReceiveOnly =
    posReceiveMode || (canReceive && !canCreate && !canValidate && !canShip);
  const canCancel = canCreate || canValidate;

  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get("status") ?? "";
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(statusFromUrl || (cashierReceiveOnly ? "SHIPPED" : ""));
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [receivingTransfer, setReceivingTransfer] = useState<TransferListItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [shipPrintPayload, setShipPrintPayload] = useState<TransferShipPrintPayload | null>(null);
  const [printBusyId, setPrintBusyId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["transfers", page, status, search],
    queryFn: () =>
      fetchTransfers({
        page,
        pageSize: 20,
        status: status || undefined,
        search: search.trim() || undefined,
      }),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["transfers"] });
    await queryClient.invalidateQueries({ queryKey: ["transfers-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
  };

  const actionMutation = useMutation({
    mutationFn: async (action: { type: "submit" | "validate" | "prepare" | "ship"; id: string }) => {
      switch (action.type) {
        case "submit":
          return submitTransfer(action.id);
        case "validate":
          return validateTransfer(action.id);
        case "prepare":
          return prepareTransfer(action.id);
        case "ship":
          return shipTransfer(action.id);
        default: {
          const unexpected: never = action.type;
          return unexpected;
        }
      }
    },
    onSuccess: async (data, variables) => {
      await invalidate();
      if (variables.type === "ship") {
        setShipPrintPayload(buildTransferShipPrintPayload(data as TransferDetail));
        pushToast({
          tone: "success",
          message: "Expédié — imprimez la fiche de transfert (caissière, témoin, expéditeur).",
        });
        return;
      }
      pushToast({ tone: "success", message: "Statut du transfert mis à jour." });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Action impossible.") }),
  });

  const receiveMutation = useMutation({
    mutationFn: (payload: { id: string; items: Array<{ transferItemId: string; quantityReceived: number }> }) =>
      receiveTransfer(payload.id, { complete: true, items: payload.items }),
    onSuccess: async (result) => {
      setReceivingTransfer(null);
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["notification-unread"] });
      pushToast({
        tone: result.hasVariance ? "info" : "success",
        message: result.hasVariance
          ? "Réception enregistrée avec écart."
          : "Statut du transfert mis à jour (réceptionné).",
      });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Réception impossible.") }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelTransfer(id),
    onSuccess: async () => {
      await invalidate();
      pushToast({ tone: "success", message: "Transfert annulé." });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Annulation impossible.") }),
  });

  const errorMessage = listQuery.isError ? formatApiErrorMessage(listQuery.error, "Chargement impossible.") : null;
  const items = listQuery.data?.items ?? [];

  const handleReprintShipFiche = async (transferId: string) => {
    setPrintBusyId(transferId);
    try {
      const detail = await fetchTransfer(transferId);
      setShipPrintPayload(buildTransferShipPrintPayload(detail));
    } catch (error) {
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Impossible de préparer l’impression.") });
    } finally {
      setPrintBusyId(null);
    }
  };

  const title = cashierReceiveOnly ? "Réception des transferts en boutique" : "Transferts Entrepôt → Boutiques";
  const subtitle = cashierReceiveOnly
    ? "Vérifiez les quantités expédiées puis confirmez la réception pour mettre à jour le stock de votre boutique."
    : "Approvisionnement officiel des boutiques avec validation et contrôle des écarts à réception.";

  return (
    <div className="space-y-6">
      {shipPrintPayload ? (
        <TransferShipPrint payload={shipPrintPayload} onPrinted={() => setShipPrintPayload(null)} />
      ) : null}
      <Block className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <TruckIcon className="size-3.5 shrink-0" />
            Nouveau transfert
          </button>
        ) : null}
      </Block>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
      {inlineError ? <Alert tone="error">{inlineError}</Alert> : null}

      {!cashierReceiveOnly ? (
        <Block className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {showFilters ? "Masquer les filtres" : "Filtres et recherche"}
          </button>
        </Block>
      ) : null}

      {showFilters && !cashierReceiveOnly ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Recherche</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Référence TR…, boutique…"
              className={`${inputClassName} mt-1`}
            />
          </label>
          <Block className="mt-3 flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const active = status === filter.value;
              return (
                <button
                  key={filter.value || "all"}
                  type="button"
                  onClick={() => {
                    setStatus(filter.value);
                    setPage(1);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active ? "border-slate-300 bg-slate-100 text-slate-800" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </Block>
        </section>
      ) : null}

      {listQuery.isLoading ? (
        <Block className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : (
        <Block className="space-y-4">
          {items.map((transfer) => (
            <TransferCard
              key={transfer.id}
              transfer={transfer}
              canCreate={canCreate}
              canValidate={canValidate}
              canShip={canShip}
              canReceive={canReceive}
              canCancel={canCancel}
              canPrintShipFiche={canPrintTransferShipFiche(transfer.status)}
              printBusy={printBusyId === transfer.id}
              actionBusy={actionMutation.isPending || cancelMutation.isPending}
              onAction={(type) => void actionMutation.mutateAsync({ type, id: transfer.id })}
              onReceive={() => setReceivingTransfer(transfer)}
              onCancel={() => void cancelMutation.mutateAsync(transfer.id)}
              onPrintShipFiche={() => void handleReprintShipFiche(transfer.id)}
            />
          ))}
          {items.length === 0 ? (
            <Block className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
              {cashierReceiveOnly
                ? "Aucun transfert expédié en attente de réception pour votre boutique."
                : "Aucun transfert enregistré. Créez un transfert pour approvisionner une boutique depuis l’entrepôt central."}
            </Block>
          ) : null}
        </Block>
      )}

      {listQuery.data && listQuery.data.totalPages > 1 ? (
        <Pagination
          page={listQuery.data.page}
          totalPages={listQuery.data.totalPages}
          totalItems={listQuery.data.total}
          onPageChange={setPage}
        />
      ) : null}

      {receivingTransfer ? (
        <TransferReceiveModal
          transfer={receivingTransfer}
          busy={receiveMutation.isPending}
          onClose={() => setReceivingTransfer(null)}
          onConfirm={(items) => receiveMutation.mutate({ id: receivingTransfer.id, items })}
        />
      ) : null}

      {showCreateModal ? (
        <TransferCreateModal
          busy={createBusy}
          setBusy={setCreateBusy}
          onError={setInlineError}
          onClose={() => setShowCreateModal(false)}
          onCreated={async () => {
            await invalidate();
            pushToast({ tone: "success", message: "Transfert créé et soumis (en attente de validation)." });
          }}
        />
      ) : null}
    </div>
  );
}

function TransferCard(props: {
  transfer: TransferListItem;
  canCreate: boolean;
  canValidate: boolean;
  canShip: boolean;
  canReceive: boolean;
  canCancel: boolean;
  canPrintShipFiche: boolean;
  printBusy: boolean;
  actionBusy: boolean;
  onAction: (type: "submit" | "validate" | "prepare" | "ship") => void;
  onReceive: () => void;
  onCancel: () => void;
  onPrintShipFiche: () => void;
}) {
  const { transfer } = props;
  const showReceive = props.canReceive && transfer.status === "SHIPPED";
  const showCancel =
    props.canCancel && !["RECEIVED", "PARTIALLY_RECEIVED", "CANCELLED", "SHIPPED"].includes(transfer.status);
  const routeLabel = `${transfer.warehouse.name} — ${transfer.store.name}`;

  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ArrowRightLeftIcon className="size-4 shrink-0 text-slate-600" />
            <span className="font-mono text-sm font-bold text-slate-900">{transfer.reference}</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-semibold text-slate-700">{routeLabel}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Créé le {new Date(transfer.createdAt).toLocaleString("fr-FR")} · Statut :{" "}
            <span className="font-semibold text-slate-900">{transferStatusLabel(transfer.status)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {props.canPrintShipFiche ? (
            <button
              type="button"
              disabled={props.printBusy || props.actionBusy}
              onClick={props.onPrintShipFiche}
              title="Imprimer la fiche de transfert (expédition)"
              aria-label={`Imprimer la fiche du transfert ${transfer.reference}`}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
            >
              <PrinterIcon className="size-4" />
            </button>
          ) : null}
          {transfer.status === "DRAFT" && props.canCreate ? (
            <ActionButton disabled={props.actionBusy} onClick={() => props.onAction("submit")}>
              Soumettre
            </ActionButton>
          ) : null}
          {transfer.status === "PENDING" && props.canValidate ? (
            <ActionButton disabled={props.actionBusy} onClick={() => props.onAction("validate")}>
              Valider
            </ActionButton>
          ) : null}
          {transfer.status === "VALIDATED" && props.canShip ? (
            <>
              <ActionButton disabled={props.actionBusy} onClick={() => props.onAction("prepare")}>
                Mettre en préparation
              </ActionButton>
              <ActionButton disabled={props.actionBusy} onClick={() => props.onAction("ship")}>
                Expédier (déduire entrepôt)
              </ActionButton>
            </>
          ) : null}
          {transfer.status === "PREPARING" && props.canShip ? (
            <ActionButton disabled={props.actionBusy} onClick={() => props.onAction("ship")}>
              Expédier (déduire entrepôt)
            </ActionButton>
          ) : null}
          {showReceive ? (
            <button
              type="button"
              disabled={props.actionBusy}
              onClick={props.onReceive}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Réceptionner en boutique
            </button>
          ) : null}
          {showCancel ? (
            <button
              type="button"
              disabled={props.actionBusy}
              onClick={props.onCancel}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Annuler
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="py-1.5 font-medium">Article</th>
              <th className="py-1.5 text-right font-medium">Demandé</th>
              <th className="py-1.5 text-right font-medium">Expédié</th>
              <th className="py-1.5 text-right font-medium">Reçu</th>
              <th className="py-1.5 text-right font-medium">Écart</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {transfer.items.map((line) => {
              const discrepancy = line.discrepancy ?? line.quantityShipped - line.quantityReceived;
              return (
                <tr key={line.id}>
                  <td className="py-2 font-medium text-slate-900">
                    {line.productName}{" "}
                    <span className="font-mono text-slate-400">({line.productReference})</span>
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums">{line.quantityRequested}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{line.quantityShipped}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{line.quantityReceived}</td>
                  <td
                    className={`py-2 text-right font-mono tabular-nums font-semibold ${
                      discrepancy === 0 ? "text-slate-500" : "text-red-700"
                    }`}
                  >
                    {discrepancy}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ActionButton(props: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
    >
      {props.children}
    </button>
  );
}

function Block(props: { className?: string; children?: ReactNode }) {
  return <div className={props.className}>{props.children}</div>;
}

/** Même pictogramme que Lucide `Truck` (import-hd-eyano-app LogisticsView). */
function TruckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.24A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

function ArrowRightLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 7h10M17 7l-3-3M17 7l-3 3M17 17H7M7 17l3 3M7 17l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PrinterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}