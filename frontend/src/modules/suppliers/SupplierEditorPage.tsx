import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui/Alert";
import { Button, linkButtonClassName } from "../../components/ui/Button";
import { FormField, inputClassName } from "../../components/ui/FormField";
import { PageHeader } from "../../components/ui/PageHeader";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { createSupplier, fetchSupplier, updateSupplier } from "../../lib/api/suppliers";
import { referentialStatusLabel, referentialStatusTone } from "../network/referential-status";

export function SupplierEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const detailQuery = useQuery({
    queryKey: ["supplier", id],
    queryFn: () => fetchSupplier(id!),
    enabled: !isNew && Boolean(id),
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  useEffect(() => {
    if (detailQuery.data) {
      setName(detailQuery.data.name);
      setPhone(detailQuery.data.phone ?? "");
      setEmail(detailQuery.data.email ?? "");
      setAddress(detailQuery.data.address ?? "");
      setCountry(detailQuery.data.country ?? "");
      setStatus(detailQuery.data.status);
    }
  }, [detailQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        country: country.trim() || null,
        ...(isNew ? {} : { status }),
      };
      if (isNew) {
        return createSupplier({ ...payload, name: payload.name });
      }
      return updateSupplier(id!, payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      await queryClient.invalidateQueries({ queryKey: ["supplier", saved.id] });
      pushToast({ tone: "success", message: isNew ? "Fournisseur créé." : "Fournisseur mis à jour." });
      if (isNew) {
        navigate(`/admin/suppliers/${saved.id}`, { replace: true });
      }
    },
    onError: (error) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Enregistrement impossible.") });
    },
  });

  const loadError = detailQuery.isError ? formatApiErrorMessage(detailQuery.error, "Chargement impossible.") : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Réseau"
        title={isNew ? "Nouveau fournisseur" : (detailQuery.data?.name ?? "Fournisseur")}
        description="Coordonnées utilisées sur les bons de réception. Le statut inactif bloque les nouvelles réceptions."
        actions={
          <Link to="/admin/suppliers" className={linkButtonClassName}>
            Retour à la liste
          </Link>
        }
      />

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      {!isNew && detailQuery.data ? (
        <StatusBadge
          label={referentialStatusLabel(detailQuery.data.status)}
          tone={referentialStatusTone(detailQuery.data.status)}
        />
      ) : null}

      <form
        className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void saveMutation.mutateAsync();
        }}
      >
        <FormField label="Raison sociale" htmlFor="supplier-name">
          <input id="supplier-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} required />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Téléphone" htmlFor="supplier-phone">
            <input id="supplier-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="E-mail" htmlFor="supplier-email">
            <input
              id="supplier-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClassName}
            />
          </FormField>
        </div>
        <FormField label="Adresse" htmlFor="supplier-address">
          <textarea
            id="supplier-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClassName}
            rows={2}
          />
        </FormField>
        <FormField label="Pays" htmlFor="supplier-country">
          <input id="supplier-country" value={country} onChange={(e) => setCountry(e.target.value)} className={inputClassName} />
        </FormField>
        {!isNew ? (
          <FormField label="Statut" htmlFor="supplier-status">
            <select id="supplier-status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClassName}>
              <option value="ACTIVE">En service</option>
              <option value="INACTIVE">Hors service</option>
            </select>
          </FormField>
        ) : null}

        <Button type="submit" disabled={saveMutation.isPending || name.trim().length < 2}>
          {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </div>
  );
}