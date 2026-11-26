import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import {
  posInputActionButtonClassName,
  posScanInputClassName,
  posSearchInputClassName,
} from "../../components/ui/form-styles";
import { useToast } from "../../components/ui/Toast";
import { Pagination } from "../../components/ui/Pagination";
import { closeCashSession, fetchCurrentCashSession, openCashSession } from "../../lib/api/cash-sessions";
import { lookupBarcode } from "../../lib/api/barcodes";
import { fetchCurrentExchangeRates } from "../../lib/api/exchange-rates";
import { DEFAULT_ENCAISSEMENT_CDF_PER_USD } from "../../lib/money/exchange-rate-defaults";
import { LIVE_SYNC_STALE_TIME_MS } from "../../lib/query/live-sync";
import { fetchPosCatalog, fetchPosDailySalesReport, fetchPosWorkspace } from "../../lib/api/pos";
import { createSale, fetchSale, fetchSales } from "../../lib/api/sales";
import { formatApiErrorMessage } from "../../lib/api/errors";
import type { PosCatalogItem, PosDailySalesReport, PosWorkspaceRegister, SaleDetail, SaleListItem } from "../../lib/api/types";
import { canReadAppNotifications } from "../../lib/auth/notification-access";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import { formatCdf, formatUsd } from "../catalog/money";
import { formatSaleCollected, formatSalePaymentLabel } from "../sales/sale-list-display";
import { ProductPhoto } from "../catalog/ProductPhoto";
import { PosDailySalesReportPrint } from "./PosDailySalesReportPrint";
import { PosReceiptModal } from "./PosReceiptModal";
import { PosInternalIssueAlert } from "./PosInternalIssueAlert";
import { PosExpensePendingAlert } from "./PosExpensePendingAlert";
import { PosTransferShippedAlert } from "./PosTransferShippedAlert";
import { CashSessionLedgerSummary } from "../sales/CashSessionLedgerSummary";
import { cartDiscountTotal, cartSubtotal, cartTotal, mergeCartLine, type PosCartLine } from "./pos-cart";
import { encaissementCdfTotal, type PosPaymentDraft } from "./pos-payments";
import { PosCloseSessionModal } from "./PosCloseSessionModal";
import { PosEncaissementModal } from "./PosEncaissementModal";
import { PosOpenSessionPanel } from "./PosOpenSessionPanel";
import { PosRegisterHeader } from "./PosRegisterHeader";
import { posPanelBodyClassName, posPanelClassName, posPanelHeaderClassName, posStickyAsideClassName, posToolbarButtonAccentClassName, posToolbarButtonClassName } from "./pos-shell-styles";
const POS_DISPLAY_KEY = "eyano.pos.display";
const POS_DISPLAY_MODES = ["cartes", "liste"] as const;
type PosDisplayMode = (typeof POS_DISPLAY_MODES)[number];

function readPosDisplayMode(): PosDisplayMode {
  try {
    const value = localStorage.getItem(POS_DISPLAY_KEY);
    return value === "liste" ? "liste" : "cartes";
  } catch {
    return "cartes";
  }
}

function writePosDisplayMode(mode: PosDisplayMode) {
  try {
    localStorage.setItem(POS_DISPLAY_KEY, mode);
  } catch {
    /* le choix reste actif pour la session */
  }
}

function pickDefaultRegister(registers: PosWorkspaceRegister[], primaryStoreId: string | null): PosWorkspaceRegister | null {
  if (registers.length === 0) {
    return null;
  }
  const inPrimary = primaryStoreId ? registers.filter((row) => row.store.id === primaryStoreId) : registers;
  const withSession = inPrimary.find((row) => row.openSession) ?? registers.find((row) => row.openSession);
  return withSession ?? inPrimary.find((row) => row.isDefault) ?? inPrimary[0] ?? null;
}

function cashierDisplayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function PosHomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const scanRef = useRef<HTMLInputElement>(null);
  const [registerId, setRegisterId] = useState("");
  const [scanValue, setScanValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [lastSale, setLastSale] = useState<SaleDetail | null>(null);
  const [receiptSale, setReceiptSale] = useState<SaleDetail | null>(null);
  const [showEncaissement, setShowEncaissement] = useState(false);
  const [showCloseSession, setShowCloseSession] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [displayMode, setDisplayMode] = useState<PosDisplayMode>(readPosDisplayMode);
  const [sessionHistoryPage, setSessionHistoryPage] = useState(1);
  const [dailyReportPrint, setDailyReportPrint] = useState<PosDailySalesReport | null>(null);
  const [dailyReportBusy, setDailyReportBusy] = useState(false);
  const checkoutKeyRef = useRef<string | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ["pos-workspace"],
    queryFn: fetchPosWorkspace,
  });

  const registers = workspaceQuery.data?.registers ?? [];
  const activeRegister = registers.find((row) => row.id === registerId) ?? null;
  const storeLocked =
    user?.role.code === "CASHIER" && (user.stores.length === 1 || registers.length <= 1);

  useEffect(() => {
    if (!workspaceQuery.data || registerId) {
      return;
    }
    const picked = pickDefaultRegister(workspaceQuery.data.registers, workspaceQuery.data.primaryStoreId);
    if (picked) {
      setRegisterId(picked.id);
    }
  }, [registerId, workspaceQuery.data]);

  const sessionQuery = useQuery({
    queryKey: ["cash-session", registerId],
    queryFn: () => fetchCurrentCashSession(registerId),
    enabled: Boolean(registerId),
  });

  const storeId = sessionQuery.data?.store.id ?? activeRegister?.store.id ?? null;
  const storeLabel = sessionQuery.data?.store ?? activeRegister?.store;
  const canReceiveTransfers = hasPermission(user, "transfers.receive");
  const canReadNotifications = canReadAppNotifications(user);

  const ratesQuery = useQuery({
    queryKey: ["exchange-rates-current"],
    queryFn: fetchCurrentExchangeRates,
    enabled: Boolean(sessionQuery.data),
    staleTime: LIVE_SYNC_STALE_TIME_MS,
  });

  const encaissementRate = ratesQuery.data?.encaissement?.rate ?? DEFAULT_ENCAISSEMENT_CDF_PER_USD;

  const catalogQuery = useQuery({
    queryKey: ["pos-catalog", storeId],
    queryFn: () => fetchPosCatalog(storeId!),
    enabled: Boolean(storeId && sessionQuery.data),
  });

  const cashSessionId = sessionQuery.data?.id;

  const recentSalesQuery = useQuery({
    queryKey: ["pos-recent-sales", storeId, cashSessionId],
    queryFn: () =>
      fetchSales({
        storeId: storeId!,
        cashSessionId: cashSessionId!,
        pageSize: 30,
        status: "COMPLETED",
      }),
    enabled: Boolean(storeId && cashSessionId),
  });

  const storeHistoryQuery = useQuery({
    queryKey: ["pos-store-history", storeId, cashSessionId, sessionHistoryPage],
    queryFn: () =>
      fetchSales({
        storeId: storeId!,
        cashSessionId: cashSessionId!,
        page: sessionHistoryPage,
        pageSize: 15,
        status: "COMPLETED",
      }),
    enabled: Boolean(storeId && cashSessionId),
  });

  useEffect(() => {
    setSessionHistoryPage(1);
  }, [cashSessionId, storeId]);

  const mySales = useMemo(() => {
    if (!user || !recentSalesQuery.data) {
      return [];
    }
    const label = cashierDisplayName(user.firstName, user.lastName);
    return recentSalesQuery.data.items.filter((sale) => sale.cashierName === label).slice(0, 5);
  }, [recentSalesQuery.data, user]);

  const filteredCatalog = useMemo(() => {
    const items = catalogQuery.data?.items ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        (item.barcode?.toLowerCase().includes(q) ?? false),
    );
  }, [catalogQuery.data?.items, searchQuery]);

  const openSessionMutation = useMutation({
    mutationFn: (payload: { cashRegisterId: string; openingFloatUsd: number; openingFloatCdf: number }) =>
      openCashSession(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pos-workspace"] });
      await queryClient.invalidateQueries({ queryKey: ["cash-session", registerId] });
      await queryClient.invalidateQueries({ queryKey: ["pos-recent-sales", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["pos-store-history", storeId] });
      pushToast({ tone: "success", message: "Session de caisse ouverte." });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Ouverture impossible.") }),
  });

  const closeSessionMutation = useMutation({
    mutationFn: (payload: { countedUsd: number; countedCdf: number; note?: string }) => {
      if (!sessionQuery.data?.id) {
        throw new Error("Session requise");
      }
      return closeCashSession(sessionQuery.data.id, payload);
    },
    onSuccess: async (closed) => {
      setShowCloseSession(false);
      setCart([]);
      const vUsd = closed.varianceUsd ?? 0;
      const vCdf = closed.varianceCdf ?? 0;
      pushToast({
        tone: Math.abs(vUsd) > 0.01 || Math.abs(vCdf) > 100 ? "info" : "success",
        message: `Caisse clôturée. Écart : ${formatUsd(vUsd)} / ${formatCdf(vCdf)}. Déconnexion…`,
      });
      try {
        await logout();
      } finally {
        navigate("/login", { replace: true });
      }
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Clôture refusée.") }),
  });

  const saleMutation = useMutation({
    mutationFn: async (payments: PosPaymentDraft[]) => {
      if (!sessionQuery.data?.id) {
        throw new Error("Session requise");
      }
      if (cart.length === 0) {
        throw new Error("Panier vide");
      }
      if (!checkoutKeyRef.current) {
        checkoutKeyRef.current = crypto.randomUUID();
      }
      return createSale(checkoutKeyRef.current, {
        cashSessionId: sessionQuery.data.id,
        items: cart.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        payments: payments.map((row) => ({
          method: row.method,
          currency: row.currency,
          amount: row.amount,
          providerReference: row.providerReference,
        })),
      });
    },
    onSuccess: async (sale) => {
      checkoutKeyRef.current = null;
      setCart([]);
      setShowEncaissement(false);
      setLastSale(sale);
      setReceiptSale(sale);
      await queryClient.invalidateQueries({ queryKey: ["pos-catalog", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["pos-recent-sales", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["pos-store-history", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["cash-session", registerId] });
      pushToast({
        tone: sale.idempotentReplay ? "info" : "success",
        message: sale.idempotentReplay
          ? `Vente ${sale.number} déjà enregistrée.`
          : `Vente ${sale.number} validée et stock déduit.`,
      });
    },
    onError: (error) => pushToast({ tone: "error", message: formatApiErrorMessage(error, "Vente refusée.") }),
  });

  const totals = useMemo(
    () => ({
      subtotal: cartSubtotal(cart),
      discount: cartDiscountTotal(cart),
      total: cartTotal(cart),
    }),
    [cart],
  );

  const totalDisplayCdf = useMemo(
    () => encaissementCdfTotal(totals.total, encaissementRate),
    [encaissementRate, totals.total],
  );

  const refocusScan = useCallback(() => {
    window.setTimeout(() => scanRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    refocusScan();
  }, [cart.length, sessionQuery.data?.id, refocusScan]);

  const addCatalogProduct = (product: PosCatalogItem) => {
    if (!product.isAuthorized) {
      pushToast({ tone: "error", message: "Ce produit n'est pas autorisé à la vente dans cette boutique." });
      return;
    }
    if (product.stock <= 0) {
      pushToast({
        tone: "error",
        message: "Stock insuffisant : quantité disponible indisponible pour cette vente.",
      });
      return;
    }
    const line: PosCartLine = {
      productId: product.id,
      reference: product.reference,
      name: product.name,
      barcode: product.barcode,
      officialPrice: product.officialPrice,
      discountPercent: product.discountPercent,
      finalUnitPrice: product.finalPrice,
      quantity: 1,
      quantityAvailable: product.stock,
    };
    setCart((prev) => mergeCartLine(prev, line));
  };

  const handleScanSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = scanValue.trim();
    if (!code || !storeId) {
      if (!storeId && code) {
        pushToast({ tone: "info", message: "Ouvrez la session de caisse avant de scanner." });
      }
      return;
    }
    setScanValue("");
    try {
      const result = await lookupBarcode(code, storeId);
      if (result.product.status !== "ACTIVE") {
        pushToast({ tone: "error", message: "Produit non vendable." });
        return;
      }
      const available = result.stock?.quantityAvailable ?? null;
      if (available !== null && available <= 0) {
        pushToast({ tone: "error", message: "Rupture sur cette boutique." });
        return;
      }
      const incoming: PosCartLine = {
        productId: result.product.id,
        reference: result.product.reference,
        name: result.product.name,
        barcode: result.barcode?.code ?? null,
        officialPrice: result.product.officialPrice,
        discountPercent: result.product.discountPercent,
        finalUnitPrice: result.product.finalPrice,
        quantity: 1,
        quantityAvailable: available,
      };
      setCart((prev) => mergeCartLine(prev, incoming));
      pushToast({ tone: "success", message: `${result.product.reference} ajouté.` });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Article inconnu",
        message: formatApiErrorMessage(error, "Aucun produit pour ce scan."),
      });
    } finally {
      refocusScan();
    }
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.productId !== productId) {
            return line;
          }
          const next = line.quantity + delta;
          const max = line.quantityAvailable ?? 9_999;
          if (next > max) {
            pushToast({
              tone: "error",
              message: "Stock insuffisant : quantité disponible indisponible pour cette vente.",
            });
            return line;
          }
          return { ...line, quantity: next };
        })
        .filter((line) => line.quantity > 0),
    );
  };

  const openEncaissement = () => {
    if (!sessionQuery.data?.id) {
      pushToast({ tone: "error", message: "Veuillez d'abord ouvrir une session de caisse." });
      return;
    }
    if (!canSell || cart.length === 0 || saleMutation.isPending) {
      return;
    }
    checkoutKeyRef.current = crypto.randomUUID();
    setShowEncaissement(true);
  };

  const confirmEncaissement = (payments: PosPaymentDraft[]) => {
    void saleMutation.mutateAsync(payments);
  };

  const canOpenSession = user?.permissions.includes("cash.session") ?? false;
  const canSell = user?.permissions.includes("sales.create") ?? false;

  const printDailySalesReport = useCallback(async () => {
    if (!storeId || !registerId) {
      pushToast({ tone: "info", message: "Sélectionnez une caisse." });
      return;
    }
    setDailyReportBusy(true);
    try {
      const report = await fetchPosDailySalesReport({ storeId, cashRegisterId: registerId });
      setDailyReportPrint(report);
    } catch (error) {
      pushToast({
        tone: "error",
        message: formatApiErrorMessage(error, "Impossible de préparer le rapport journalier."),
      });
    } finally {
      setDailyReportBusy(false);
    }
  }, [pushToast, registerId, storeId]);
  const loadError = workspaceQuery.isError
    ? formatApiErrorMessage(workspaceQuery.error, "Espace caisse indisponible.")
    : null;

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <main className="pos-container mx-auto w-full max-w-[1600px] flex-1 space-y-6 px-4 py-6">
      {receiptSale ? <PosReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} /> : null}
      {dailyReportPrint ? (
        <PosDailySalesReportPrint report={dailyReportPrint} onPrinted={() => setDailyReportPrint(null)} />
      ) : null}

      {showCloseSession && sessionQuery.data ? (
        <PosCloseSessionModal
          session={sessionQuery.data}
          busy={closeSessionMutation.isPending}
          onClose={() => {
            if (!closeSessionMutation.isPending) {
              setShowCloseSession(false);
            }
          }}
          onConfirm={(payload) => {
            void closeSessionMutation.mutateAsync(payload);
          }}
        />
      ) : null}

      {showEncaissement && cart.length > 0 ? (
        <PosEncaissementModal
          saleTotalUsd={totals.total}
          encaissementRate={encaissementRate}
          itemCount={cartCount}
          busy={saleMutation.isPending}
          onClose={() => {
            if (!saleMutation.isPending) {
              setShowEncaissement(false);
              checkoutKeyRef.current = null;
            }
          }}
          onConfirm={confirmEncaissement}
        />
      ) : null}

      <PosRegisterHeader
        storeLabel={storeLabel ?? null}
        encaissementRate={encaissementRate}
        sessionOpen={Boolean(sessionQuery.data)}
        registers={registers}
        registerId={registerId}
        storeLocked={storeLocked}
        onRegisterChange={(id) => {
          setRegisterId(id);
          setCart([]);
        }}
        actions={
          <>
            {lastSale ? (
              <button type="button" onClick={() => setReceiptSale(lastSale)} className={posToolbarButtonClassName}>
                <ReceiptIcon />
                Dernier ticket
              </button>
            ) : null}
            <button type="button" onClick={() => setShowSalesModal(true)} className={posToolbarButtonClassName}>
              <HistoryIcon />
              Ventes ({mySales.length})
            </button>
            {storeId && registerId ? (
              <button
                type="button"
                disabled={dailyReportBusy}
                onClick={() => void printDailySalesReport()}
                className={posToolbarButtonClassName}
                title="Imprimer le rapport A4 des ventes du jour (cette caisse)"
              >
                <DailyReportIcon />
                {dailyReportBusy ? "Rapport…" : "Rapport jour"}
              </button>
            ) : null}
            {canReceiveTransfers ? (
              <Link
                to="/pos/receive-transfers?status=SHIPPED"
                className={`${posToolbarButtonAccentClassName} border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`}
              >
                <TruckInIcon />
                Transferts
              </Link>
            ) : null}
            {hasPermission(user, "cash.session") ? (
              <Link
                to="/pos/confirm-expenses"
                className={`${posToolbarButtonAccentClassName} border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100`}
              >
                Dépenses tiroir
              </Link>
            ) : null}
            {sessionQuery.data && canOpenSession ? (
              <button
                type="button"
                onClick={() => {
                  if (cart.length > 0) {
                    pushToast({ tone: "info", message: "Videz le panier avant de clôturer la caisse." });
                    return;
                  }
                  setShowCloseSession(true);
                }}
                className={`${posToolbarButtonAccentClassName} border-rose-200 bg-rose-50 text-rose-950 hover:bg-rose-100`}
              >
                <LockIcon />
                Clôturer
              </button>
            ) : null}
          </>
        }
      />

      <PosTransferShippedAlert
        storeId={storeId}
        fallbackStoreId={workspaceQuery.data?.primaryStoreId ?? user?.stores[0]?.id ?? null}
        pollEnabled={canReadNotifications}
      />

      <PosInternalIssueAlert
        storeId={storeId}
        fallbackStoreId={workspaceQuery.data?.primaryStoreId ?? user?.stores[0]?.id ?? null}
        pollEnabled={canReadNotifications}
      />

      <PosExpensePendingAlert
        storeId={storeId}
        fallbackStoreId={workspaceQuery.data?.primaryStoreId ?? user?.stores[0]?.id ?? null}
        pollEnabled={canReadNotifications}
      />

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      {!sessionQuery.data && !sessionQuery.isLoading && activeRegister ? (
        <PosOpenSessionPanel
          register={activeRegister}
          canOpen={canOpenSession && Boolean(registerId)}
          busy={openSessionMutation.isPending}
          onOpen={(payload) =>
            openSessionMutation.mutate({
              cashRegisterId: registerId,
              ...payload,
            })
          }
        />
      ) : null}

      {sessionQuery.data ? (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,19.5rem)]">
          <section className="min-w-0 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <form onSubmit={handleScanSubmit} className="relative min-w-0">
                <BarcodeIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={scanRef}
                  type="text"
                  value={scanValue}
                  onChange={(event) => setScanValue(event.target.value)}
                  placeholder="Scanner code-barres USB + Entrée..."
                  className={posScanInputClassName}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="submit" className={posInputActionButtonClassName}>
                  Scanner
                </button>
              </form>
              <div className="relative min-w-0">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Rechercher désignation ou référence..."
                  className={posSearchInputClassName}
                  autoComplete="off"
                />
              </div>
            </div>

            {catalogQuery.isLoading ? (
              <p className="py-12 text-center text-sm text-slate-500">Chargement du catalogue boutique…</p>
            ) : catalogQuery.isError ? (
              <Alert tone="error">{formatApiErrorMessage(catalogQuery.error, "Catalogue indisponible.")}</Alert>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">{filteredCatalog.length} article(s)</p>
                  <PosDisplayToggle
                    mode={displayMode}
                    onChange={(mode) => {
                      setDisplayMode(mode);
                      writePosDisplayMode(mode);
                    }}
                  />
                </div>
                {displayMode === "cartes" && filteredCatalog.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                    {filteredCatalog.map((product) => (
                      <PosProductCard key={product.id} product={product} onAdd={() => addCatalogProduct(product)} />
                    ))}
                  </div>
                ) : null}
                {displayMode === "liste" && filteredCatalog.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {filteredCatalog.map((product) => (
                      <PosProductRow key={product.id} product={product} onAdd={() => addCatalogProduct(product)} />
                    ))}
                  </div>
                ) : null}
                {filteredCatalog.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">Aucun article pour ces filtres.</p>
                ) : null}
              </>
            )}
          </section>

          <aside className={posStickyAsideClassName}>
            <div className={`space-y-3 ${posPanelClassName}`}>
              <div className={`${posPanelHeaderClassName} border-b border-slate-200`}>
                <div className="flex items-center gap-1.5">
                  <BagIcon className="size-3.5" />
                  <h2 className="text-sm font-semibold text-slate-900">Panier en cours</h2>
                </div>
                <span className="font-mono text-[11px] text-slate-500">{cartCount} article(s)</span>
              </div>
              <div className={`space-y-3 ${posPanelBodyClassName} pt-3`}>

              {cart.length === 0 ? (
                <p className="py-6 text-center text-[11px] leading-relaxed text-slate-400">
                  Scannez un code-barres ou cliquez sur un produit autorisé pour démarrer la vente.
                </p>
              ) : (
                <ul className="max-h-44 space-y-2 overflow-y-auto pr-0.5">
                  {cart.map((line) => (
                    <li key={line.productId} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900">{line.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {formatUsd(line.finalUnitPrice)} / u.
                          {line.discountPercent > 0 ? ` (Remise −${line.discountPercent} %)` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <QtyButton label="Moins" onClick={() => updateCartQty(line.productId, -1)}>
                          −
                        </QtyButton>
                        <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums">{line.quantity}</span>
                        <QtyButton label="Plus" onClick={() => updateCartQty(line.productId, 1)}>
                          +
                        </QtyButton>
                        <button
                          type="button"
                          className="p-1 text-slate-400 hover:text-red-600"
                          aria-label={`Retirer ${line.name}`}
                          onClick={() => updateCartQty(line.productId, -line.quantity)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-1 border-t border-slate-200 pt-2 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Sous-total initial</span>
                  <span className="font-mono tabular-nums">{formatUsd(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Remises automatiques</span>
                  <span className="font-mono tabular-nums">−{formatUsd(totals.discount)}</span>
                </div>
                <div className="flex justify-between pt-0.5 text-sm font-bold text-slate-900">
                  <span>Total à payer</span>
                  <span className="font-mono tabular-nums">{formatUsd(totals.total)}</span>
                </div>
                <p className="text-right font-mono text-[11px] text-slate-500">
                  Équivalent {formatCdf(totalDisplayCdf)} CDF (taux du jour)
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Paiement mixte USD / CDF, espèces ou Mobile Money — taux figé à la validation.
                </p>
                <button
                  type="button"
                  disabled={!canSell || cart.length === 0 || saleMutation.isPending}
                  onClick={openEncaissement}
                  className="w-full rounded-lg bg-emerald-700 py-2.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-40"
                >
                  {saleMutation.isPending ? "Validation en cours…" : "Encaisser & valider la vente"}
                </button>
              </div>
              </div>
            </div>

            <CashSessionLedgerSummary
              session={sessionQuery.data}
              variant="pos"
              title={`Session #${sessionQuery.data.id.slice(0, 8).toUpperCase()}`}
            />

            <section aria-label="Mes 5 dernières ventes validées" className={`${posPanelClassName} text-[11px] text-slate-800`}>
              <div className={`${posPanelHeaderClassName} border-b border-slate-200`}>
                <div className="min-w-0">
                  <h2 className="text-xs font-semibold tracking-tight text-slate-900">Mes 5 dernières ventes validées</h2>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
                    {user ? cashierDisplayName(user.firstName, user.lastName) : "—"} · Vérification rapide
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSalesModal(true)}
                  className="whitespace-nowrap font-mono text-[11px] font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950"
                >
                  Détails
                </button>
              </div>
              <div className={`${posPanelBodyClassName} space-y-2 pt-2`}>
              {mySales.length === 0 ? (
                <p className="py-2 text-center font-mono text-[10px] text-slate-500">
                  Aucune vente validée par votre compte sur cette session de caisse.
                </p>
              ) : (
                <div className="max-h-36 divide-y divide-slate-200/70 overflow-y-auto">
                  {mySales.map((sale) => (
                    <div
                      key={sale.id}
                      className="-mx-1 flex items-center justify-between gap-1.5 rounded px-1 py-1.5 transition hover:bg-slate-100/80"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[11px] font-semibold text-slate-900">{sale.number}</p>
                        <p className="font-mono text-[10px] tabular-nums text-slate-500">
                          {new Date(sale.completedAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}{" "}
                          · {formatSalePaymentLabel(sale)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="font-mono text-[11px] font-bold tabular-nums text-slate-950">
                          {formatSaleCollected(sale)}
                        </span>
                        <button
                          type="button"
                          title="Vérifier le ticket"
                          onClick={() => void reprintListSale(sale.id, setReceiptSale)}
                          className="rounded border border-slate-300 bg-white p-1 text-slate-700 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
                        >
                          <PrinterIcon className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </section>
          </aside>
        </div>
      ) : null}

      {sessionQuery.data && storeLabel ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Historique des ventes — {storeLabel.name}
            {storeLabel.city ? ` — ${storeLabel.city}` : ""}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 font-medium">N° Ticket</th>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Caissier</th>
                  <th className="py-2 font-medium">Mode</th>
                  <th className="py-2 text-right font-medium">Total USD</th>
                  <th className="py-2 text-right font-medium">Encaissé</th>
                  <th className="py-2 text-right font-medium">Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(storeHistoryQuery.data?.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      {storeHistoryQuery.isLoading
                        ? "Chargement…"
                        : "Aucune vente enregistrée sur cette session de caisse."}
                    </td>
                  </tr>
                ) : (
                  storeHistoryQuery.data?.items.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 font-mono font-semibold text-slate-900">{sale.number}</td>
                      <td className="py-2.5 text-slate-500">
                        {new Date(sale.completedAt).toLocaleString("fr-FR")}
                      </td>
                      <td className="py-2.5 text-slate-700">{sale.cashierName}</td>
                      <td className="py-2.5 text-slate-600">
                        {formatSalePaymentLabel(sale)}
                        {sale.primaryPayment?.providerReference ? ` · ${sale.primaryPayment.providerReference}` : ""}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-900">{formatUsd(sale.total)}</td>
                      <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {formatSaleCollected(sale)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => void reprintListSale(sale.id, setReceiptSale)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <PrinterIcon className="size-3" />
                          Ticket
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {storeHistoryQuery.data ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <Pagination
                page={storeHistoryQuery.data.page}
                totalPages={storeHistoryQuery.data.totalPages}
                totalItems={storeHistoryQuery.data.total}
                onPageChange={setSessionHistoryPage}
                itemLabel="ventes"
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {showSalesModal ? (
        <RecentSalesModal sales={mySales} onClose={() => setShowSalesModal(false)} onReprint={setReceiptSale} />
      ) : null}

    </main>
  );
}

async function reprintListSale(saleId: string, onPrint: (sale: SaleDetail) => void) {
  const detail = await fetchSale(saleId);
  onPrint(detail);
}

function PosDisplayToggle({
  mode,
  onChange,
}: {
  mode: PosDisplayMode;
  onChange: (mode: PosDisplayMode) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Mode d'affichage du catalogue" className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {POS_DISPLAY_MODES.map((id) => {
        const selected = mode === id;
        const label = displayModeLabel(id);
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              selected ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function displayModeLabel(mode: PosDisplayMode): string {
  switch (mode) {
    case "cartes":
      return "Cartes";
    case "liste":
      return "Liste";
    default: {
      const unknown: never = mode;
      return unknown;
    }
  }
}

function PosProductRow({ product, onAdd }: { product: PosCatalogItem; onAdd: () => void }) {
  const blocked = !product.isAuthorized || product.stock <= 0;
  return (
    <button
      type="button"
      onClick={onAdd}
      className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 ${
        blocked ? "opacity-70 hover:bg-red-50" : "hover:bg-slate-50"
      }`}
    >
      <div className="size-12 shrink-0 overflow-hidden rounded-md bg-slate-100">
        <ProductPhoto url={product.photoUrl} name={product.name} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
        <p className="truncate font-mono text-[11px] text-slate-500">
          {product.reference}
          {product.barcode ? ` · ${product.barcode}` : ""}
        </p>
      </div>
      <div className="hidden shrink-0 text-right font-mono text-[11px] sm:block">
        {!product.isAuthorized ? (
          <span className="font-semibold text-red-700">Bloqué</span>
        ) : product.stock <= 0 ? (
          <span className="font-semibold text-red-700">Rupture</span>
        ) : (
          <span className="text-emerald-700">Stock {product.stock}</span>
        )}
      </div>
      <p className="shrink-0 font-mono text-sm font-bold tabular-nums text-slate-900">
        {product.isAuthorized ? formatUsd(product.finalPrice) : "—"}
      </p>
    </button>
  );
}

function PosProductCard({ product, onAdd }: { product: PosCatalogItem; onAdd: () => void }) {
  const blocked = !product.isAuthorized || product.stock <= 0;
  return (
    <button
      type="button"
      onClick={onAdd}
      className={`flex h-full flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition ${
        blocked ? "border-slate-200 opacity-75 hover:border-red-300" : "border-slate-200 hover:border-slate-900"
      }`}
    >
      <div className="relative h-24 w-full shrink-0 overflow-hidden bg-slate-100 sm:h-[6.5rem]">
        <ProductPhoto url={product.photoUrl} name={product.name} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 p-2.5">
        <div className="min-w-0">
          <p className="truncate font-mono text-[10px] text-slate-400">
            {product.reference}
            {product.barcode ? ` · ${product.barcode}` : ""}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-slate-900">{product.name}</p>
        </div>
        <div className="flex items-end justify-between gap-1 border-t border-slate-100 pt-1.5">
          <div className="min-w-0">
            {product.discountPercent > 0 ? (
              <p className="truncate font-mono text-[10px] text-slate-400 line-through">
                {formatUsd(product.officialPrice)} (−{product.discountPercent} %)
              </p>
            ) : null}
            <p className="font-mono text-xs font-bold tabular-nums text-slate-900">
              {product.isAuthorized ? formatUsd(product.finalPrice) : "Non autorisé"}
            </p>
          </div>
          <div className="shrink-0 text-right font-mono text-[10px] tabular-nums leading-tight">
            {!product.isAuthorized ? (
              <span className="font-semibold text-red-700">Bloqué</span>
            ) : product.stock <= 0 ? (
              <span className="font-semibold text-red-700">Rupture (0)</span>
            ) : (
              <span className="font-medium text-emerald-700">Stock : {product.stock}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function RecentSalesModal({
  sales,
  onClose,
  onReprint,
}: {
  sales: SaleListItem[];
  onClose: () => void;
  onReprint: (sale: SaleDetail) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-recent-sales-title"
        className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 id="pos-recent-sales-title" className="text-sm font-semibold text-slate-900">
            Mes 5 dernières ventes
          </h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800" aria-label="Fermer">
            ×
          </button>
        </div>
        <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
          {sales.length === 0 ? (
            <li className="px-4 py-8 text-center text-xs text-slate-500">Aucune vente sur cette session de caisse.</li>
          ) : (
            sales.map((sale) => (
              <li key={sale.id} className="flex items-center justify-between gap-2 px-4 py-3 text-xs">
                <div>
                  <p className="font-mono font-semibold text-slate-900">{sale.number}</p>
                  <p className="text-slate-500">
                    {new Date(sale.completedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                    {formatUsd(sale.total)}
                  </p>
                </div>
                <button
                  type="button"
                  className="font-medium text-slate-700 underline"
                  onClick={async () => {
                    const detail = await fetchSale(sale.id);
                    onReprint(detail);
                    onClose();
                  }}
                >
                  Ticket
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function QtyButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded border border-slate-200 px-1.5 py-0.5 text-xs hover:bg-slate-100"
    >
      {children}
    </button>
  );
}

function SearchIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BarcodeIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7v10M7 7v10M10 7v10M13 7v4M16 7v10M19 7v10M22 7v10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PrinterIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 8V4h10v4M7 16v4h10v-4M5 8h14a2 2 0 012 2v6H3v-6a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4h12v16l-2-1.5L14 20l-2-1.5L10 20l-2-1.5L6 20V4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function DailyReportIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden fill="currentColor">
      <path d="M6 2a1 1 0 0 0-1 1v1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1V3a1 1 0 1 0-2 0v1H7V3a1 1 0 0 0-1-1Zm8 5H6v8h8V7Z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12a8 8 0 101.5-6M4 4v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TruckInIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 16h11v-5H3v5zm11 0h2l3-3v-2h-5v5zM6 19a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zm9 0a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M14 11V8h4l2 2v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BagIcon({ className = "size-4 text-slate-700" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 8h12l-1 13H7L6 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 8V6a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 7h14M9 7V5h6v2M8 7l.8 12h6.4L16 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}