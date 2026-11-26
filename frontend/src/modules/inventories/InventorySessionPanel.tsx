import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import {
  cancelInventory,
  fetchInventory,
  patchInventoryItems,
  startInventory,
  submitInventory,
  validateInventory,
} from "../../lib/api/inventories";
import type { InventoryDetail } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { Pagination } from "../../components/ui/Pagination";
import { useClientPagination } from "../../lib/pagination/client-pagination";
import { buildInventoryPatchPayload, InventoryCountTable } from "./inventory-count-table";
import type { CountDraft } from "./inventory-count-table";
import { inventorySessionDateLines, inventoryStatusLabel, locationLabel } from "./inventory-status";

const hdGhostBtn =
  "px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50";
const hdPrimaryBtn =
  "px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50";

export function InventorySessionPanel({
  sessionId,
  onUpdated,
}: {
  sessionId: string;
  onUpdated?: () => void;
}) {
  const queryClient = useQueryClient();
  const { pushToast, confirm } = useToast();
  const { user } = useAuth();
  const canConduct = hasPermission(user, "inventory.conduct");
  const canValidate = hasPermission(user, "inventory.validate");

  const detailQuery = useQuery({
    queryKey: ["inventory", sessionId],
    queryFn: () => fetchInventory(sessionId),
  });

  const [countDraft, setCountDraft] = useState<CountDraft>({});
  const [busy, setBusy] = useState(false);

  const detail = detailQuery.data;

  useEffect(() => {
    if (!detail) return;
    const next: CountDraft = {};
    for (const line of detail.items) {
      next[line.productId] = {
        physicalQty: line.physicalQty === null ? "" : String(line.physicalQty),
        justification: line.justification ?? "",
      };
    }
    setCountDraft(next);
  }, [detail]);

  const lines = useMemo(() => detail?.items ?? [], [detail?.items]);
  const { page, setPage, slice: pagedLines, totalPages, totalItems } = useClientPagination(lines, 25);

  useEffect(() => {
    setPage(1);
  }, [sessionId, setPage]);

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["inventories"] });
    await queryClient.invalidateQueries({ queryKey: ["inventories-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["inventory", sessionId] });
    await queryClient.invalidateQueries({ queryKey: ["stock"] });
    onUpdated?.();
  }

  async function runAction(label: string, action: () => Promise<InventoryDetail>) {
    setBusy(true);
    try {
      await action();
      await invalidate();
      pushToast({ tone: "success", message: label });
    } catch (error) {
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Action impossible.") });
    } finally {
      setBusy(false);
    }
  }

  const editable =
    detail?.status === "DRAFT" ||
    detail?.status === "IN_PROGRESS" ||
    detail?.status === "PENDING_VALIDATION";
  const locked = detail?.status === "VALIDATED" || detail?.status === "CANCELLED";
  const canEditCounts = (canConduct || canValidate) && editable && !locked;

  if (detailQuery.isLoading) {
    return (
      <div className="py-12 text-center text-xs text-slate-500">Chargement de la session…</div>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <div className="py-12 text-center text-xs text-red-600">
        {formatApiErrorMessage(detailQuery.error, "Session introuvable.")}
      </div>
    );
  }

  const showHdActions = !locked && lines.length > 0;
  const { start: startLabel, end: endLabel } = inventorySessionDateLines(detail);

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {detail.reference} · {locationLabel(detail)}
          </h3>
          <p className="text-xs text-slate-500">Statut : {inventoryStatusLabel(detail.status)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Début : {startLabel ?? "—"} · Fin :{" "}
            {endLabel ?? (detail.status === "DRAFT" || !startLabel ? "—" : "en cours")}
          </p>
        </div>
        {showHdActions ? (
          <div className="flex items-center gap-2">
            {canEditCounts ? (
              <button
                type="button"
                disabled={busy}
                className={hdGhostBtn}
                onClick={() =>
                  runAction("Comptage physique sauvegardé.", () =>
                    patchInventoryItems(detail.id, buildInventoryPatchPayload(lines, countDraft)),
                  )
                }
              >
                Sauvegarder comptage
              </button>
            ) : null}
            {canValidate ? (
              <button
                type="button"
                disabled={busy}
                className={hdPrimaryBtn}
                onClick={() => handleAdministrativeValidate(detail, countDraft, lines, runAction)}
              >
                Valider administrativement
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {detail.status === "DRAFT" && lines.length === 0 && canConduct ? (
        <div className="py-6 text-center">
          <Button type="button" disabled={busy} onClick={() => runAction("Session ouverte.", () => startInventory(detail.id))}>
            Démarrer le décompte
          </Button>
        </div>
      ) : null}

      {lines.length > 0 ? (
        <div className="space-y-3">
          <InventoryCountTable
            lines={pagedLines}
            countDraft={countDraft}
            readOnly={!canEditCounts}
            onChange={(productId, patch) =>
              setCountDraft((prev) => ({
                ...prev,
                [productId]: {
                  physicalQty: patch.physicalQty ?? prev[productId]?.physicalQty ?? "",
                  justification: patch.justification ?? prev[productId]?.justification ?? "",
                },
              }))
            }
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setPage}
            itemLabel="lignes"
          />
        </div>
      ) : null}

      {(canConduct || canValidate) && !locked && detail.status !== "DRAFT" ? (
        <p className="pt-2 text-center">
          <button
            type="button"
            className="text-xs text-slate-400 underline hover:text-slate-600"
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({
                title: "Annuler cette session ?",
                message: "Aucun ajustement stock ne sera appliqué.",
                confirmLabel: "Annuler la session",
              });
              if (!ok) return;
              await runAction("Session annulée.", () => cancelInventory(detail.id));
            }}
          >
            Annuler la session
          </button>
        </p>
      ) : null}
    </div>
  );
}

async function handleAdministrativeValidate(
  detail: InventoryDetail,
  countDraft: CountDraft,
  lines: InventoryDetail["items"],
  runAction: (label: string, action: () => Promise<InventoryDetail>) => Promise<void>,
) {
  const items = buildInventoryPatchPayload(lines, countDraft);
  await runAction("Inventaire validé administrativement et stocks alignés.", async () => {
    const afterPatch = await patchInventoryItems(detail.id, items);
    let current = afterPatch;
    if (current.status === "IN_PROGRESS") {
      current = await submitInventory(current.id);
    }
    if (current.status === "PENDING_VALIDATION") {
      current = await validateInventory(current.id);
    }
    return current;
  });
}