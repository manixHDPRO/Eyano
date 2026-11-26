import { useMutation } from "@tanstack/react-query";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { EyanoLogo } from "../../components/EyanoLogo";
import { useToast } from "../../components/ui/Toast";
import { changePassword } from "../../lib/api/auth";
import { formatApiErrorMessage } from "../../lib/api/errors";

export function ChangePasswordPage() {
  const { pushToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      pushToast({ tone: "success", message: "Mot de passe mis à jour." });
    },
  });

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mismatch || newPassword.length < 10) {
      return;
    }
    void mutation.mutateAsync();
  }

  const errorMessage = mutation.isError
    ? formatApiErrorMessage(mutation.error, "Impossible de modifier le mot de passe.")
    : null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <PageCard>
        <EyanoLogo onLight />
        <h1 className="mt-6 text-lg font-semibold text-slate-900">Changer mon mot de passe</h1>
        <p className="mt-1 text-sm text-slate-500">
          Minimum 10 caractères. Le nouveau mot de passe remplace immédiatement l&apos;ancien.
        </p>

        {errorMessage ? (
          <div className="mt-4">
            <Alert tone="error">{errorMessage}</Alert>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <PasswordField
            label="Mot de passe actuel"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
          <PasswordField
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            error={mismatch ? "Les mots de passe ne correspondent pas." : undefined}
          />
          <button
            type="submit"
            disabled={mutation.isPending || mismatch || newPassword.length < 10 || !currentPassword}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {mutation.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link to="/admin" className="font-medium text-slate-700 hover:text-slate-900">
            Retour à l&apos;administration
          </Link>
          <span className="mx-2">·</span>
          <Link to="/pos" className="font-medium text-slate-700 hover:text-slate-900">
            Caisse
          </Link>
        </p>
      </PageCard>
    </div>
  );
}

function PageCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  error,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete: string;
  error?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        type="password"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}