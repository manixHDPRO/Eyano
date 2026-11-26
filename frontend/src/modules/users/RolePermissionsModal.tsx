import { useEffect } from "react";
import type { RoleSummary } from "../../lib/api/types";
import { RolePermissionsForm } from "./RolePermissionsForm";

type RolePermissionsModalProps = {
  role: RoleSummary | null;
  onClose: () => void;
};

export function RolePermissionsModal({ role, onClose }: RolePermissionsModalProps) {
  useEffect(() => {
    if (!role) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [role, onClose]);

  if (!role) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="role-permissions-title"
        aria-modal="true"
        className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div id="role-permissions-title" className="sr-only">
          Permissions — {role.name}
        </div>
        <RolePermissionsForm
          role={role}
          layout="modal"
          onDismiss={onClose}
          onSaved={onClose}
        />
      </div>
    </div>
  );
}