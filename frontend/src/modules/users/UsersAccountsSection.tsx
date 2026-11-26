import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui/Alert";
import { DataTable } from "../../components/ui/DataTable";
import type { DataTableColumn } from "../../components/ui/DataTable";
import { inputClassName } from "../../components/ui/FormField";
import { Pagination } from "../../components/ui/Pagination";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchRoles } from "../../lib/api/roles";
import { fetchUsers } from "../../lib/api/users";
import type { UserListItem } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import {
  roleChipClassName,
  userFullName,
  userInitials,
  userStatusLabel,
  userStatusTone,
} from "./user-display";

type UsersAccountsSectionProps = {
  onNewUser: () => void;
};

export function UsersAccountsSection({ onNewUser }: UsersAccountsSectionProps) {
  const { user } = useAuth();
  const canManageUsers = hasPermission(user, "users.manage");
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [roleId, setRoleId] = useState(() => searchParams.get("roleId") ?? "");

  useEffect(() => {
    const fromUrl = searchParams.get("roleId") ?? "";
    if (fromUrl !== roleId) {
      setRoleId(fromUrl);
      setPage(1);
    }
  }, [searchParams, roleId]);

  const usersQuery = useQuery({
    queryKey: ["users", page, search, status, roleId],
    queryFn: () =>
      fetchUsers({
        page,
        pageSize: 15,
        search: search.trim() || undefined,
        status: status || undefined,
        roleId: roleId || undefined,
      }),
  });

  const activeCountQuery = useQuery({
    queryKey: ["users", "stats", "ACTIVE"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 1, status: "ACTIVE" }),
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });

  const errorMessage = usersQuery.isError
    ? formatApiErrorMessage(usersQuery.error, "Chargement impossible.")
    : null;

  const columns = useMemo<DataTableColumn<UserListItem>[]>(
    () => [
      {
        id: "user",
        header: "Utilisateur",
        cell: (row) => (
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white"
              aria-hidden
            >
              {userInitials(row)}
            </span>
            <UserIdentity row={row} />
          </div>
        ),
      },
      {
        id: "role",
        header: "Rôle",
        cell: (row) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleChipClassName(row.role.code)}`}
          >
            {row.role.name}
          </span>
        ),
      },
      {
        id: "status",
        header: "Statut",
        cell: (row) => (
          <StatusBadge label={userStatusLabel(row.status)} tone={userStatusTone(row.status)} />
        ),
      },
      {
        id: "stores",
        header: "Boutiques",
        cell: (row) => (
          <span className="tabular-nums text-slate-600">
            {row.storeCount > 0 ? row.storeCount : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        headerClassName: "text-right",
        cellClassName: "text-right",
        cell: (row) => (
          <Link
            to={`/admin/users/${row.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Ouvrir
            <span aria-hidden>→</span>
          </Link>
        ),
      },
    ],
    [],
  );

  function updateRoleFilter(nextRoleId: string) {
    setRoleId(nextRoleId);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    next.set("tab", "accounts");
    if (nextRoleId) {
      next.set("roleId", nextRoleId);
    } else {
      next.delete("roleId");
    }
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="space-y-4">
      {canManageUsers ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Création, modification et affectation aux boutiques. Les super administrateurs ne sont modifiables que par
            leurs pairs.
          </p>
          <button
            type="button"
            onClick={onNewUser}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Nouvel utilisateur
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Consultation des comptes — droits de gestion limités.</p>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Comptes" value={usersQuery.data?.total} />
        <Stat label="Actifs" value={activeCountQuery.data?.total} />
        <Stat label="Rôles" value={rolesQuery.data?.items.length} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Recherche</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Nom ou e-mail…"
              className={inputClassName}
            />
          </label>
          <label>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Statut</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className={inputClassName}
            >
              <option value="">Tous</option>
              <option value="ACTIVE">Actifs</option>
              <option value="INACTIVE">Désactivés</option>
              <option value="LOCKED">Verrouillés</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Rôle</span>
            <select
              value={roleId}
              onChange={(event) => updateRoleFilter(event.target.value)}
              className={inputClassName}
            >
              <option value="">Tous les rôles</option>
              {rolesQuery.data?.items.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <DataTable
        columns={columns}
        rows={usersQuery.data?.items}
        getRowKey={(row) => row.id}
        loading={usersQuery.isLoading}
        loadingLabel="Chargement des comptes…"
        emptyMessage="Aucun utilisateur ne correspond aux filtres."
      />

      {usersQuery.data ? (
        <Pagination
          page={usersQuery.data.page}
          totalPages={usersQuery.data.totalPages}
          totalItems={usersQuery.data.total}
          onPageChange={setPage}
          itemLabel="comptes"
        />
      ) : null}
    </div>
  );
}

function UserIdentity({ row }: { row: UserListItem }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-slate-900">{userFullName(row)}</p>
      <p className="truncate text-xs text-slate-500">{row.email}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}
