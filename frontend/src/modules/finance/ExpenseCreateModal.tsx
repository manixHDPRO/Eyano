import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchCashRegisters } from "../../lib/api/cash-registers";
import {
  createExpense,
  expenseLocationKey,
  fetchExpenseLocations,
  uploadExpenseReceipt,
} from "../../lib/api/expenses";
import type { ExpenseCategoryCode } from "../../lib/api/types";
import { fetchCurrentExchangeRates } from "../../lib/api/exchange-rates";
import { DEFAULT_DECAISSEMENT_CDF_PER_USD } from "../../lib/money/exchange-rate-defaults";
import { formatCdf, formatUsd } from "../catalog/money";
import { EXPENSE_CATEGORY_OPTIONS } from "./expense-labels";

type ExpenseCreateModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ExpenseCreateModal({ open, onClose }: ExpenseCreateModalProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const locationsQuery = useQuery({
    queryKey: ["expense-locations"],
    queryFn: fetchExpenseLocations,
    enabled: open,
  });

  const ratesQuery = useQuery({
    queryKey: ["exchange-rates-current"],
    queryFn: fetchCurrentExchangeRates,
    enabled: open,
    staleTime: 60_000,
  });

  const [locationKey, setLocationKey] = useState("");
  const [category, setCategory] = useState<ExpenseCategoryCode>("TRANSPORT");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "CDF">("USD");
  const [spentAt, setSpentAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [description, setDescription] = useState("");
  const [fromCashDrawer, setFromCashDrawer] = useState(false);
  const [cashRegisterId, setCashRegisterId] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const selectedLocation = useMemo(() => {
    const items = locationsQuery.data?.items ?? [];
    return items.find((row) => expenseLocationKey(row) === locationKey);
  }, [locationsQuery.data, locationKey]);

  const storeIdForRegisters =
    selectedLocation?.scopeType === "STORE" ? selectedLocation.store.id : undefined;

  const registersQuery = useQuery({
    queryKey: ["expense-cash-registers", storeIdForRegisters],
    queryFn: () => fetchCashRegisters({ storeId: storeIdForRegisters, status: "ACTIVE", page: 1, pageSize: 100 }),
    enabled: open && Boolean(storeIdForRegisters && fromCashDrawer),
  });

  const decaissementRate = ratesQuery.data?.decaissement?.rate ?? DEFAULT_DECAISSEMENT_CDF_PER_USD;
  const usdPreview = useMemo(() => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }
    if (currency === "USD") {
      return numeric;
    }
    return numeric / decaissementRate;
  }, [amount, currency, decaissementRate]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const items = locationsQuery.data?.items ?? [];
    if (!locationKey && items.length > 0) {
      const store = items.find((row) => row.scopeType === "STORE") ?? items[0];
      setLocationKey(expenseLocationKey(store));
    }
  }, [open, locationsQuery.data, locationKey]);

  useEffect(() => {
    if (selectedLocation?.scopeType === "WAREHOUSE") {
      setFromCashDrawer(false);
    }
  }, [selectedLocation]);

  useEffect(() => {
    const items = registersQuery.data?.items ?? [];
    if (!cashRegisterId && items.length > 0) {
      const preferred = items.find((row) => row.isDefault) ?? items[0];
      setCashRegisterId(preferred.id);
    }
  }, [registersQuery.data, cashRegisterId, locationKey]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLocation) {
        throw new Error("Sélectionnez un site.");
      }
      const numeric = Number(amount);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        throw new Error("Montant invalide.");
      }

      const spentAtIso = spentAt ? new Date(spentAt).toISOString() : undefined;

      const payload =
        selectedLocation.scopeType === "WAREHOUSE"
          ? {
              scopeType: "WAREHOUSE" as const,
              warehouseId: selectedLocation.warehouse.id,
              category,
              amount: numeric,
              currency,
              spentAt: spentAtIso,
              description: description.trim() || undefined,
              fromCashDrawer: false,
            }
          : {
              scopeType: "STORE" as const,
              storeId: selectedLocation.store.id,
              category,
              amount: numeric,
              currency,
              spentAt: spentAtIso,
              description: description.trim() || undefined,
              fromCashDrawer,
              cashRegisterId: fromCashDrawer ? cashRegisterId : undefined,
            };

      const created = await createExpense(payload);
      if (receiptFile) {
        await uploadExpenseReceipt(created.id, receiptFile);
      }
      return created;
    },
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["cash-session"] });
      pushToast({
        tone: "success",
        message:
          detail.status === "PENDING_CASHIER_CONFIRMATION"
            ? `Dépense ${detail.reference} enregistrée — en attente de confirmation caissière.`
            : `Dépense ${detail.reference} enregistrée.`,
      });
      setAmount("");
      setDescription("");
      setReceiptFile(null);
      onClose();
    },
    onError: (error) =>
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Enregistrement impossible.") }),
  });

  if (!open) {
    return null;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitMutation.mutate();
  }

  const drawerNeedsRegister =
    selectedLocation?.scopeType === "STORE" &&
    fromCashDrawer &&
    (registersQuery.data?.items.length ?? 0) === 0 &&
    !registersQuery.isLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pb-3 pt-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Nouvelle dépense</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Boutique ou entrepôt, USD / CDF. Les sorties tiroir sont confirmées par la caissière en POS.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6 pt-2 text-sm">
          {fromCashDrawer && selectedLocation?.scopeType === "STORE" ? (
            <Alert tone="info">
              La caissière devra confirmer la sortie d’espèces sur la caisse sélectionnée avant impact sur le solde
              théorique.
            </Alert>
          ) : null}
          {drawerNeedsRegister ? (
            <Alert tone="error">Aucune caisse active sur cette boutique — impossible de cibler un tiroir.</Alert>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Site *</span>
            <select
              value={locationKey}
              onChange={(event) => setLocationKey(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              {(locationsQuery.data?.items ?? []).map((option) => (
                <option key={expenseLocationKey(option)} value={expenseLocationKey(option)}>
                  {option.scopeType === "WAREHOUSE"
                    ? `Entrepôt — ${option.warehouse.name}`
                    : `${option.store.name}${option.store.city ? ` (${option.store.city})` : ""}`}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-slate-700">Catégorie *</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as ExpenseCategoryCode)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                {EXPENSE_CATEGORY_OPTIONS.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Montant *</span>
              <input
                type="number"
                min={currency === "USD" ? 0.01 : 1}
                step={currency === "USD" ? 0.01 : 1}
                inputMode="decimal"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono tabular-nums"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Devise *</span>
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value as "USD" | "CDF")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                <option value="USD">USD</option>
                <option value="CDF">CDF</option>
              </select>
            </label>
          </div>

          {usdPreview != null ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Contre-valeur indicative (taux décaissement{" "}
              <span className="font-mono font-semibold">{Math.round(decaissementRate)}</span> CDF/USD) :{" "}
              <span className="font-mono font-semibold text-slate-900">{formatUsd(usdPreview)}</span>
              {currency === "CDF" ? (
                <span className="text-slate-500"> — saisi {formatCdf(Number(amount))}</span>
              ) : null}
            </p>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Date et heure</span>
            <input
              type="datetime-local"
              value={spentAt}
              onChange={(event) => setSpentAt(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Motif, fournisseur, notes internes…"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          {fromCashDrawer && selectedLocation?.scopeType === "STORE" ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Caisse concernée *</span>
              <select
                value={cashRegisterId}
                onChange={(event) => setCashRegisterId(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                {(registersQuery.data?.items ?? []).map((register) => (
                  <option key={register.id} value={register.id}>
                    {register.code} — {register.name}
                    {register.isDefault ? " (défaut)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {selectedLocation?.scopeType === "STORE" ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <input
                type="checkbox"
                checked={fromCashDrawer}
                onChange={(event) => setFromCashDrawer(event.target.checked)}
                className="mt-0.5 rounded border-slate-300"
              />
              <span className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Prélever le tiroir espèces</span>
                <br />
                Après confirmation caissière : fond + encaissements espèces − dépenses sur le solde théorique.
              </span>
            </label>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Justificatif (optionnel)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
              className="w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
            />
            <span className="text-[11px] text-slate-500">JPEG, PNG, WebP ou PDF · 5 Mo max.</span>
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending || drawerNeedsRegister}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitMutation.isPending ? "Enregistrement…" : "Enregistrer la dépense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}