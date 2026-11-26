import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Button, ghostLinkClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import {
  FormField,
  FormSection,
  compactInputClassName,
  compactTextareaClassName,
} from "../../components/ui/FormField";
import { useToast } from "../../components/ui/Toast";
import { ApiError, formatApiErrorMessage } from "../../lib/api/errors";
import { createCashRegister, updateCashRegister } from "../../lib/api/cash-registers";
import { fetchStore, updateStore } from "../../lib/api/stores";
import type { CashRegisterSummary, ReferentialStatus } from "../../lib/api/types";
import { ReceiptPreview } from "./ReceiptPreview";
import { referentialStatusLabel, referentialStatusTone } from "./referential-status";

export function StoreEditorPage() {
  const { id } = useParams();
  const isNew = id === "new" || !id;
  const navigate = useNavigate();

  useEffect(() => {
    if (isNew) {
      navigate("/admin/stores", { replace: true, state: { openNewStore: true } });
    }
  }, [isNew, navigate]);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const storeQuery = useQuery({
    queryKey: ["store", id],
    queryFn: () => fetchStore(id!),
    enabled: Boolean(id) && id !== "new",
  });

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<ReferentialStatus>("ACTIVE");
  const [receiptHeader, setReceiptHeader] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [registerCode, setRegisterCode] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerDefault, setRegisterDefault] = useState(false);

  useEffect(() => {
    if (!storeQuery.data) {
      return;
    }
    const store = storeQuery.data;
    setCode(store.code);
    setName(store.name);
    setAddress(store.address ?? "");
    setCity(store.city ?? "");
    setPhone(store.phone ?? "");
    setStatus(store.status);
    setReceiptHeader(store.receiptHeader ?? "");
    setReceiptFooter(store.receiptFooter ?? "");
  }, [storeQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code,
        name,
        address: address.trim() || null,
        city: city.trim() || null,
        phone: phone.trim() || null,
        receiptHeader: receiptHeader.trim() || null,
        receiptFooter: receiptFooter.trim() || null,
        status,
      };
      return updateStore(id!, payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["stores"] });
      await queryClient.invalidateQueries({ queryKey: ["store", saved.id] });
      await queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      pushToast({
        tone: "success",
        message: "Fiche boutique enregistrée.",
      });
    },
    onError: (caught) => {
      pushToast({
        tone: "error",
        message: formatApiErrorMessage(caught, "Enregistrement impossible."),
      });
    },
  });

  const addRegisterMutation = useMutation({
    mutationFn: () =>
      createCashRegister({
        storeId: id!,
        code: registerCode,
        name: registerName,
        isDefault: registerDefault,
      }),
    onSuccess: async () => {
      setRegisterCode("");
      setRegisterName("");
      setRegisterDefault(false);
      await queryClient.invalidateQueries({ queryKey: ["store", id] });
      await queryClient.invalidateQueries({ queryKey: ["stores"] });
      await queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      pushToast({ tone: "success", message: "Caisse ajoutée." });
    },
    onError: (caught) => {
      pushToast({
        tone: "error",
        message: formatApiErrorMessage(caught, "Impossible d’ajouter la caisse."),
      });
    },
  });

  const updateRegisterMutation = useMutation({
    mutationFn: ({ registerId, payload }: { registerId: string; payload: { isDefault?: boolean; status?: string } }) =>
      updateCashRegister(registerId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store", id] });
      await queryClient.invalidateQueries({ queryKey: ["stores"] });
      await queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
    },
    onError: (caught) => {
      pushToast({
        tone: "error",
        message: formatApiErrorMessage(caught, "Action caisse refusée."),
      });
    },
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await saveMutation.mutateAsync();
  }

  const loadError =
    storeQuery.error instanceof ApiError ? storeQuery.error.message : storeQuery.isError ? "Fiche introuvable." : null;

  const metaLine = useMemo(() => {
    return [city.trim(), address.trim(), phone.trim()].filter(Boolean).join(" · ");
  }, [address, city, phone]);

  if (isNew) {
    return null;
  }

  if (storeQuery.isLoading) {
    return <p className="py-16 text-center text-sm text-slate-500">Ouverture de la fiche…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/admin/stores" className="text-sm text-slate-500 transition hover:text-slate-800">
          ← Retour aux boutiques
        </Link>
      </div>

      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-xl font-mono text-xs font-semibold tracking-wide ${
              status === "INACTIVE"
                ? "border border-slate-200 bg-slate-100 text-slate-500"
                : "border border-slate-800/10 bg-slate-900 text-white"
            }`}
            aria-hidden
          >
            {storeMonogram(code || storeQuery.data?.code || "BTQ")}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Fiche boutique</p>
            <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight text-slate-900">
              {name || storeQuery.data?.name || "Boutique"}
            </h1>
            <p className="mt-1 truncate text-sm text-slate-500">
              {metaLine || "Identité, ticket de caisse et terminaux POS."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                {code || storeQuery.data?.code || "—"}
              </span>
              <StatusBadge label={referentialStatusLabel(status)} tone={referentialStatusTone(status)} compact />
              {storeQuery.data ? (
                <span className="text-[11px] text-slate-400">
                  {storeQuery.data.cashRegisterCount} caisse
                  {storeQuery.data.cashRegisterCount > 1 ? "s" : ""} · {storeQuery.data.staffCount} agent
                  {storeQuery.data.staffCount > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]">
          <div className="space-y-5">
            <FormSection
              title="Identité"
              description="Le code apparaît dans les rapports et sur les documents internes."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Code" hint="Unique, 1 à 16 caractères (A-Z, 0-9, tiret).">
                  <input
                    required
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    className={`${compactInputClassName} font-mono tracking-wider`}
                    placeholder="GMB"
                  />
                </FormField>
                <FormField label="Nom">
                  <input
                    required
                    minLength={2}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={compactInputClassName}
                    placeholder="Boutique Gombe"
                  />
                </FormField>
                <FormField label="Ville">
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className={compactInputClassName}
                    placeholder="Kinshasa"
                  />
                </FormField>
                <FormField label="Téléphone">
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={compactInputClassName}
                    placeholder="+243…"
                  />
                </FormField>
                <FormField label="Adresse" className="sm:col-span-2">
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    className={compactInputClassName}
                    placeholder="Avenue, commune…"
                  />
                </FormField>
                <FormField label="Statut">
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as ReferentialStatus)}
                    className={compactInputClassName}
                  >
                    <option value="ACTIVE">En service</option>
                    <option value="INACTIVE">Hors service</option>
                  </select>
                </FormField>
              </div>
            </FormSection>

            <FormSection
              title="Ticket de caisse"
              description="Textes imprimés en tête et en pied du ticket 80 mm. L’aperçu se met à jour immédiatement."
            >
              <div className="grid gap-3 lg:grid-cols-2">
                <FormField label="En-tête">
                  <textarea
                    value={receiptHeader}
                    onChange={(event) => setReceiptHeader(event.target.value)}
                    className={compactTextareaClassName}
                    placeholder="EYANO — Boutique Gombe"
                  />
                </FormField>
                <FormField label="Pied de ticket">
                  <textarea
                    value={receiptFooter}
                    onChange={(event) => setReceiptFooter(event.target.value)}
                    className={compactTextareaClassName}
                    placeholder="Merci de votre visite"
                  />
                </FormField>
              </div>
            </FormSection>
          </div>

          <div className="xl:sticky xl:top-4 xl:self-start">
            <ReceiptPreview storeName={name} city={city} header={receiptHeader} footer={receiptFooter} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Link to="/admin/stores" className={ghostLinkClassName}>
            Annuler
          </Link>
          <Button type="submit" disabled={saveMutation.isPending} className="px-6">
            {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>

      {storeQuery.data ? (
        <CashRegistersPanel
          registers={storeQuery.data.cashRegisters}
          registerCode={registerCode}
          registerName={registerName}
          registerDefault={registerDefault}
          pending={addRegisterMutation.isPending || updateRegisterMutation.isPending}
          onCodeChange={setRegisterCode}
          onNameChange={setRegisterName}
          onDefaultChange={setRegisterDefault}
          onAdd={() => {
            const nextCode = registerCode.trim().toUpperCase();
            if (storeQuery.data?.cashRegisters.some((register) => register.code === nextCode)) {
              pushToast({
                tone: "error",
                message: "Ce code caisse est déjà utilisé dans cette boutique.",
              });
              return;
            }
            void addRegisterMutation.mutateAsync();
          }}
          onSetDefault={(registerId) => {
            void updateRegisterMutation.mutateAsync({ registerId, payload: { isDefault: true } });
          }}
          onToggleStatus={(register) => {
            void updateRegisterMutation.mutateAsync({
              registerId: register.id,
              payload: { status: register.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
            });
          }}
        />
      ) : null}
    </div>
  );
}

function CashRegistersPanel({
  registers,
  registerCode,
  registerName,
  registerDefault,
  pending,
  onCodeChange,
  onNameChange,
  onDefaultChange,
  onAdd,
  onSetDefault,
  onToggleStatus,
}: {
  registers: CashRegisterSummary[];
  registerCode: string;
  registerName: string;
  registerDefault: boolean;
  pending: boolean;
  onCodeChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onDefaultChange: (value: boolean) => void;
  onAdd: () => void;
  onSetDefault: (id: string) => void;
  onToggleStatus: (register: CashRegisterSummary) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Caisses de la boutique</h2>
        <p className="mt-1 text-xs text-slate-500">
          Une seule caisse par défaut. Le code est unique dans cette boutique.
        </p>
      </div>

      {registers.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">Aucune caisse — ajoutez le premier terminal.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {registers.map((register) => {
            const inactive = register.status === "INACTIVE";
            return (
              <li
                key={register.id}
                className={`flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between ${
                  inactive ? "bg-slate-50/50" : ""
                }`}
              >
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl font-mono text-[10px] font-semibold ${
                      register.isDefault
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                    aria-hidden
                  >
                    {register.code.slice(0, 3)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-500">{register.code}</span>
                      {register.isDefault ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          Par défaut
                        </span>
                      ) : null}
                      <StatusBadge
                        label={referentialStatusLabel(register.status)}
                        tone={referentialStatusTone(register.status)}
                        compact
                      />
                    </div>
                    <p className={`mt-1 text-sm font-semibold ${inactive ? "text-slate-500" : "text-slate-900"}`}>
                      {register.name}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 self-end sm:self-center">
                  {!register.isDefault ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      disabled={pending}
                      onClick={() => onSetDefault(register.id)}
                    >
                      Définir par défaut
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-3 py-1.5 text-xs"
                    disabled={pending}
                    onClick={() => onToggleStatus(register)}
                  >
                    {register.status === "ACTIVE" ? "Désactiver" : "Réactiver"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="grid gap-3 border-t border-dashed border-slate-200 bg-slate-50/60 px-5 py-4 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd();
        }}
      >
        <FormField label="Code">
          <input
            required
            value={registerCode}
            onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
            className={`${compactInputClassName} font-mono`}
            placeholder="C02"
          />
        </FormField>
        <FormField label="Nom">
          <input
            required
            minLength={2}
            value={registerName}
            onChange={(event) => onNameChange(event.target.value)}
            className={compactInputClassName}
            placeholder="Caisse 2"
          />
        </FormField>
        <div className="flex flex-wrap items-center gap-3 pb-0.5">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={registerDefault}
              onChange={(event) => onDefaultChange(event.target.checked)}
            />
            Par défaut
          </label>
          <Button type="submit" disabled={pending} className="px-4 py-2">
            Ajouter
          </Button>
        </div>
      </form>
    </section>
  );
}

function storeMonogram(code: string): string {
  const cleaned = code.replace(/^BTQ[-_]?/i, "").replace(/[^A-Za-z0-9]/g, "");
  if (cleaned.length <= 3) {
    return cleaned.toUpperCase() || code.slice(0, 3).toUpperCase();
  }
  return cleaned.slice(0, 3).toUpperCase();
}
