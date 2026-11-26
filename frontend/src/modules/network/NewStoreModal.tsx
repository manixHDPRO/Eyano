import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { modalFieldClassName } from "../../components/ui/form-styles";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { createStore } from "../../lib/api/stores";

const emptyForm = { code: "", name: "", address: "", phone: "" };

type NewStoreModalProps = {
  open: boolean;
  onClose: () => void;
};

export function NewStoreModal({ open, onClose }: NewStoreModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(emptyForm);
    setErrorMessage(null);
  }, [open]);

  const createMutation = useMutation({
    mutationFn: () =>
      createStore({
        code: form.code.trim(),
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stores"] });
      pushToast({ tone: "success", message: "Boutique créée avec sa caisse dédiée." });
      onClose();
    },
    onError: (caught) => {
      setErrorMessage(formatApiErrorMessage(caught, "Erreur lors de la création de la boutique (code existant ?)."));
    },
  });

  if (!open) {
    return null;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    void createMutation.mutateAsync();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        role="dialog"
        aria-labelledby="new-store-title"
        aria-modal="true"
      >
        <h3 id="new-store-title" className="text-lg font-semibold text-slate-900">
          Nouvelle boutique
        </h3>

        {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="mb-1 block font-medium text-slate-700">Code boutique *</span>
            <input
              type="text"
              required
              autoFocus
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              placeholder="Ex: BTQ-D"
              className={`${modalFieldClassName} font-mono`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium text-slate-700">Nom de la boutique *</span>
            <input
              type="text"
              required
              minLength={2}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ex: Boutique D — Bandal"
              className={modalFieldClassName}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium text-slate-700">Adresse *</span>
            <input
              type="text"
              required
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              className={modalFieldClassName}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium text-slate-700">Téléphone *</span>
            <input
              type="text"
              required
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className={modalFieldClassName}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
            >
              {createMutation.isPending ? "Création…" : "Créer la boutique"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}