import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { modalFieldClassName } from "../../components/ui/form-styles";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchCategoryLeaves } from "../../lib/api/categories";
import { createProduct, deleteProductPhoto, fetchProduct, updateProduct, uploadProductPhoto } from "../../lib/api/products";
import type { ProductStatus } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { ProductBarcodePanel } from "../barcodes/ProductBarcodePanel";
import {
  isAcceptedPhotoType,
  PRODUCT_PHOTO_SOURCE_MAX_BYTES,
} from "./crop-image";
import { computeFinalPrice, formatUsd } from "./money";
import { ProductPhoto } from "./ProductPhoto";
import { ProductPhotoCropper } from "./ProductPhotoCropper";
import { PricingFormulaHint } from "../pricing/ProductPricingTimeline";
import { ProductStoreAuthorizations } from "./ProductStoreAuthorizations";
import { productStatusLabel, productStatusTone } from "./product-status";

type CropperSession = {
  source: string;
  fileName: string;
  owned: boolean;
};

export function ProductEditorPage() {
  const { id } = useParams();
  const isNew = id === "new" || !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { user } = useAuth();
  const canManage = hasPermission(user, "products.manage");
  const canPrintBarcodes = hasPermission(user, "barcodes.print");
  const readOnly = !canManage;
  const tariffEditable = isNew && canManage;

  const productQuery = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProduct(id!),
    enabled: !isNew && Boolean(id),
  });
  const leavesQuery = useQuery({
    queryKey: ["category-leaves"],
    queryFn: fetchCategoryLeaves,
  });

  const [reference, setReference] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [description, setDescription] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("0.00");
  const [officialPrice, setOfficialPrice] = useState("0.00");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [alertThreshold, setAlertThreshold] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [cropper, setCropper] = useState<CropperSession | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!productQuery.data) {
      return;
    }
    const product = productQuery.data;
    setReference(product.reference);
    setName(product.name);
    setCategoryId(product.category.id);
    setBrand(product.brand ?? "");
    setOriginCountry(product.originCountry ?? "");
    setDescription(product.description ?? "");
    setPurchasePrice(product.purchasePrice.toFixed(2));
    setOfficialPrice(product.officialPrice.toFixed(2));
    setDiscountPercent(String(product.discountPercent));
    setAlertThreshold(product.alertThreshold === null ? "" : String(product.alertThreshold));
    setPhotoPreview(product.photoUrl);
  }, [productQuery.data]);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const finalPrice = useMemo(
    () => computeFinalPrice(Number.parseFloat(officialPrice) || 0, Number.parseFloat(discountPercent) || 0),
    [discountPercent, officialPrice],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        reference,
        name,
        categoryId,
        brand: brand.trim() || null,
        originCountry: originCountry.trim() || null,
        description: description.trim() || null,
        ...(isNew
          ? {
              purchasePrice: Number.parseFloat(purchasePrice) || 0,
              officialPrice: Number.parseFloat(officialPrice) || 0,
              discountPercent: Number.parseFloat(discountPercent) || 0,
            }
          : {}),
        alertThreshold: alertThreshold.trim() === "" ? null : Number.parseInt(alertThreshold, 10),
      };
      const saved = isNew ? await createProduct(payload) : await updateProduct(id!, payload);
      if (photoFile) {
        return uploadProductPhoto(saved.id, photoFile);
      }
      return saved;
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["product", saved.id] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setPhotoFile(null);
      pushToast({
        tone: "success",
        message: isNew ? "Article créé en brouillon." : "Fiche article enregistrée.",
      });
      navigate("/admin/products", { replace: true });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Enregistrement impossible.") });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: ProductStatus) => updateProduct(id!, { status }),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["product", saved.id] });
      pushToast({ tone: "success", message: `Statut : ${productStatusLabel(saved.status)}.` });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Changement de statut impossible.") });
    },
  });

  const photoMutation = useMutation({
    mutationFn: () => deleteProductPhoto(id!),
    onSuccess: async (saved) => {
      setPhotoFile(null);
      setPhotoPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["product", saved.id] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      pushToast({ tone: "success", message: "Photo retirée." });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Impossible de retirer la photo.") });
    },
  });

  const replacePhotoMutation = useMutation({
    mutationFn: (file: File) => uploadProductPhoto(id!, file),
    onSuccess: async (saved) => {
      setPhotoFile(null);
      setPhotoPreview(saved.photoUrl);
      await queryClient.invalidateQueries({ queryKey: ["product", saved.id] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      pushToast({ tone: "success", message: "Visuel recadré et enregistré." });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Enregistrement du visuel impossible.") });
    },
  });

  function closeCropper() {
    setCropper((current) => {
      if (current?.owned) {
        URL.revokeObjectURL(current.source);
      }
      return null;
    });
  }

  function openCropper(source: string, fileName: string, owned: boolean) {
    setCropper((current) => {
      if (current?.owned) {
        URL.revokeObjectURL(current.source);
      }
      return { source, fileName, owned };
    });
  }

  function onPickFile(file: File | undefined) {
    if (!file) {
      return;
    }
    if (!isAcceptedPhotoType(file.type)) {
      pushToast({ tone: "error", message: "Formats acceptés : JPEG, PNG, WebP." });
      return;
    }
    if (file.size > PRODUCT_PHOTO_SOURCE_MAX_BYTES) {
      pushToast({ tone: "error", message: "L’image source dépasse 20 Mo." });
      return;
    }
    openCropper(URL.createObjectURL(file), file.name, true);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (readOnly) {
      return;
    }
    onPickFile(event.dataTransfer.files[0]);
  }

  async function recropCurrent() {
    if (!photoPreview) {
      return;
    }
    if (photoPreview.startsWith("blob:")) {
      openCropper(photoPreview, photoFile?.name ?? "visuel.jpg", false);
      return;
    }
    try {
      const response = await fetch(photoPreview);
      if (!response.ok) {
        throw new Error("Chargement du visuel impossible.");
      }
      const blob = await response.blob();
      openCropper(URL.createObjectURL(blob), "visuel.jpg", true);
    } catch (caught) {
      pushToast({
        tone: "error",
        message: caught instanceof Error ? caught.message : "Chargement du visuel impossible.",
      });
    }
  }

  function applyCrop(file: File) {
    closeCropper();
    if (photoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    const preview = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoPreview(preview);
    if (!isNew) {
      void replacePhotoMutation.mutateAsync(file);
    } else {
      pushToast({ tone: "info", message: "Cadrage prêt. Il sera envoyé à l’enregistrement de la fiche." });
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    void saveMutation.mutateAsync();
  }

  const loadError = productQuery.isError
    ? formatApiErrorMessage(productQuery.error, "Fiche introuvable.")
    : leavesQuery.isError
      ? formatApiErrorMessage(leavesQuery.error, "Catégories indisponibles.")
      : null;

  const product = productQuery.data;
  const leaves = leavesQuery.data?.items ?? [];

  if (!isNew && productQuery.isLoading) {
    return <p className="py-16 text-center text-sm text-slate-500">Ouverture de la fiche…</p>;
  }

  const submitDisabled = saveMutation.isPending || !categoryId || name.trim().length < 2;

  if (isNew) {
    return (
      <>
        <form className="mx-auto max-w-4xl space-y-5 pb-10" onSubmit={onSubmit}>
          <Link to="/admin/products" className="inline-flex text-xs font-medium text-slate-500 hover:text-slate-800">
            ← Retour au catalogue
          </Link>

          <header>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nouveau produit au catalogue central</h1>
            <p className="mt-1 text-sm text-slate-500">
              L&apos;article est créé en <strong className="font-semibold text-slate-700">brouillon</strong>. Vous
              activerez les boutiques et le statut sur la fiche une fois le contenu validé.
            </p>
          </header>

          {loadError ? <Alert tone="error">{loadError}</Alert> : null}
          {leaves.length === 0 && canManage ? (
            <Alert tone="info">
              Aucune feuille de catégorie.{" "}
              <Link to="/admin/categories" className="font-medium text-slate-700 underline-offset-2 hover:underline">
                Créez d&apos;abord l&apos;arbre
              </Link>{" "}
              (famille + sous-catégorie).
            </Alert>
          ) : null}

          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 text-xs shadow-sm">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Identification</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <CompactField label="Référence interne *" htmlFor="product-ref" hint="2–32 caractères (A-Z, 0-9, tiret)">
                  <input
                    id="product-ref"
                    value={reference}
                    onChange={(event) => setReference(event.target.value.toUpperCase())}
                    className={`${modalFieldClassName} font-mono tracking-wide`}
                    placeholder="Ex. EYN-TIS-010"
                    required
                    minLength={2}
                    maxLength={32}
                    disabled={readOnly}
                  />
                </CompactField>
                <CompactField label="Code-barres" hint="Attribué automatiquement (Code 128) à l'enregistrement">
                  <input
                    className={`${modalFieldClassName} font-mono text-slate-400`}
                    disabled
                    placeholder="Génération automatique"
                    readOnly
                    value=""
                  />
                </CompactField>
                <CompactField label="Désignation *" htmlFor="product-name" className="sm:col-span-2">
                  <input
                    id="product-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={modalFieldClassName}
                    placeholder="Ex. Tissage Brésilien Deep Wave 24 pouces"
                    required
                    minLength={2}
                    maxLength={160}
                    disabled={readOnly}
                  />
                </CompactField>
                <CompactField label="Catégorie feuille *" htmlFor="product-category">
                  <select
                    id="product-category"
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className={modalFieldClassName}
                    required
                    disabled={readOnly}
                  >
                    <option value="">Choisir…</option>
                    {leaves.map((leaf) => (
                      <option key={leaf.id} value={leaf.id}>
                        {leaf.parentName ? `${leaf.parentName} · ${leaf.name}` : leaf.name}
                      </option>
                    ))}
                  </select>
                </CompactField>
                <CompactField label="Marque" htmlFor="product-brand">
                  <input
                    id="product-brand"
                    value={brand}
                    onChange={(event) => setBrand(event.target.value)}
                    className={modalFieldClassName}
                    placeholder="Ex. Eyano Gold"
                    maxLength={80}
                    disabled={readOnly}
                  />
                </CompactField>
                <CompactField label="Provenance" htmlFor="product-origin">
                  <input
                    id="product-origin"
                    value={originCountry}
                    onChange={(event) => setOriginCountry(event.target.value)}
                    className={modalFieldClassName}
                    placeholder="Ex. Chine"
                    maxLength={80}
                    disabled={readOnly}
                  />
                </CompactField>
                <CompactField label="Description" htmlFor="product-description" className="sm:col-span-2">
                  <textarea
                    id="product-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className={`${modalFieldClassName} min-h-20 resize-y leading-relaxed`}
                    maxLength={4000}
                    disabled={readOnly}
                    placeholder="Notes internes, variantes, conditionnement…"
                  />
                </CompactField>
              </div>
            </section>

            <section className="space-y-3 border-t border-slate-100 pt-5">
              <h2 className="text-sm font-semibold text-slate-900">Visuel catalogue</h2>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!readOnly) {
                    setDragOver(true);
                  }
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`flex flex-col gap-4 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center ${
                  dragOver ? "border-slate-400 bg-slate-50" : "border-slate-200 bg-slate-50/50"
                }`}
              >
                <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                  <ProductPhoto url={photoPreview} name={name || "Article"} />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={readOnly}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    onPickFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    JPEG, PNG ou WebP — recadrage avant envoi, fichier final sous 2 Mo.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {photoPreview ? "Changer le visuel" : "Ajouter une photo"}
                    </button>
                    {photoPreview ? (
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => void recropCurrent()}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Recadrer
                      </button>
                    ) : null}
                    {photoPreview ? (
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => {
                          if (photoPreview.startsWith("blob:")) {
                            URL.revokeObjectURL(photoPreview);
                          }
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                        className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
                      >
                        Retirer
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t border-slate-100 pt-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Tarification initiale</h2>
                <PricingFormulaHint />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <CompactField label="Prix d'achat USD *" htmlFor="product-purchase">
                  <input
                    id="product-purchase"
                    type="number"
                    min={0}
                    step="0.01"
                    value={purchasePrice}
                    onChange={(event) => setPurchasePrice(event.target.value)}
                    className={`${modalFieldClassName} font-mono tabular-nums`}
                    disabled={!tariffEditable}
                    required
                  />
                </CompactField>
                <CompactField label="Prix officiel USD *" htmlFor="product-official">
                  <input
                    id="product-official"
                    type="number"
                    min={0}
                    step="0.01"
                    value={officialPrice}
                    onChange={(event) => setOfficialPrice(event.target.value)}
                    className={`${modalFieldClassName} font-mono tabular-nums`}
                    disabled={!tariffEditable}
                    required
                  />
                </CompactField>
                <CompactField label="Remise produit (%)" htmlFor="product-discount">
                  <input
                    id="product-discount"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={discountPercent}
                    onChange={(event) => setDiscountPercent(event.target.value)}
                    className={`${modalFieldClassName} font-mono tabular-nums`}
                    disabled={!tariffEditable}
                  />
                </CompactField>
                <CompactField label="Seuil d'alerte stock" htmlFor="product-threshold" hint="Vide = défaut application">
                  <input
                    id="product-threshold"
                    type="number"
                    min={0}
                    value={alertThreshold}
                    onChange={(event) => setAlertThreshold(event.target.value)}
                    className={`${modalFieldClassName} font-mono tabular-nums`}
                    placeholder="100"
                    disabled={readOnly}
                  />
                </CompactField>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-xs font-medium text-slate-600">Prix final unitaire</span>
                <span className="font-mono text-lg font-semibold tabular-nums text-slate-900">{formatUsd(finalPrice)}</span>
              </div>
            </section>

            <section className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 text-[11px] leading-relaxed text-slate-600">
              Après création : ouvrez les <strong className="font-medium text-slate-800">boutiques autorisées</strong>{" "}
              sur la fiche, puis passez le statut en actif. Les prix historisés se modifient via Prix &amp; remises.
            </section>
          </div>

          {canManage ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
              <Link
                to="/admin/products"
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </Link>
              <button
                type="submit"
                disabled={submitDisabled}
                className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
              >
                {saveMutation.isPending ? "Création…" : "Créer le brouillon"}
              </button>
            </div>
          ) : null}
        </form>
        {cropper ? (
          <ProductPhotoCropper
            source={cropper.source}
            fileName={cropper.fileName}
            onCancel={closeCropper}
            onConfirm={applyCrop}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
    <form className="mx-auto max-w-5xl space-y-5 pb-10" onSubmit={onSubmit}>
      <Link to="/admin/products" className="inline-flex text-xs font-medium text-slate-500 hover:text-slate-800">
        ← Retour au catalogue
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {product ? (
            <StatusBadge label={productStatusLabel(product.status)} tone={productStatusTone(product.status)} />
          ) : null}
          <span className="font-mono text-xs text-slate-500">{reference || product?.reference}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{name || product?.name || "Fiche article"}</h1>
        <p className="text-sm text-slate-500">
          Modifiez l&apos;identité et le visuel ici. Les prix se gèrent dans{" "}
          <Link to="/admin/pricing" className="font-medium text-slate-700 underline-offset-2 hover:underline">
            Prix &amp; remises
          </Link>
          ; cochez les boutiques autorisées ci-dessous.
        </p>
      </header>

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      {leaves.length === 0 && canManage ? (
        <Alert tone="info">
          Aucune feuille de catégorie.{" "}
          <Link to="/admin/categories" className="font-medium text-slate-700 underline-offset-2 hover:underline">
            Créez d&apos;abord l&apos;arbre
          </Link>
          .
        </Alert>
      ) : null}

      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 text-xs shadow-sm">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Identité</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <CompactField label="Référence *" htmlFor="product-ref" hint="2–32 caractères (A-Z, 0-9, tiret)">
              <input
                id="product-ref"
                value={reference}
                onChange={(event) => setReference(event.target.value.toUpperCase())}
                className={`${modalFieldClassName} font-mono tracking-wide`}
                required
                minLength={2}
                maxLength={32}
                disabled={readOnly}
              />
            </CompactField>
            <CompactField label="Libellé *" htmlFor="product-name">
              <input
                id="product-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={modalFieldClassName}
                required
                minLength={2}
                maxLength={160}
                disabled={readOnly}
              />
            </CompactField>
            <CompactField label="Catégorie feuille *" htmlFor="product-category" className="sm:col-span-2">
              <select
                id="product-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className={modalFieldClassName}
                required
                disabled={readOnly}
              >
                <option value="">Choisir…</option>
                {leaves.map((leaf) => (
                  <option key={leaf.id} value={leaf.id}>
                    {leaf.parentName ? `${leaf.parentName} · ${leaf.name}` : leaf.name}
                  </option>
                ))}
              </select>
            </CompactField>
            <CompactField label="Marque" htmlFor="product-brand">
              <input
                id="product-brand"
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                className={modalFieldClassName}
                maxLength={80}
                disabled={readOnly}
              />
            </CompactField>
            <CompactField label="Pays d&apos;origine" htmlFor="product-origin">
              <input
                id="product-origin"
                value={originCountry}
                onChange={(event) => setOriginCountry(event.target.value)}
                className={modalFieldClassName}
                maxLength={80}
                disabled={readOnly}
              />
            </CompactField>
            <CompactField label="Description" htmlFor="product-description" className="sm:col-span-2">
              <textarea
                id="product-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={`${modalFieldClassName} min-h-24 resize-y leading-relaxed`}
                maxLength={4000}
                disabled={readOnly}
              />
            </CompactField>
            <CompactField label="Seuil d&apos;alerte stock" htmlFor="product-threshold" hint="Vide = seuil global application">
              <input
                id="product-threshold"
                type="number"
                min={0}
                value={alertThreshold}
                onChange={(event) => setAlertThreshold(event.target.value)}
                className={`${modalFieldClassName} font-mono tabular-nums`}
                placeholder="Défaut application"
                disabled={readOnly}
              />
            </CompactField>
          </div>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-5">
          <h2 className="text-sm font-semibold text-slate-900">Visuel catalogue</h2>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!readOnly) {
                setDragOver(true);
              }
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col gap-4 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center ${
              dragOver ? "border-slate-400 bg-slate-50" : "border-slate-200 bg-slate-50/50"
            }`}
          >
            <div className="relative h-28 w-36 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
              <ProductPhoto url={photoPreview} name={name || "Article"} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={readOnly}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                onPickFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {readOnly ? (
              <p className="text-[11px] text-slate-500">Lecture seule</p>
            ) : (
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-[11px] leading-relaxed text-slate-500">
                  JPEG, PNG ou WebP — recadrage avant envoi, fichier final sous 2 Mo.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {photoPreview ? "Changer le visuel" : "Ajouter une photo"}
                  </button>
                  {photoPreview ? (
                    <button
                      type="button"
                      onClick={() => void recropCurrent()}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Recadrer
                    </button>
                  ) : null}
                  {photoPreview ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (photoFile) {
                          if (photoPreview.startsWith("blob:")) {
                            URL.revokeObjectURL(photoPreview);
                          }
                          setPhotoFile(null);
                          setPhotoPreview(product?.photoUrl ?? null);
                          return;
                        }
                        void photoMutation.mutateAsync();
                      }}
                      className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
                    >
                      Retirer
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Tarif courant</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Lecture seule sur cette fiche — historique et mises à jour via Prix &amp; remises.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <TarifStat label="Prix d'achat" value={formatUsd(Number.parseFloat(purchasePrice) || 0)} />
            <TarifStat label="Prix officiel" value={formatUsd(Number.parseFloat(officialPrice) || 0)} />
            <TarifStat label="Remise" value={`${discountPercent} %`} />
          </dl>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-xs font-medium text-slate-600">Prix final unitaire</span>
            <span className="font-mono text-lg font-semibold tabular-nums text-slate-900">{formatUsd(finalPrice)}</span>
          </div>
        </section>

        {product ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Cycle de vie</h2>
            <p className="mt-1 text-[11px] text-slate-500">Brouillon → actif → inactif / archivé</p>
            {canManage ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {product.status === "DRAFT" || product.status === "INACTIVE" ? (
                  <Button
                    type="button"
                    onClick={() => void statusMutation.mutateAsync("ACTIVE")}
                    disabled={statusMutation.isPending}
                  >
                    Activer
                  </Button>
                ) : null}
                {product.status === "ACTIVE" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void statusMutation.mutateAsync("INACTIVE")}
                    disabled={statusMutation.isPending}
                  >
                    Désactiver
                  </Button>
                ) : null}
                {product.status !== "ARCHIVED" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void statusMutation.mutateAsync("ARCHIVED")}
                    disabled={statusMutation.isPending}
                  >
                    Archiver
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void statusMutation.mutateAsync("DRAFT")}
                    disabled={statusMutation.isPending}
                  >
                    Rouvrir en brouillon
                  </Button>
                )}
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500">Consultation seule.</p>
            )}
          </section>
        ) : null}
      </div>

      {product ? (
        <>
          <ProductBarcodePanel
            productId={product.id}
            name={product.name}
            reference={product.reference}
            price={product.finalPrice}
            barcode={product.barcode}
            canGenerate={canManage}
            canPrint={canPrintBarcodes}
          />
          <ProductStoreAuthorizations productId={product.id} canManage={canManage} />
        </>
      ) : null}

      {canManage ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
          <Link
            to="/admin/products"
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitDisabled}
            className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            {saveMutation.isPending ? "Enregistrement…" : "Enregistrer la fiche"}
          </button>
        </div>
      ) : null}
    </form>
      {cropper ? (
        <ProductPhotoCropper
          source={cropper.source}
          fileName={cropper.fileName}
          onCancel={closeCropper}
          onConfirm={applyCrop}
        />
      ) : null}
    </>
  );
}

function TarifStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function CompactField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  const Tag = htmlFor ? "label" : "div";
  return (
    <Tag className={`block ${className ?? ""}`} htmlFor={htmlFor}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </Tag>
  );
}
