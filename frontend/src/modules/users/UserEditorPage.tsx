import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Button, ghostLinkClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { FormField, FormSection, compactInputClassName } from "../../components/ui/FormField";
import { useToast } from "../../components/ui/Toast";
import { fetchRoles } from "../../lib/api/roles";
import { fetchStoresForAssignment } from "../../lib/api/stores";
import { deactivateUser, fetchUser, setUserStores, updateUser } from "../../lib/api/users";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { LoginHistoryRecentPanel } from "../login-history/LoginHistoryRecentPanel";
import {
  roleChipClassName,
  userFullName,
  userInitials,
  userStatusLabel,
  userStatusTone,
} from "./user-display";

export function UserEditorPage() {
  const { id } = useParams();
  const isNew = id === "new" || !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: actor } = useAuth();
  const { pushToast, confirm } = useToast();

  useEffect(() => {
    if (isNew) {
      navigate("/admin/users", { replace: true, state: { openNewUser: true } });
    }
  }, [isNew, navigate]);

  const userQuery = useQuery({
    queryKey: ["user", id],
    queryFn: () => fetchUser(id!),
    enabled: !isNew && Boolean(id),
  });

  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: fetchRoles });
  const storesQuery = useQuery({ queryKey: ["stores-assignment"], queryFn: fetchStoresForAssignment });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [selectedStores, setSelectedStores] = useState<Record<string, boolean>>({});
  const [primaryStoreId, setPrimaryStoreId] = useState("");

  useEffect(() => {
    if (!userQuery.data) {
      return;
    }
    const user = userQuery.data;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    setPhone(user.phone ?? "");
    setRoleId(user.role.id);
    const map: Record<string, boolean> = {};
    let primary = "";
    for (const store of user.stores) {
      map[store.id] = true;
      if (store.isPrimary) {
        primary = store.id;
      }
    }
    setSelectedStores(map);
    setPrimaryStoreId(primary);
  }, [userQuery.data]);

  const assignableRoles = useMemo(() => {
    const items = rolesQuery.data?.items ?? [];
    if (actor?.role.code === "SUPER_ADMIN") {
      return items;
    }
    return items.filter((role) => role.code !== "SUPER_ADMIN");
  }, [rolesQuery.data, actor?.role.code]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const saved = await updateUser(id!, {
        firstName,
        lastName,
        phone: phone.trim() || null,
        roleId,
      });
      const storeLinks = Object.entries(selectedStores)
        .filter(([, checked]) => checked)
        .map(([storeId]) => ({
          storeId,
          isPrimary: storeId === primaryStoreId,
        }));
      if (storeLinks.length > 0 && !primaryStoreId) {
        storeLinks[0] = { ...storeLinks[0], isPrimary: true };
      }
      await setUserStores(saved.id, storeLinks);
      return saved;
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user", saved.id] });
      pushToast({ tone: "success", message: "Enregistrement réussi." });
    },
    onError: (caught) => {
      pushToast({
        tone: "error",
        message: formatApiErrorMessage(caught, "Enregistrement impossible."),
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateUser(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user", id] });
      pushToast({ tone: "success", message: "Compte désactivé." });
    },
    onError: (caught) => {
      pushToast({
        tone: "error",
        message: formatApiErrorMessage(caught, "Action refusée."),
      });
    },
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await saveMutation.mutateAsync();
  }

  function toggleStore(storeId: string) {
    setSelectedStores((current) => {
      const next = { ...current, [storeId]: !current[storeId] };
      if (!next[storeId] && primaryStoreId === storeId) {
        setPrimaryStoreId("");
      }
      return next;
    });
  }

  const targetIsSuperAdmin = userQuery.data?.role.code === "SUPER_ADMIN";
  const canEditSuper = actor?.role.code === "SUPER_ADMIN";
  const selectedRole = assignableRoles.find((role) => role.id === roleId) ?? userQuery.data?.role;
  const storeItems = storesQuery.data?.items ?? [];
  const selectedStoreCount = Object.values(selectedStores).filter(Boolean).length;
  const canReadAudit = hasPermission(actor, "audit.read");
  const loadError = userQuery.isError
    ? formatApiErrorMessage(userQuery.error, "Fiche utilisateur introuvable.")
    : null;
  const inactive = userQuery.data?.status === "INACTIVE" || userQuery.data?.status === "LOCKED";

  if (isNew) {
    return null;
  }

  if (userQuery.isLoading) {
    return <p className="py-16 text-center text-sm text-slate-500">Ouverture de la fiche…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/admin/users" className="text-sm text-slate-500 transition hover:text-slate-800">
          ← Retour à Utilisateurs & Rôles
        </Link>
      </div>

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-xl text-sm font-semibold tracking-wide ${
              inactive
                ? "border border-slate-200 bg-slate-100 text-slate-500"
                : "border border-slate-800/10 bg-slate-900 text-white"
            }`}
            aria-hidden
          >
            {userInitials({ firstName, lastName })}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Fiche utilisateur</p>
            <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight text-slate-900">
              {userFullName({ firstName, lastName }) || "Utilisateur"}
            </h1>
            <p className="mt-1 truncate font-mono text-xs text-slate-500">{email || "—"}</p>
            {userQuery.data ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={userStatusLabel(userQuery.data.status)}
                  tone={userStatusTone(userQuery.data.status)}
                  compact
                />
                {selectedRole ? (
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleChipClassName(selectedRole.code)}`}
                  >
                    {selectedRole.name}
                  </span>
                ) : null}
                {targetIsSuperAdmin ? (
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                    Compte protégé
                  </span>
                ) : null}
                <span className="text-[11px] text-slate-400">
                  {selectedStoreCount} boutique{selectedStoreCount > 1 ? "s" : ""}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <form className="space-y-5" onSubmit={onSubmit}>
        <div className={`grid gap-5 ${canReadAudit ? "xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]" : ""}`}>
          <div className="space-y-5">
            <FormSection title="Identité" description="Coordonnées et rôle métier du compte.">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Prénom">
                  <input
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className={compactInputClassName}
                    autoComplete="given-name"
                    disabled={targetIsSuperAdmin && !canEditSuper}
                  />
                </FormField>
                <FormField label="Nom">
                  <input
                    required
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className={compactInputClassName}
                    autoComplete="family-name"
                    disabled={targetIsSuperAdmin && !canEditSuper}
                  />
                </FormField>
                <FormField label="E-mail" className="sm:col-span-2">
                  <input
                    type="email"
                    required
                    readOnly
                    value={email}
                    className={`${compactInputClassName} bg-slate-50 text-slate-600`}
                    autoComplete="email"
                  />
                </FormField>
                <FormField label="Téléphone">
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={compactInputClassName}
                    autoComplete="tel"
                    placeholder="+243…"
                    disabled={targetIsSuperAdmin && !canEditSuper}
                  />
                </FormField>
                <FormField label="Rôle">
                  <select
                    required
                    value={roleId}
                    disabled={targetIsSuperAdmin && !canEditSuper}
                    onChange={(event) => setRoleId(event.target.value)}
                    className={compactInputClassName}
                  >
                    <option value="">Choisir…</option>
                    {assignableRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </FormSection>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Boutiques affectées</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Obligatoire pour les caissiers.{" "}
                      <span className="tabular-nums text-slate-700">
                        {selectedStoreCount} sélectionnée{selectedStoreCount > 1 ? "s" : ""}.
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {storeItems.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">
                  Aucune boutique active — créez-en une dans{" "}
                  <Link to="/admin/stores" className="font-medium text-slate-700 hover:text-slate-900">
                    Administration → Boutiques
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {storeItems.map((store) => {
                    const checked = Boolean(selectedStores[store.id]);
                    return (
                      <li
                        key={store.id}
                        className={`flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between ${
                          checked ? "bg-slate-50/70" : ""
                        }`}
                      >
                        <label className="flex min-w-0 cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStore(store.id)}
                            disabled={targetIsSuperAdmin && !canEditSuper}
                            className="size-3.5"
                          />
                          <span
                            className={`grid size-9 shrink-0 place-items-center rounded-lg font-mono text-[10px] font-semibold ${
                              checked
                                ? "bg-slate-900 text-white"
                                : "border border-slate-200 bg-slate-50 text-slate-500"
                            }`}
                            aria-hidden
                          >
                            {storeMonogram(store.code)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-900">{store.name}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                              <span className="font-mono">{store.code}</span>
                              {store.city ? ` · ${store.city}` : ""}
                            </span>
                          </span>
                        </label>
                        {checked ? (
                          <label className="flex shrink-0 cursor-pointer items-center gap-2 self-end text-xs font-medium text-slate-600 sm:self-center">
                            <input
                              type="radio"
                              name="primaryStore"
                              checked={primaryStoreId === store.id}
                              onChange={() => setPrimaryStoreId(store.id)}
                              disabled={targetIsSuperAdmin && !canEditSuper}
                            />
                            Boutique principale
                          </label>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {canReadAudit && id ? (
            <div className="xl:sticky xl:top-4 xl:self-start">
              <LoginHistoryRecentPanel userId={id} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Link to="/admin/users" className={ghostLinkClassName}>
            Annuler
          </Link>
          <div className="flex flex-wrap gap-2">
            {userQuery.data?.status === "ACTIVE" && userQuery.data.id !== actor?.id ? (
              <Button
                type="button"
                variant="danger"
                disabled={deactivateMutation.isPending || (targetIsSuperAdmin && !canEditSuper)}
                onClick={() => {
                  void (async () => {
                    const accepted = await confirm({
                      title: "Désactiver le compte",
                      message: "Désactiver ce compte ? Les sessions seront révoquées.",
                      confirmLabel: "Désactiver",
                      tone: "danger",
                    });
                    if (accepted) {
                      void deactivateMutation.mutateAsync();
                    }
                  })();
                }}
              >
                Désactiver
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={saveMutation.isPending || (targetIsSuperAdmin && !canEditSuper)}
              className="px-6"
            >
              {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function storeMonogram(code: string): string {
  const cleaned = code.replace(/^BTQ[-_]?/i, "").replace(/[^A-Za-z0-9]/g, "");
  if (cleaned.length <= 3) {
    return cleaned.toUpperCase() || code.slice(0, 3).toUpperCase();
  }
  return cleaned.slice(0, 3).toUpperCase();
}
