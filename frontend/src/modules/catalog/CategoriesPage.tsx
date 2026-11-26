import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { FormField, inputClassName } from "../../components/ui/FormField";
import { PageHeader } from "../../components/ui/PageHeader";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import {
  archiveCategory,
  createCategory,
  deleteCategory,
  fetchCategoryTree,
  restoreCategory,
  updateCategory,
} from "../../lib/api/categories";
import type { CategoryNode } from "../../lib/api/types";
import { categoryStatusLabel, categoryStatusTone } from "./category-status";

type DraftMode = { kind: "root" } | { kind: "child"; parent: CategoryNode } | null;

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const { pushToast, confirm } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<DraftMode>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [collapsedRootIds, setCollapsedRootIds] = useState<Set<string>>(() => new Set());

  const treeQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategoryTree,
  });

  const items = useMemo(() => {
    const roots = treeQuery.data?.items ?? [];
    if (showArchived) {
      return roots;
    }
    return roots
      .filter((root) => root.status === "ACTIVE")
      .map((root) => ({
        ...root,
        children: root.children.filter((child) => child.status === "ACTIVE"),
      }));
  }, [showArchived, treeQuery.data?.items]);

  const selected = useMemo(() => findNode(treeQuery.data?.items ?? [], selectedId), [selectedId, treeQuery.data?.items]);

  const errorMessage = treeQuery.isError ? formatApiErrorMessage(treeQuery.error, "Chargement impossible.") : null;
  const stats = treeQuery.data?.stats;

  function resetDraft() {
    setDraft(null);
    setName("");
    setSortOrder("0");
  }

  function openCreateRoot() {
    setSelectedId(null);
    setDraft({ kind: "root" });
    setName("");
    setSortOrder(String(stats?.roots ?? 0));
  }

  function openCreateChild(parent: CategoryNode) {
    expandRoot(parent.id);
    setSelectedId(parent.id);
    setDraft({ kind: "child", parent });
    setName("");
    setSortOrder(String(parent.children.length));
  }

  const expandRoot = useCallback((rootId: string) => {
    setCollapsedRootIds((current) => {
      if (!current.has(rootId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(rootId);
      return next;
    });
  }, []);

  const toggleRootCollapsed = useCallback((rootId: string) => {
    setCollapsedRootIds((current) => {
      const next = new Set(current);
      if (next.has(rootId)) {
        next.delete(rootId);
      } else {
        next.add(rootId);
      }
      return next;
    });
  }, []);

  const collapseAllRoots = useCallback(() => {
    setCollapsedRootIds(new Set(items.filter((root) => root.children.length > 0).map((root) => root.id)));
  }, [items]);

  const expandAllRoots = useCallback(() => {
    setCollapsedRootIds(new Set());
  }, []);

  function selectNode(node: CategoryNode) {
    resetDraft();
    if (node.parentId) {
      expandRoot(node.parentId);
    }
    setSelectedId(node.id);
    setName(node.name);
    setSortOrder(String(node.sortOrder));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (draft) {
        return createCategory({
          name,
          parentId: draft.kind === "child" ? draft.parent.id : undefined,
          sortOrder: Number.parseInt(sortOrder, 10) || 0,
        });
      }
      if (!selectedId) {
        throw new Error("Aucune catégorie sélectionnée.");
      }
      return updateCategory(selectedId, {
        name,
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
      });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["category-leaves"] });
      pushToast({
        tone: "success",
        message: draft ? "Catégorie créée." : "Catégorie enregistrée.",
      });
      resetDraft();
      setSelectedId(saved.id);
      setName(saved.name);
      setSortOrder(String(saved.sortOrder));
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Enregistrement impossible.") });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveCategory(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["category-leaves"] });
      pushToast({ tone: "success", message: "Catégorie archivée. Les produits restent classés." });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Archivage impossible.") });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreCategory(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["category-leaves"] });
      pushToast({ tone: "success", message: "Catégorie réactivée." });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Réactivation impossible.") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["category-leaves"] });
      setSelectedId(null);
      resetDraft();
      pushToast({ tone: "success", message: "Catégorie supprimée." });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Suppression impossible.") });
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void saveMutation.mutateAsync();
  }

  const inspectorTitle = draft
    ? draft.kind === "root"
      ? "Nouvelle catégorie"
      : `Sous-catégorie de ${draft.parent.name}`
    : selected
      ? selected.name
      : "Sélectionnez une catégorie";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Catégories"
        description="Deux niveaux seulement : une famille, puis ses feuilles. Les produits se classent exclusivement sur une feuille."
        actions={
          <Button type="button" onClick={openCreateRoot}>
            Nouvelle famille
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Familles" value={stats?.roots} />
        <StatCard label="Sous-catégories" value={stats?.children} />
        <StatCard label="Feuilles actives" value={stats?.leaves} hint="Rattachement produits" />
        <StatCard label="Archivées" value={stats?.archived} />
      </section>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.2fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Arborescence</h2>
            <div className="flex flex-wrap items-center gap-2">
              {items.some((root) => root.children.length > 0) ? (
                <>
                  <button
                    type="button"
                    onClick={expandAllRoots}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Tout déplier
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllRoots}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Tout replier
                  </button>
                </>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                  className="accent-[var(--color-eyano-accent)]"
                />
                Archivées
              </label>
            </div>
          </div>
          {treeQuery.isLoading ? (
            <p className="px-2 py-10 text-center text-sm text-slate-500">Chargement de l’arbre…</p>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center">
              <p className="font-medium text-slate-900">Aucune famille pour l’instant</p>
              <p className="mt-1 text-sm text-slate-400">Créez « Boissons », puis une feuille « Eaux ».</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {items.map((root) => (
                <TreeNode
                  key={root.id}
                  node={root}
                  selectedId={draft?.kind === "child" ? draft.parent.id : selectedId}
                  onSelect={selectNode}
                  onAddChild={openCreateChild}
                  collapsedRootIds={collapsedRootIds}
                  onToggleRoot={toggleRootCollapsed}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-lg shadow-sm">
          {!draft && !selected ? (
            <div className="grid min-h-72 place-items-center text-center">
              <div>
                <p className="text-lg font-medium text-slate-900">Construisez le rayon</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
                  Une famille peut recevoir des produits tant qu’elle n’a pas de sous-catégorie. Dès qu’une feuille existe,
                  les articles y descendent.
                </p>
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-600">
                    {draft ? "Création" : selected?.depth === 1 ? "Famille" : "Feuille"}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">{inspectorTitle}</h2>
                  {selected && !draft ? (
                    <p className="mt-1 font-mono text-xs text-slate-500">{selected.slug}</p>
                  ) : null}
                </div>
                {selected && !draft ? (
                  <StatusBadge label={categoryStatusLabel(selected.status)} tone={categoryStatusTone(selected.status)} />
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Libellé" htmlFor="category-name">
                  <input
                    id="category-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClassName}
                    placeholder="Ex. Boissons"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </FormField>
                <FormField label="Ordre d’affichage" htmlFor="category-sort" hint="Plus petit = plus haut dans la liste">
                  <input
                    id="category-sort"
                    type="number"
                    min={0}
                    max={9999}
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                    className={inputClassName}
                  />
                </FormField>
              </div>

              {selected && !draft ? (
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-slate-200 px-2.5 py-1">
                    {selected.productCount} produit{selected.productCount > 1 ? "s" : ""}
                  </span>
                  <span className="rounded-full border border-slate-200 px-2.5 py-1">
                    {selected.activeProductCount} actif{selected.activeProductCount > 1 ? "s" : ""}
                  </span>
                  {selected.childCount === 0 ? (
                    <Link
                      to={`/admin/products?categoryId=${selected.id}`}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-100"
                    >
                      Voir les produits
                    </Link>
                  ) : (
                    <span className="rounded-full border border-slate-200 px-2.5 py-1">
                      {selected.childCount} sous-catégorie{selected.childCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saveMutation.isPending || name.trim().length < 2}>
                  {draft ? "Créer" : "Enregistrer"}
                </Button>
                {draft ? (
                  <Button type="button" variant="ghost" onClick={resetDraft}>
                    Annuler
                  </Button>
                ) : null}
                {selected && !draft && selected.status === "ACTIVE" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void archiveMutation.mutateAsync(selected.id)}
                    disabled={archiveMutation.isPending}
                  >
                    Archiver
                  </Button>
                ) : null}
                {selected && !draft && selected.status === "ARCHIVED" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void restoreMutation.mutateAsync(selected.id)}
                    disabled={restoreMutation.isPending}
                  >
                    Réactiver
                  </Button>
                ) : null}
                {selected && !draft && selected.productCount === 0 && selected.childCount === 0 ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      void (async () => {
                        const accepted = await confirm({
                          title: "Supprimer la catégorie",
                          message: `Supprimer définitivement « ${selected.name} » ?`,
                          confirmLabel: "Supprimer",
                          tone: "danger",
                        });
                        if (accepted) {
                          void deleteMutation.mutateAsync(selected.id);
                        }
                      })();
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    Supprimer
                  </Button>
                ) : null}
              </div>

              {selected && !draft && selected.productCount > 0 ? (
                <Alert tone="info">
                  Des produits y sont rattachés : la suppression est refusée, l’archivage conserve le classement.
                </Alert>
              ) : null}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function TreeNode({
  node,
  selectedId,
  onSelect,
  onAddChild,
  collapsedRootIds,
  onToggleRoot,
}: {
  node: CategoryNode;
  selectedId: string | null;
  onSelect: (node: CategoryNode) => void;
  onAddChild: (parent: CategoryNode) => void;
  collapsedRootIds: Set<string>;
  onToggleRoot: (rootId: string) => void;
}) {
  const selected = node.id === selectedId;
  const archived = node.status === "ARCHIVED";
  const isFamily = node.depth === 1;
  const hasChildren = node.children.length > 0;
  const collapsed = isFamily && hasChildren && collapsedRootIds.has(node.id);

  return (
    <li>
      <div
        className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
          selected
            ? "border-slate-200 bg-slate-100"
            : "border-transparent hover:border-slate-200 hover:bg-slate-50"
        } ${archived ? "opacity-60" : ""}`}
      >
        {isFamily && hasChildren ? (
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Déplier ${node.name}` : `Replier ${node.name}`}
            onClick={() => onToggleRoot(node.id)}
            className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800"
          >
            <svg
              className={`size-4 transition-transform ${collapsed ? "" : "rotate-90"}`}
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M6 4.5 10.5 8 6 11.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : isFamily ? (
          <span className="size-7 shrink-0" aria-hidden />
        ) : null}
        <button type="button" onClick={() => onSelect(node)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium text-slate-900">{node.name}</span>
          <span className="mt-0.5 block text-[11px] text-slate-500">
            {node.childCount > 0
              ? `${node.childCount} feuille${node.childCount > 1 ? "s" : ""}`
              : `${node.productCount} produit${node.productCount > 1 ? "s" : ""}`}
          </span>
        </button>
        {node.depth === 1 && node.status === "ACTIVE" ? (
          <button
            type="button"
            title="Ajouter une sous-catégorie"
            onClick={() => onAddChild(node)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-400 transition hover:border-slate-200 hover:text-slate-600"
          >
            + Feuille
          </button>
        ) : null}
      </div>
      {hasChildren && !collapsed ? (
        <ul className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              collapsedRootIds={collapsedRootIds}
              onToggleRoot={onToggleRoot}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function findNode(nodes: CategoryNode[], id: string | null): CategoryNode | null {
  if (!id) {
    return null;
  }
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const nested = findNode(node.children, id);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function StatCard({ label, value, hint }: { label: string; value: number | undefined; hint?: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white/30 p-4 shadow-lg shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value ?? "—"}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </article>
  );
}
