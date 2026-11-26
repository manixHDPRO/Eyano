import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { ghostLinkClassName, linkButtonClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { filterInputClassName, filterLabelClassName } from "../../components/ui/form-styles";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../lib/api/notifications";
import { fetchStores } from "../../lib/api/stores";
import type { AppNotificationItem } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import {
  NOTIFICATION_TYPE_OPTIONS,
  notificationActionHref,
  notificationSeverityDotClass,
  notificationSeverityTitleClass,
  notificationTypeLabel,
} from "./notification-display";

export function NotificationsCenterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [page, setPage] = useState(1);
  const [storeId, setStoreId] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const canSettings = hasPermission(user, "settings.update") || hasPermission(user, "settings.update_critical");

  const storesQuery = useQuery({
    queryKey: ["stores-notifications-filter"],
    queryFn: () => fetchStores({ page: 1, pageSize: 100 }),
  });

  const listQuery = useQuery({
    queryKey: ["notifications", "center", page, storeId, typeFilter, unreadOnly],
    queryFn: () =>
      fetchNotifications({
        page,
        pageSize: 20,
        storeId: storeId || undefined,
        type: typeFilter || undefined,
        unreadOnly: unreadOnly || undefined,
      }),
    refetchInterval: 45_000,
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(storeId || undefined),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      pushToast({
        tone: "success",
        message:
          result.updated > 0
            ? `${result.updated} notification(s) marquée(s) comme lues.`
            : "Aucune notification non lue à traiter.",
      });
    },
    onError: (error) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(error, "Marquage impossible.") });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const errorMessage = listQuery.isError ? formatApiErrorMessage(listQuery.error, "Chargement impossible.") : null;
  const items = listQuery.data?.items ?? [];
  const unreadCount = listQuery.data?.unreadCount ?? 0;

  const storeOptions = useMemo(() => storesQuery.data?.items ?? [], [storesQuery.data?.items]);

  async function onOpenNotification(item: AppNotificationItem) {
    if (!item.readAt) {
      await markOneMutation.mutateAsync(item.id);
    }
    const href = notificationActionHref(item);
    if (href) {
      navigate(href);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Centre de notifications"
        description="Alertes stock (rupture et seuil), transferts, caisse, tarifs et opérations boutique — selon votre périmètre."
        actions={
          <div className="flex flex-wrap gap-2">
            {canSettings ? (
              <Link to="/admin/settings" className={ghostLinkClassName}>
                Paramètres de notifications
              </Link>
            ) : null}
            <Link to="/admin/stock" className={ghostLinkClassName}>
              Soldes stock
            </Link>
          </div>
        }
      />

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-slate-900">Fil d’activité</h2>
            {unreadCount > 0 ? (
              <StatusBadge label={`${unreadCount} non lue(s)`} tone="warning" compact />
            ) : (
              <StatusBadge label="À jour" tone="success" compact />
            )}
          </div>
          <button
            type="button"
            disabled={markAllMutation.isPending || unreadCount === 0}
            onClick={() => markAllMutation.mutate()}
            className={linkButtonClassName}
          >
            {markAllMutation.isPending ? "…" : "Tout marquer comme lu"}
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className={filterLabelClassName}>Boutique</span>
              <select
                value={storeId}
                onChange={(event) => {
                  setStoreId(event.target.value);
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                <option value="">Toutes (périmètre)</option>
                {storeOptions.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} — {store.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={filterLabelClassName}>Type</span>
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                {NOTIFICATION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end sm:col-span-2 lg:col-span-1">
              <span className="inline-flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(event) => {
                    setUnreadOnly(event.target.checked);
                    setPage(1);
                  }}
                  className="size-3.5 rounded border-slate-300"
                />
                Afficher uniquement les non lues
              </span>
            </label>
          </div>
        </div>

        {listQuery.isLoading ? (
          <div className="space-y-0 divide-y divide-slate-100">
            {[1, 2, 3, 4].map((key) => (
              <div key={key} className="h-20 animate-pulse bg-slate-50/50" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-slate-500">
            Aucune notification pour ces filtres. Les alertes stock incluent les ruptures et les produits sous seuil.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                pending={markOneMutation.isPending}
                onOpen={() => void onOpenNotification(item)}
              />
            ))}
          </ul>
        )}

        {listQuery.data ? (
          <div className="border-t border-slate-100 px-5 py-3">
            <Pagination
              page={listQuery.data.page}
              totalPages={listQuery.data.totalPages}
              totalItems={listQuery.data.total}
              onPageChange={setPage}
              itemLabel="notifications"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function NotificationRow({
  item,
  pending,
  onOpen,
}: {
  item: AppNotificationItem;
  pending: boolean;
  onOpen: () => void;
}) {
  const isUnread = !item.readAt;
  const actionHref = notificationActionHref(item);

  return (
    <li>
      <button
        type="button"
        disabled={pending}
        onClick={onOpen}
        className={`w-full px-5 py-3.5 text-left text-xs transition hover:bg-slate-50/80 ${
          isUnread ? "bg-slate-50/40" : "opacity-80"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-1.5 size-2 shrink-0 rounded-full ${notificationSeverityDotClass(item.severity)}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`font-semibold ${notificationSeverityTitleClass(item.severity)}`}>{item.title}</span>
              <span className="font-mono text-[11px] text-slate-400">
                {new Date(item.createdAt).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-1 text-slate-600">{item.body}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge label={notificationTypeLabel(item.type)} tone="neutral" compact />
              {isUnread ? <StatusBadge label="Non lue" tone="warning" compact /> : null}
              {actionHref ? (
                <span className="text-[11px] font-medium text-slate-500">Ouvrir le détail associé →</span>
              ) : null}
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}