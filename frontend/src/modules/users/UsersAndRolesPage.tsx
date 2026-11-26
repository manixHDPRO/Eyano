import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { NewUserModal } from "./NewUserModal";
import { PermissionsSection } from "./PermissionsSection";
import { RolesMatrixSection } from "./RolesMatrixSection";
import { UsersAccountsSection } from "./UsersAccountsSection";
import { UsersInnerTabs, type UsersHubTab } from "./UsersInnerTabs";

type UsersListLocationState = {
  openNewUser?: boolean;
};

function parseTab(raw: string | null, showRoles: boolean): UsersHubTab {
  if (!showRoles) {
    return "accounts";
  }
  if (raw === "roles" || raw === "permissions") {
    return raw;
  }
  return "accounts";
}

export function UsersAndRolesPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showNewUserModal, setShowNewUserModal] = useState(false);

  const showRoles = hasPermission(user, "roles.manage");
  const canViewUsers = hasPermission(user, "users.manage");

  const tab = useMemo(
    () => parseTab(searchParams.get("tab"), showRoles),
    [searchParams, showRoles],
  );

  useEffect(() => {
    if (tab === "accounts" && !canViewUsers && showRoles) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "roles");
      setSearchParams(next, { replace: true });
    }
  }, [tab, canViewUsers, showRoles, searchParams, setSearchParams]);

  useEffect(() => {
    const state = location.state as UsersListLocationState | null;
    if (!state?.openNewUser) {
      return;
    }
    setShowNewUserModal(true);
    const next = new URLSearchParams(searchParams);
    next.set("tab", "accounts");
    navigate(`${location.pathname}?${next.toString()}`, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, searchParams]);

  function setTab(next: UsersHubTab) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    if (next === "roles") {
      params.delete("roleId");
      params.delete("permissionRoleId");
    }
    if (next === "accounts") {
      params.delete("permissionRoleId");
    }
    if (next === "permissions") {
      params.delete("roleId");
    }
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="space-y-5">
      <UsersInnerTabs active={tab} onChange={setTab} showRoles={showRoles} />

      {tab === "roles" ? <RolesMatrixSection /> : null}
      {tab === "permissions" && showRoles ? <PermissionsSection /> : null}
      {tab === "accounts" && canViewUsers ? (
        <UsersAccountsSection onNewUser={() => setShowNewUserModal(true)} />
      ) : null}
      {tab === "accounts" && !canViewUsers ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Vous n’avez pas la permission de consulter les comptes utilisateurs.
        </p>
      ) : null}
      <NewUserModal open={showNewUserModal} onClose={() => setShowNewUserModal(false)} />
    </div>
  );
}