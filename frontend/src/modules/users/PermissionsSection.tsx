import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { inputClassName } from "../../components/ui/FormField";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchPermissionsCatalog } from "../../lib/api/permissions";
import { fetchRoles } from "../../lib/api/roles";
import { permissionModuleLabel, sortRolesForDisplay } from "./user-display";
import { groupPermissionsByModule } from "./role-permissions-shared";
import { RolePermissionsForm } from "./RolePermissionsForm";

export function PermissionsSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const permissionRoleId = searchParams.get("permissionRoleId") ?? "";

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });

  const catalogQuery = useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: fetchPermissionsCatalog,
  });

  const roles = sortRolesForDisplay(rolesQuery.data?.items ?? []);
  const selectedRole = roles.find((role) => role.id === permissionRoleId) ?? roles[0];

  useEffect(() => {
    if (roles.length === 0 || permissionRoleId) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("tab", "permissions");
    next.set("permissionRoleId", roles[0].id);
    setSearchParams(next, { replace: true });
  }, [roles, permissionRoleId, searchParams, setSearchParams]);

  const catalogError = catalogQuery.isError
    ? formatApiErrorMessage(catalogQuery.error, "Chargement du catalogue impossible.")
    : null;
  const rolesError = rolesQuery.isError
    ? formatApiErrorMessage(rolesQuery.error, "Chargement des rôles impossible.")
    : null;

  const catalogByModule = useMemo(
    () => groupPermissionsByModule(catalogQuery.data?.items ?? []),
    [catalogQuery.data?.items],
  );

  function selectRole(nextId: string) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "permissions");
    if (nextId) {
      next.set("permissionRoleId", nextId);
    } else {
      next.delete("permissionRoleId");
    }
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Catalogue des permissions</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Référentiel des droits applicatifs, regroupés par domaine. Sélectionnez un rôle pour ajuster les permissions
          accordées aux comptes qui en héritent.
        </p>
        {catalogQuery.data ? (
          <p className="mt-2 text-xs text-slate-500">
            {catalogQuery.data.items.length} permission{catalogQuery.data.items.length > 1 ? "s" : ""} répartie
            {catalogQuery.data.items.length > 1 ? "s" : ""} sur {catalogByModule.size} module
            {catalogByModule.size > 1 ? "s" : ""}
          </p>
        ) : null}
      </section>

      {catalogError ? <Alert tone="error">{catalogError}</Alert> : null}
      {rolesError ? <Alert tone="error">{rolesError}</Alert> : null}

      {!catalogQuery.isLoading && catalogByModule.size > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Vue d’ensemble</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...catalogByModule.entries()].map(([module, items]) => (
              <li
                key={module}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
              >
                <span className="font-medium text-slate-900">{permissionModuleLabel(module)}</span>
                <span className="ml-1 tabular-nums text-slate-500">({items.length})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="block max-w-md">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Rôle à configurer</span>
          <select
            value={selectedRole?.id ?? ""}
            onChange={(event) => selectRole(event.target.value)}
            disabled={rolesQuery.isLoading || roles.length === 0}
            className={inputClassName}
          >
            {roles.length === 0 ? <option value="">Aucun rôle</option> : null}
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} ({role.permissionCount} droits)
              </option>
            ))}
          </select>
        </label>
      </section>

      {rolesQuery.isLoading ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
          Chargement…
        </p>
      ) : selectedRole ? (
        <RolePermissionsForm key={selectedRole.id} role={selectedRole} layout="page" />
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Aucun rôle disponible.
        </p>
      )}
    </div>
  );
}