import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchRoles } from "../../lib/api/roles";
import type { RoleSummary } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { roleChipClassName, sortRolesForDisplay } from "./user-display";

export function RolesMatrixSection() {
  const { user } = useAuth();
  const canManageRoles = hasPermission(user, "roles.manage");

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });

  const errorMessage = rolesQuery.isError
    ? formatApiErrorMessage(rolesQuery.error, "Chargement des rôles impossible.")
    : null;

  const roles = sortRolesForDisplay(rolesQuery.data?.items ?? []);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Les six rôles HD-Eyano</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Chaque compte est rattaché à un seul rôle métier. Les droits fins se configurent dans l’onglet
          Permissions. Les rôles système sont fournis par la plateforme.
        </p>
      </section>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      {rolesQuery.isLoading ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
          Chargement de la matrice des rôles…
        </p>
      ) : (
        <RoleGrid roles={roles} canManageRoles={canManageRoles} />
      )}
    </div>
  );
}

function RoleGrid({ roles, canManageRoles }: { roles: RoleSummary[]; canManageRoles: boolean }) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {roles.map((role) => (
        <li key={role.id}>
          <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
            <RoleCardHeader role={role} />
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              {role.description ?? "Aucune description."}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
              <RoleStat label="Comptes" value={role.userCount} />
              <RoleStat label="Permissions" value={role.permissionCount} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {canManageRoles ? (
                <Link
                  to={`/admin/users?tab=permissions&permissionRoleId=${role.id}`}
                  className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Configurer les permissions
                </Link>
              ) : null}
              {role.userCount > 0 ? (
                <Link
                  to={`/admin/users?tab=accounts&roleId=${role.id}`}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Voir les comptes
                </Link>
              ) : null}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

function RoleCardHeader({ role }: { role: RoleSummary }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-slate-900">{role.name}</h3>
        <span
          className={`mt-1.5 inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${roleChipClassName(role.code)}`}
        >
          {role.code.replaceAll("_", " ")}
        </span>
      </div>
      {role.isSystem ? (
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">
          Système
        </span>
      ) : null}
    </div>
  );
}

function RoleStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}