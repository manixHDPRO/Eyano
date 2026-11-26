import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchPermissionsCatalog } from "../../lib/api/permissions";
import { fetchRole, setRolePermissions } from "../../lib/api/roles";
import type { PermissionCatalogItem, RoleSummary } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { permissionModuleLabel, roleChipClassName } from "./user-display";
import { groupPermissionsByModule, PROTECTED_PERMISSION_CODE } from "./role-permissions-shared";

type RolePermissionsFormProps = {
  role: RoleSummary;
  layout?: "page" | "modal";
  onDismiss?: () => void;
  onSaved?: () => void;
};

export function RolePermissionsForm({ role, layout = "page", onDismiss, onSaved }: RolePermissionsFormProps) {
  const { user: actor } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const canManage = hasPermission(actor, "roles.manage");
  const canEditSuper = actor?.role.code === "SUPER_ADMIN";

  const roleQuery = useQuery({
    queryKey: ["role", role.id],
    queryFn: () => fetchRole(role.id),
  });

  const catalogQuery = useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: fetchPermissionsCatalog,
    enabled: canManage,
  });

  useEffect(() => {
    if (!roleQuery.data) {
      return;
    }
    setSelected(new Set(roleQuery.data.permissions.map((row) => row.id)));
  }, [roleQuery.data]);

  const grouped = useMemo(() => groupPermissionsByModule(catalogQuery.data?.items ?? []), [catalogQuery.data?.items]);

  const readOnly =
    !canManage ||
    (roleQuery.data?.code === "SUPER_ADMIN" && !canEditSuper) ||
    (role.code === "SUPER_ADMIN" && !canEditSuper);

  const saveMutation = useMutation({
    mutationFn: () => setRolePermissions(role.id, [...selected]),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      await queryClient.invalidateQueries({ queryKey: ["role", role.id] });
      pushToast({ tone: "success", message: "Permissions du rôle mises à jour." });
      onSaved?.();
    },
    onError: (caught) => {
      pushToast({
        tone: "error",
        message: formatApiErrorMessage(caught, "Impossible d'enregistrer les permissions."),
      });
    },
  });

  const errorMessage = roleQuery.isError
    ? formatApiErrorMessage(roleQuery.error, "Chargement du rôle impossible.")
    : catalogQuery.isError
      ? formatApiErrorMessage(catalogQuery.error, "Chargement du catalogue impossible.")
      : null;

  function togglePermission(permission: PermissionCatalogItem) {
    if (readOnly) {
      return;
    }
    if (roleQuery.data?.code === "SUPER_ADMIN" && permission.code === PROTECTED_PERMISSION_CODE) {
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(permission.id)) {
        next.delete(permission.id);
      } else {
        next.add(permission.id);
      }
      return next;
    });
  }

  function toggleModule(moduleItems: PermissionCatalogItem[], checked: boolean) {
    if (readOnly) {
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      for (const item of moduleItems) {
        if (roleQuery.data?.code === "SUPER_ADMIN" && item.code === PROTECTED_PERMISSION_CODE) {
          next.add(item.id);
          continue;
        }
        if (checked) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      }
      return next;
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) {
      return;
    }
    void saveMutation.mutateAsync();
  }

  const header =
    layout === "modal" ? (
      <div className="flex items-start justify-between gap-3">
        <RoleHeader role={role} subtitle="Matrice des droits" />
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fermer"
          >
            ✕
          </button>
        ) : null}
      </div>
    ) : (
      <RoleHeader role={role} subtitle="Droits accordés par module" />
    );

  const formClass = layout === "page" ? "space-y-4" : "flex min-h-0 flex-1 flex-col overflow-hidden";

  return (
    <form onSubmit={onSubmit} className={formClass}>
      {layout === "modal" ? (
        <header className="shrink-0 border-b border-slate-100 px-5 py-4">{header}</header>
      ) : (
        <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">{header}</header>
      )}

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <div
        className={
          layout === "modal"
            ? "min-h-0 flex-1 overflow-y-auto px-5 py-4"
            : "rounded-xl border border-slate-200 bg-white p-4"
        }
      >
        {roleQuery.isLoading || catalogQuery.isLoading ? (
          <p className="py-10 text-center text-sm text-slate-500">Chargement des permissions…</p>
        ) : (
          <PermissionModuleList
            grouped={grouped}
            selected={selected}
            readOnly={readOnly}
            roleCode={roleQuery.data?.code ?? role.code}
            onTogglePermission={togglePermission}
            onToggleModule={toggleModule}
          />
        )}
      </div>

      <footer
        className={
          layout === "modal"
            ? "flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4"
            : "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
        }
      >
        <p className="text-xs text-slate-500">
          {selected.size} permission{selected.size > 1 ? "s" : ""} active{selected.size > 1 ? "s" : ""}
          {role.userCount > 0
            ? ` · ${role.userCount} compte${role.userCount > 1 ? "s" : ""} concerné${role.userCount > 1 ? "s" : ""}`
            : null}
        </p>
        <div className="flex gap-2">
          {onDismiss ? (
            <Button type="button" variant="ghost" onClick={onDismiss}>
              {readOnly ? "Fermer" : "Annuler"}
            </Button>
          ) : null}
          {!readOnly ? (
            <Button type="submit" disabled={saveMutation.isPending || roleQuery.isLoading}>
              {saveMutation.isPending ? "Enregistrement…" : "Enregistrer les droits"}
            </Button>
          ) : null}
        </div>
      </footer>
    </form>
  );
}

function RoleHeader({ role, subtitle }: { role: RoleSummary; subtitle: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{subtitle}</p>
      <h2 className="text-lg font-semibold text-slate-900">{role.name}</h2>
      {role.description ? <p className="text-sm text-slate-500">{role.description}</p> : null}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${roleChipClassName(role.code)}`}
        >
          {role.code.replaceAll("_", " ")}
        </span>
        {role.isSystem ? <span className="text-xs text-slate-400">Rôle système</span> : null}
      </div>
    </div>
  );
}

type PermissionModuleListProps = {
  grouped: Map<string, PermissionCatalogItem[]>;
  selected: Set<string>;
  readOnly: boolean;
  roleCode: string;
  onTogglePermission: (permission: PermissionCatalogItem) => void;
  onToggleModule: (items: PermissionCatalogItem[], checked: boolean) => void;
};

function PermissionModuleList({
  grouped,
  selected,
  readOnly,
  roleCode,
  onTogglePermission,
  onToggleModule,
}: PermissionModuleListProps) {
  return (
    <div className="space-y-5">
      {[...grouped.entries()].map(([module, items]) => {
        const allChecked = items.every((item) => selected.has(item.id));
        return (
          <section key={module} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <ModuleSectionHeader
              module={module}
              readOnly={readOnly}
              allChecked={allChecked}
              items={items}
              onToggleModule={onToggleModule}
            />
            <ul className="space-y-2">
              {items.map((permission) => (
                <PermissionRow
                  key={permission.id}
                  permission={permission}
                  checked={selected.has(permission.id)}
                  locked={roleCode === "SUPER_ADMIN" && permission.code === PROTECTED_PERMISSION_CODE}
                  readOnly={readOnly}
                  onToggle={() => onTogglePermission(permission)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ModuleSectionHeader({
  module,
  readOnly,
  allChecked,
  items,
  onToggleModule,
}: {
  module: string;
  readOnly: boolean;
  allChecked: boolean;
  items: PermissionCatalogItem[];
  onToggleModule: (items: PermissionCatalogItem[], checked: boolean) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-slate-900">{permissionModuleLabel(module)}</h3>
      {!readOnly ? (
        <button
          type="button"
          onClick={() => onToggleModule(items, !allChecked)}
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          {allChecked ? "Tout décocher" : "Tout cocher"}
        </button>
      ) : null}
    </div>
  );
}

function PermissionRow({
  permission,
  checked,
  locked,
  readOnly,
  onToggle,
}: {
  permission: PermissionCatalogItem;
  checked: boolean;
  locked: boolean;
  readOnly: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label
        className={`flex cursor-pointer gap-3 rounded-lg border bg-white px-3 py-2.5 transition ${
          checked ? "border-slate-300 shadow-sm" : "border-transparent hover:border-slate-200"
        } ${readOnly || locked ? "cursor-default opacity-90" : ""}`}
      >
        <input
          type="checkbox"
          className="mt-0.5"
          checked={checked}
          disabled={readOnly || locked}
          onChange={onToggle}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900">
            {permission.description ?? permission.code}
          </span>
          <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{permission.code}</span>
        </span>
      </label>
    </li>
  );
}