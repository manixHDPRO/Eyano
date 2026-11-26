import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { FormSection } from "../../components/ui/FormField";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchProductStores, setProductStores } from "../../lib/api/products";

type ProductStoreAuthorizationsProps = {
  productId: string;
  canManage: boolean;
};

export function ProductStoreAuthorizations({ productId, canManage }: ProductStoreAuthorizationsProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const storesQuery = useQuery({
    queryKey: ["product-stores", productId],
    queryFn: () => fetchProductStores(productId),
  });

  useEffect(() => {
    if (!storesQuery.data) {
      return;
    }
    const next: Record<string, boolean> = {};
    for (const store of storesQuery.data.items) {
      next[store.storeId] = store.isAuthorized;
    }
    setSelected(next);
  }, [storesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      setProductStores(
        productId,
        Object.entries(selected)
          .filter(([, checked]) => checked)
          .map(([storeId]) => storeId),
      ),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["product-stores", productId] });
      await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      pushToast({
        tone: "success",
        message:
          result.authorizedCount === 0
            ? "Aucune boutique autorisée. L’article n’est pas vendable en caisse."
            : `Autorisé dans ${result.authorizedCount} boutique${result.authorizedCount > 1 ? "s" : ""}.`,
      });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Autorisation impossible.") });
    },
  });

  const items = storesQuery.data?.items ?? [];
  const authorizedCount = items.filter((item) => selected[item.storeId]).length;

  return (
    <FormSection
      title="Boutiques autorisées"
      description="Cocher une boutique n’écrit pas de stock. Cela ouvre seulement la commercialisation en caisse."
    >
      {storesQuery.isError ? (
        <p className="text-sm text-red-300">Impossible de charger les boutiques.</p>
      ) : storesQuery.isLoading ? (
        <p className="text-sm text-slate-500">Chargement des boutiques…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucune boutique active. Créez-en une dans{" "}
          <Link to="/admin/stores" className="font-medium text-slate-600 underline-offset-2 hover:underline">
            Réseau → Boutiques
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((store) => {
            const checked = Boolean(selected[store.storeId]);
            const inactive = store.storeStatus !== "ACTIVE";
            return (
              <label
                key={store.storeId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canManage || saveMutation.isPending}
                    onChange={() => {
                      setSelected((current) => ({ ...current, [store.storeId]: !current[store.storeId] }));
                    }}
                  />
                  <span>
                    {store.name} <span className="text-xs text-slate-500">({store.code})</span>
                  </span>
                </span>
                {inactive ? <span className="text-[11px] text-amber-200/80">Inactive — déjà autorisée</span> : null}
              </label>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        {authorizedCount === 0
          ? "Aucune boutique cochée. Un caissier ne verra pas cet article."
          : `${authorizedCount} boutique${authorizedCount > 1 ? "s" : ""} cochée${authorizedCount > 1 ? "s" : ""}.`}
      </p>
      {canManage && items.length > 0 ? (
        <div className="mt-4">
          <Button type="button" variant="ghost" disabled={saveMutation.isPending} onClick={() => void saveMutation.mutateAsync()}>
            {saveMutation.isPending ? "Enregistrement…" : "Enregistrer les autorisations"}
          </Button>
        </div>
      ) : null}
    </FormSection>
  );
}
