import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { modalFieldClassName, posSidebarFieldClassName } from "../../components/ui/form-styles";
import type { PaymentMethod } from "../../lib/api/types";
import { formatCdf, formatUsd } from "../catalog/money";
import {
  convertUsdToCdf,
  draftToAmountUsd,
  PAYMENT_METHOD_LABELS,
  paymentRequiresReference,
  paidUsdTotal,
  remainingUsd,
  type PosPaymentDraft,
} from "./pos-payments";

const PAYMENT_METHOD_ORDER: PaymentMethod[] = ["CASH", "MPESA", "ORANGE_MONEY", "AIRTEL_MONEY"];

type PosPaymentPanelProps = {
  saleTotalUsd: number;
  encaissementRate: number;
  drafts: PosPaymentDraft[];
  onChange: (drafts: PosPaymentDraft[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  /** Sans bordure externe : intégré dans la modale d’encaissement. */
  embedded?: boolean;
  onValidationMessage?: (message: string) => void;
};

export function PosPaymentPanel({
  saleTotalUsd,
  encaissementRate,
  drafts,
  onChange,
  onConfirm,
  onCancel,
  busy,
  embedded = false,
  onValidationMessage,
}: PosPaymentPanelProps) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [currency, setCurrency] = useState<"USD" | "CDF">("USD");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");

  const reste = useMemo(() => remainingUsd(saleTotalUsd, drafts, encaissementRate), [drafts, encaissementRate, saleTotalUsd]);
  const paid = useMemo(() => paidUsdTotal(drafts, encaissementRate), [drafts, encaissementRate]);
  const progress = saleTotalUsd > 0 ? Math.min(100, Math.round((paid / saleTotalUsd) * 100)) : 0;
  const canConfirm = reste === 0 && drafts.length > 0;
  const resteCdf = convertUsdToCdf(reste, encaissementRate);

  const notify = (message: string) => {
    onValidationMessage?.(message);
  };

  const addDraft = () => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      notify("Saisissez un montant strictement positif.");
      return;
    }
    const ref = reference.trim();
    if (paymentRequiresReference(method) && ref.length < 3) {
      notify(`Référence ${PAYMENT_METHOD_LABELS[method]} obligatoire (min. 3 caractères).`);
      return;
    }
    const lineUsd = currency === "USD" ? numeric : draftToAmountUsd(
        {
          localId: "",
          method,
          currency,
          amount: Math.round(numeric),
        },
        encaissementRate,
      );
    if (lineUsd > reste + 0.001) {
      notify(`Montant trop élevé : reste à payer ${formatUsd(reste)}.`);
      return;
    }
    const next: PosPaymentDraft = {
      localId: crypto.randomUUID(),
      method,
      currency,
      amount: currency === "CDF" ? Math.round(numeric) : Math.round(numeric * 100) / 100,
      providerReference: ref || undefined,
    };
    onChange([...drafts, next]);
    setAmount("");
    setReference("");
  };

  const appendRemaining = (patch: Omit<PosPaymentDraft, "localId">) => {
    if (reste <= 0) {
      return;
    }
    onChange([...drafts, { ...patch, localId: crypto.randomUUID() }]);
  };

  const shellClass = embedded
    ? "space-y-4"
    : "space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg";

  return (
    <div className={shellClass}>
      {!embedded ? (
        <PanelHeader reste={reste} resteCdf={resteCdf} rate={encaissementRate} progress={progress} paid={paid} total={saleTotalUsd} />
      ) : (
        <EmbeddedProgress reste={reste} resteCdf={resteCdf} progress={progress} paid={paid} total={saleTotalUsd} />
      )}

      <div className="flex flex-wrap gap-2">
        <QuickPayButton
          label="Tout en espèces USD"
          detail={formatUsd(reste)}
          disabled={reste <= 0}
          onClick={() =>
            appendRemaining({
              method: "CASH",
              currency: "USD",
              amount: reste,
            })
          }
        />
        <QuickPayButton
          label="Tout en espèces CDF"
          detail={formatCdf(resteCdf)}
          disabled={reste <= 0}
          onClick={() =>
            appendRemaining({
              method: "CASH",
              currency: "CDF",
              amount: resteCdf,
            })
          }
        />
      </div>

      {drafts.length > 0 ? (
        <ul className="space-y-2">
          {drafts.map((row) => (
            <li
              key={row.localId}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2.5 text-xs"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{PAYMENT_METHOD_LABELS[row.method]}</p>
                <p className="mt-0.5 font-mono tabular-nums text-slate-600">
                  {row.amount.toFixed(row.currency === "USD" ? 2 : 0)} {row.currency}
                  <span className="text-slate-400"> · </span>
                  {formatUsd(draftToAmountUsd(row, encaissementRate))}
                </p>
                {row.providerReference ? (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">Réf. {row.providerReference}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50"
                onClick={() => onChange(drafts.filter((item) => item.localId !== row.localId))}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 text-center text-xs text-slate-500">
          Ajoutez une ou plusieurs lignes de paiement jusqu’à couvrir le total.
        </p>
      )}

      <PaymentEntryForm
        method={method}
        currency={currency}
        amount={amount}
        reference={reference}
        resteUsd={reste}
        resteCdf={resteCdf}
        onMethod={setMethod}
        onCurrency={setCurrency}
        onAmount={setAmount}
        onReference={setReference}
        onAdd={addDraft}
        disabled={reste <= 0}
      />

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Annuler
        </Button>
        <Button type="button" className="min-w-0 flex-1 sm:flex-[2]" disabled={!canConfirm || busy} onClick={onConfirm}>
          {busy ? "Enregistrement…" : "Valider la vente & ticket"}
        </Button>
      </div>
    </div>
  );
}

function EmbeddedProgress(props: {
  reste: number;
  resteCdf: number;
  progress: number;
  paid: number;
  total: number;
}) {
  const settled = props.reste === 0;
  return (
    <div className="space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${settled ? "bg-emerald-500" : "bg-amber-500"}`}
          style={{ width: `${props.progress}%` }}
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className={`text-sm font-semibold ${settled ? "text-emerald-700" : "text-amber-800"}`}>
          {settled ? "Montant couvert" : "Reste à payer"}
        </p>
        <div className="text-right">
          <p className="font-mono text-base font-bold tabular-nums text-slate-900">
            {settled ? formatUsd(props.total) : formatUsd(props.reste)}
          </p>
          {!settled ? (
            <p className="font-mono text-[11px] tabular-nums text-slate-500">{formatCdf(props.resteCdf)} CDF</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PanelHeader(props: {
  reste: number;
  resteCdf: number;
  rate: number;
  progress: number;
  paid: number;
  total: number;
}) {
  return (
    <>
      <h2 className="text-lg font-semibold text-slate-900">Encaissement</h2>
      <p className="text-sm text-slate-500">
        Taux <span className="font-mono font-semibold text-slate-700">{props.rate.toLocaleString("fr-FR")}</span> CDF / USD
      </p>
      <EmbeddedProgress
        reste={props.reste}
        resteCdf={props.resteCdf}
        progress={props.progress}
        paid={props.paid}
        total={props.total}
      />
    </>
  );
}

function QuickPayButton(props: { label: string; detail: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className="flex min-w-[9rem] flex-1 flex-col items-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{props.label}</span>
      <span className="mt-0.5 font-mono text-xs font-bold tabular-nums text-slate-900">{props.detail}</span>
    </button>
  );
}

function PaymentEntryForm(props: {
  method: PaymentMethod;
  currency: "USD" | "CDF";
  amount: string;
  reference: string;
  resteUsd: number;
  resteCdf: number;
  onMethod: (value: PaymentMethod) => void;
  onCurrency: (value: "USD" | "CDF") => void;
  onAmount: (value: string) => void;
  onReference: (value: string) => void;
  onAdd: () => void;
  disabled: boolean;
}) {
  const needRef = paymentRequiresReference(props.method);
  const fieldClass = `${modalFieldClassName} mt-1`;
  const hint =
    props.currency === "USD"
      ? `Max. ${formatUsd(props.resteUsd)}`
      : `Max. ${formatCdf(props.resteCdf)}`;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nouvelle ligne</p>

      <div className="flex flex-wrap gap-1.5">
        {PAYMENT_METHOD_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => props.onMethod(key)}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
              props.method === key
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
            }`}
          >
            {PAYMENT_METHOD_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-medium text-slate-600">
          Devise
          <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-0.5">
            {(["USD", "CDF"] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => props.onCurrency(cur)}
                className={`rounded-md py-1 text-[11px] font-semibold transition ${
                  props.currency === cur ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        </label>
        <label className="text-[11px] font-medium text-slate-600">
          Montant
          <input
            type="number"
            min={0}
            step={props.currency === "USD" ? "0.01" : "1"}
            value={props.amount}
            disabled={props.disabled}
            onChange={(event) => props.onAmount(event.target.value)}
            className={`${posSidebarFieldClassName} mt-1 font-mono`}
            placeholder="0"
          />
          <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{hint}</span>
        </label>
      </div>

      {needRef ? (
        <label className="block text-[11px] font-medium text-slate-600">
          Référence {PAYMENT_METHOD_LABELS[props.method]}
          <input
            value={props.reference}
            onChange={(event) => props.onReference(event.target.value)}
            className={fieldClass}
            placeholder="Ex. MP261117.8842"
            disabled={props.disabled}
          />
        </label>
      ) : null}

      <Button type="button" variant="ghost" className="w-full" onClick={props.onAdd} disabled={props.disabled}>
        Ajouter ce paiement
      </Button>
    </div>
  );
}
