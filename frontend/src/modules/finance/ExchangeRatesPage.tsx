import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "../../components/ui/Alert";
import { inputClassName } from "../../components/ui/FormField";
import { PageHeader } from "../../components/ui/PageHeader";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchCurrentExchangeRates, fetchExchangeRateRevisions, updateExchangeRatesPair } from "../../lib/api/exchange-rates";
import { hasPermission } from "../../lib/auth/permissions";
import { DEFAULT_DECAISSEMENT_CDF_PER_USD, DEFAULT_ENCAISSEMENT_CDF_PER_USD } from "../../lib/money/exchange-rate-defaults";
import { Pagination } from "../../components/ui/Pagination";
import { useClientPagination } from "../../lib/pagination/client-pagination";
import { useAuth } from "../auth/AuthProvider";

export function ExchangeRatesPage() {
  const { user } = useAuth();
  const canUpdate = hasPermission(user, "exchange_rates.update");
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [encRate, setEncRate] = useState(String(DEFAULT_ENCAISSEMENT_CDF_PER_USD));
  const [decRate, setDecRate] = useState(String(DEFAULT_DECAISSEMENT_CDF_PER_USD));
  const [rateNotes, setRateNotes] = useState("");

  const currentQuery = useQuery({
    queryKey: ["exchange-rates-current"],
    queryFn: fetchCurrentExchangeRates,
  });

  const revisionsQuery = useQuery({
    queryKey: ["exchange-rates-revisions"],
    queryFn: () => fetchExchangeRateRevisions(40),
  });

  useEffect(() => {
    const enc = currentQuery.data?.encaissement?.rate;
    const dec = currentQuery.data?.decaissement?.rate;
    if (enc != null) {
      setEncRate(String(Math.round(enc)));
    }
    if (dec != null) {
      setDecRate(String(Math.round(dec)));
    }
  }, [currentQuery.data?.encaissement?.rate, currentQuery.data?.decaissement?.rate]);

  const updateMutation = useMutation({
    mutationFn: updateExchangeRatesPair,
    onSuccess: async () => {
      setRateNotes("");
      await queryClient.invalidateQueries({ queryKey: ["exchange-rates-current"] });
      await queryClient.invalidateQueries({ queryKey: ["exchange-rates-revisions"] });
      pushToast({ tone: "success", message: "Taux de change mis à jour et historisés." });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Mise à jour impossible.") }),
  });

  const errorMessage = currentQuery.isError ? formatApiErrorMessage(currentQuery.error, "Chargement impossible.") : null;

  const handleUpdateRates = (event: FormEvent) => {
    event.preventDefault();
    const enc = Number(encRate);
    const dec = Number(decRate);
    if (!Number.isFinite(enc) || enc <= 0 || !Number.isFinite(dec) || dec <= 0) {
      pushToast({ tone: "error", message: "Les deux taux doivent être supérieurs à zéro." });
      return;
    }
    updateMutation.mutate({
      encaissementRate: enc,
      decaissementRate: dec,
      reason: rateNotes.trim() || undefined,
    });
  };

  const encDisplay = currentQuery.data?.encaissement?.rate;
  const decDisplay = currentQuery.data?.decaissement?.rate;
  const revisionRows = revisionsQuery.data?.items ?? [];
  const {
    page: revisionsPage,
    setPage: setRevisionsPage,
    slice: pagedRevisions,
    totalPages: revisionsTotalPages,
    totalItems: revisionsTotalItems,
  } = useClientPagination(revisionRows, 15);

  const headerDescription =
    encDisplay != null && decDisplay != null
      ? `Taux actif : ${encDisplay.toLocaleString("fr-FR")} CDF (encaissement) / ${decDisplay.toLocaleString("fr-FR")} CDF (décaissement)`
      : "Encaissement (ventes) et décaissement (dépenses). Les ventes figent le taux d’encaissement sur chaque ligne CDF.";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Finance" title="Taux de change" description={headerDescription} />

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {revisionsQuery.isError ? (
          <div className="lg:col-span-12">
            <Alert tone="error">{formatApiErrorMessage(revisionsQuery.error, "Historique indisponible.")}</Alert>
          </div>
        ) : null}

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
          <h2 className="text-base font-semibold text-slate-900">Taux de change USD ↔ CDF</h2>
          <form onSubmit={handleUpdateRates} className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block font-medium text-slate-700">Taux d’encaissement (1 USD → CDF)</label>
              <input
                type="number"
                min={1}
                step={1}
                disabled={!canUpdate}
                value={encRate}
                onChange={(event) => setEncRate(event.target.value)}
                className={`${inputClassName} font-mono`}
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">Taux de décaissement (1 USD → CDF)</label>
              <input
                type="number"
                min={1}
                step={1}
                disabled={!canUpdate}
                value={decRate}
                onChange={(event) => setDecRate(event.target.value)}
                className={`${inputClassName} font-mono`}
              />
            </div>
            {canUpdate ? (
              <>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Note</label>
                  <input
                    type="text"
                    value={rateNotes}
                    onChange={(event) => setRateNotes(event.target.value)}
                    placeholder="Motif de révision du taux"
                    className={inputClassName}
                  />
                </div>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Enregistrer les nouveaux taux
                </button>
              </>
            ) : (
              <Alert tone="info">Permission exchange_rates.update requise pour modifier.</Alert>
            )}
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Historique des taux de change</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 text-right font-medium">Encaissement</th>
                  <th className="py-2 text-right font-medium">Décaissement</th>
                  <th className="py-2 pl-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedRevisions.map((row) => (
                  <tr key={row.validFrom}>
                    <td className="py-2 font-mono text-slate-500">{new Date(row.validFrom).toLocaleString("fr-FR")}</td>
                    <td className="py-2 text-right font-mono tabular-nums font-semibold">
                      {row.encaissementRate.toLocaleString("fr-FR")} CDF
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {row.decaissementRate != null ? `${row.decaissementRate.toLocaleString("fr-FR")} CDF` : "—"}
                    </td>
                    <td className="py-2 pl-3 text-slate-600">{row.note?.trim() || "—"}</td>
                  </tr>
                ))}
                {!revisionsQuery.isLoading && revisionRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-500">
                      Aucun historique.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {revisionRows.length > 0 ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <Pagination
                page={revisionsPage}
                totalPages={revisionsTotalPages}
                totalItems={revisionsTotalItems}
                onPageChange={setRevisionsPage}
                itemLabel="révisions"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}