import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { FormField, textareaClassName } from "../../components/ui/FormField";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchSale, voidSale } from "../../lib/api/sales";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { PAYMENT_METHOD_LABELS } from "../pos/pos-payments";
import { saleStatusLabel, saleStatusTone } from "./sale-status";

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const canVoid = hasPermission(user, "sales.void");

  const close = () => navigate("/admin/sales");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        navigate("/admin/sales");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const detailQuery = useQuery({
    queryKey: ["sale", id],
    queryFn: () => fetchSale(id!),
    enabled: Boolean(id),
  });

  const voidMutation = useMutation({
    mutationFn: () => voidSale(id!, reason.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sale", id] });
      await queryClient.invalidateQueries({ queryKey: ["sales"] });
      pushToast({ tone: "success", message: "Vente annulée, stock réintégré." });
      setReason("");
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Annulation impossible.") }),
  });

  const sale = detailQuery.data;
  const loadError = detailQuery.isError ? formatApiErrorMessage(detailQuery.error, "Chargement impossible.") : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fermer la fiche vente" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-detail-title"
        className="relative flex max-h-[min(92vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {sale?.store.name ?? "Vente"}
            </p>
            <h2 id="sale-detail-title" className="mt-0.5 truncate text-xl font-bold tracking-tight text-slate-900">
              {sale?.number ?? "Fiche vente"}
            </h2>
            {sale ? (
              <p className="mt-1 text-xs text-slate-600">
                {sale.cashier.firstName} {sale.cashier.lastName} · {new Date(sale.completedAt).toLocaleString("fr-FR")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Chargement…</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {sale ? <StatusBadge label={saleStatusLabel(sale.status)} tone={saleStatusTone(sale.status)} /> : null}
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {loadError ? <Alert tone="error">{loadError}</Alert> : null}

          {sale ? (
            <>
              <section className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Lignes</h3>
                  <ul className="mt-3 space-y-2">
                    {sale.items.map((line) => (
                      <li key={line.id} className="flex justify-between gap-2 text-sm">
                        <span className="text-slate-900">
                          {line.reference} — {line.name} × {line.quantity}
                        </span>
                        <span className="font-mono text-slate-600">{line.lineTotal.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-slate-900">
                    <span>Total</span>
                    <span className="font-mono">{sale.total.toFixed(2)} USD</span>
                  </div>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Encaissements</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {sale.payments.map((payment) => (
                      <li key={payment.id} className="rounded-lg border border-slate-100 px-3 py-2">
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-800">
                            {PAYMENT_METHOD_LABELS[payment.method]} —{" "}
                            {payment.amount.toFixed(payment.currency === "USD" ? 2 : 0)} {payment.currency}
                          </span>
                          <span className="font-mono text-slate-900">{payment.amountUsd.toFixed(2)} USD</span>
                        </div>
                        {payment.providerReference ? (
                          <p className="text-xs text-slate-500">Réf. {payment.providerReference}</p>
                        ) : null}
                        {payment.rateSnapshot ? (
                          <p className="text-xs text-slate-500">Taux figé {payment.rateSnapshot.toLocaleString("fr-FR")}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </article>
              </section>

              {sale.status === "COMPLETED" && canVoid ? (
                <section className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <h3 className="text-sm font-semibold text-red-800">Annuler la vente</h3>
                  <p className="mt-1 text-xs text-red-900/80">Réintègre le stock boutique. Irréversible côté ticket.</p>
                  <div className="mt-3">
                    <FormField label="Motif">
                      <textarea
                        rows={2}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className={textareaClassName}
                      />
                    </FormField>
                  </div>
                  <Button
                    variant="danger"
                    className="mt-3"
                    disabled={reason.trim().length < 3 || voidMutation.isPending}
                    onClick={() => voidMutation.mutate()}
                  >
                    Annuler cette vente
                  </Button>
                </section>
              ) : null}

              {sale.voidReason ? <Alert tone="info">Annulée : {sale.voidReason}</Alert> : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
