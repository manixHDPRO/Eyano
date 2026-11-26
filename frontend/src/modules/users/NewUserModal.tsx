import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { modalFieldClassName } from "../../components/ui/form-styles";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchRoles } from "../../lib/api/roles";
import { fetchStoresForAssignment } from "../../lib/api/stores";
import { createUser, setUserStores } from "../../lib/api/users";
import { useAuth } from "../auth/AuthProvider";

type NewUserModalProps = {
  open: boolean;
  onClose: () => void;
};

export function NewUserModal({ open, onClose }: NewUserModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { user: actor } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [selectedStores, setSelectedStores] = useState<Record<string, boolean>>({});
  const [primaryStoreId, setPrimaryStoreId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
    enabled: open,
  });

  const storesQuery = useQuery({
    queryKey: ["stores-assignment"],
    queryFn: fetchStoresForAssignment,
    enabled: open,
  });

  const assignableRoles = useMemo(() => {
    const items = rolesQuery.data?.items ?? [];
    if (actor?.role.code === "SUPER_ADMIN") {
      return items;
    }
    return items.filter((role) => role.code !== "SUPER_ADMIN");
  }, [rolesQuery.data, actor?.role.code]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setRoleId("");
    setSelectedStores({});
    setPrimaryStoreId("");
    setErrorMessage(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const saved = await createUser({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        roleId,
      });
      const storeLinks = Object.entries(selectedStores)
        .filter(([, checked]) => checked)
        .map(([storeId]) => ({
          storeId,
          isPrimary: storeId === primaryStoreId,
        }));
      if (storeLinks.length > 0) {
        if (!primaryStoreId) {
          storeLinks[0] = { ...storeLinks[0], isPrimary: true };
        }
        await setUserStores(saved.id, storeLinks);
      }
      return saved;
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      pushToast({ tone: "success", message: "Utilisateur créé." });
      onClose();
      navigate(`/admin/users/${saved.id}`);
    },
    onError: (caught) => {
      setErrorMessage(formatApiErrorMessage(caught, "Création impossible (e-mail déjà utilisé ?)."));
    },
  });

  if (!open) {
    return null;
  }

  const storeItems = storesQuery.data?.items ?? [];

  function toggleStore(storeId: string) {
    setSelectedStores((current) => {
      const next = { ...current, [storeId]: !current[storeId] };
      if (!next[storeId] && primaryStoreId === storeId) {
        setPrimaryStoreId("");
      }
      return next;
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    void createMutation.mutateAsync();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        className="flex max-h-[min(92vh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-labelledby="new-user-title"
        aria-modal="true"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="new-user-title" className="text-lg font-semibold text-slate-900">
              Nouvel utilisateur
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">Identité, rôle initial et boutiques accessibles.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fermer"
          >
            ✕
          </button>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-xs">
            {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <ModalField label="Prénom *">
                <input
                  required
                  autoFocus
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className={modalFieldClassName}
                  autoComplete="given-name"
                />
              </ModalField>
              <ModalField label="Nom *">
                <input
                  required
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className={modalFieldClassName}
                  autoComplete="family-name"
                />
              </ModalField>
            </div>

            <ModalField label="E-mail *">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={modalFieldClassName}
                autoComplete="email"
              />
            </ModalField>

            <div className="grid gap-3 sm:grid-cols-2">
              <ModalField label="Téléphone">
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className={modalFieldClassName}
                  autoComplete="tel"
                />
              </ModalField>
              <ModalField label="Rôle *">
                <select
                  required
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                  className={modalFieldClassName}
                >
                  <option value="">Choisir…</option>
                  {assignableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </ModalField>
            </div>

            <ModalField label="Mot de passe initial *" hint="Minimum 10 caractères.">
              <input
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={modalFieldClassName}
                autoComplete="new-password"
              />
            </ModalField>

            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-900">Boutiques affectées</p>
              <p className="text-slate-500">Requis pour les caissiers ; optionnel pour les profils centraux.</p>
              {storeItems.length === 0 ? (
                <p className="text-slate-500">
                  Aucune boutique active —{" "}
                  <Link to="/admin/stores" className="font-medium text-slate-700 hover:text-slate-900" onClick={onClose}>
                    créer une boutique
                  </Link>
                  .
                </p>
              ) : (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {storeItems.map((store) => {
                    const checked = Boolean(selectedStores[store.id]);
                    return (
                      <li
                        key={store.id}
                        className={`rounded-lg border px-2.5 py-2 ${checked ? "border-slate-300 bg-slate-50" : "border-slate-100"}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="flex min-w-0 cursor-pointer items-center gap-2">
                            <input type="checkbox" checked={checked} onChange={() => toggleStore(store.id)} />
                            <span className="truncate text-slate-800">
                              {store.name}
                              <span className="ml-1 font-mono text-[10px] text-slate-500">{store.code}</span>
                            </span>
                          </label>
                          {checked ? (
                            <label className="flex cursor-pointer items-center gap-1 text-[10px] font-medium text-slate-600">
                              <input
                                type="radio"
                                name="newUserPrimaryStore"
                                checked={primaryStoreId === store.id}
                                onChange={() => setPrimaryStoreId(store.id)}
                              />
                              Principale
                            </label>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
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
              {createMutation.isPending ? "Création…" : "Créer l’utilisateur"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function ModalField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-slate-500">{hint}</span> : null}
    </label>
  );
}