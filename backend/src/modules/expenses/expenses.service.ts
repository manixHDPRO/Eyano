import { HttpStatus, Injectable } from "@nestjs/common";
import {
  CashSessionStatus,
  CurrencyCode,
  DocumentSequenceCode,
  ExchangeRateType,
  ExpenseStatus,
  Prisma,
  ReferentialStatus,
  ScopeType,
} from "@prisma/client";
import { AccessService } from "../../common/access/access.service";
import { convertCdfToUsd, moneyString } from "../../common/money";
import { DocumentSequenceService } from "../../common/sequences/document-sequence.service";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { CreateExpenseDto } from "./dto/create-expense.dto";
import type { ListExpensesQueryDto } from "./dto/list-expenses.query.dto";
import { ExpenseNotificationsService } from "./expense-notifications.service";
import { ExpenseReceiptsService } from "./expense-receipts.service";
import {
  EXPENSE_AUDIT,
  EXPENSE_AUDIT_ENTITY,
  EXPENSE_CATEGORIES,
  EXPENSE_ERROR,
  type ExpenseCategoryCode,
} from "./expenses.constants";

const placeSelect = { id: true, code: true, name: true, city: true } as const;
const personSelect = { firstName: true, lastName: true } as const;

export type ExpenseLocationOption =
  | { scopeType: typeof ScopeType.WAREHOUSE; warehouse: { id: string; code: string; name: string } }
  | {
      scopeType: typeof ScopeType.STORE;
      store: { id: string; code: string; name: string; city: string | null };
      openSession: { id: string; cashRegisterId: string; cashRegisterCode: string } | null;
    };

export type ExpenseListItem = {
  id: string;
  reference: string;
  status: ExpenseStatus;
  category: ExpenseCategoryCode;
  amount: number;
  currency: CurrencyCode;
  amountUsdEquivalent: number;
  spentAt: string;
  description: string | null;
  receiptUrl: string | null;
  fromCashDrawer: boolean;
  scopeType: ScopeType;
  store: { id: string; code: string; name: string; city: string | null } | null;
  warehouse: { id: string; code: string; name: string } | null;
  cashRegister: { id: string; code: string; name: string } | null;
  createdByName: string;
  cashierConfirmedAt: string | null;
  cashierConfirmedByName: string | null;
  cashSessionId: string | null;
};

export type ExpenseDetail = ExpenseListItem & {
  createdAt: string;
  updatedAt: string;
};

export type ExpensesSummary = {
  todayCount: number;
  todayAmountUsd: number;
  monthAmountUsd: number;
  drawerTodayUsd: number;
  pendingCashierToday: number;
  decaissementRate: number | null;
};

export type DashboardTodayExpenses = {
  summary: {
    count: number;
    amountUsd: number;
    drawerUsd: number;
    pendingCashier: number;
  };
  items: ExpenseListItem[];
};

const registerSelect = { id: true, code: true, name: true, storeId: true } as const;

const expenseInclude = {
  store: { select: placeSelect },
  warehouse: { select: { id: true, code: true, name: true } },
  cashRegister: { select: registerSelect },
  createdBy: { select: personSelect },
  cashierConfirmedBy: { select: personSelect },
} satisfies Prisma.ExpenseInclude;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly sequences: DocumentSequenceService,
    private readonly audit: AuditLogsService,
    private readonly receipts: ExpenseReceiptsService,
    private readonly notifications: ExpenseNotificationsService,
  ) {}

  categories(): { items: Array<{ code: ExpenseCategoryCode; label: string }> } {
    return {
      items: [
        { code: "TRANSPORT", label: "Transport" },
        { code: "DELIVERY", label: "Livraison" },
        { code: "HANDLING", label: "Manutention" },
        { code: "ELECTRICITY", label: "Électricité" },
        { code: "MAINTENANCE", label: "Entretien" },
        { code: "OTHER", label: "Autres charges" },
      ],
    };
  }

  async locations(actor: AuthUser): Promise<{ items: ExpenseLocationOption[] }> {
    const context = await this.access.loadContext(actor.id);
    const items: ExpenseLocationOption[] = [];

    const openSessions = await this.prisma.cashSession.findMany({
      where: { status: CashSessionStatus.OPEN },
      include: {
        cashRegister: { select: { id: true, code: true, storeId: true } },
      },
    });
    const openSessionByStore = new Map(
      openSessions.map((session) => [
        session.cashRegister.storeId,
        {
          id: session.id,
          cashRegisterId: session.cashRegisterId,
          cashRegisterCode: session.cashRegister.code,
        },
      ]),
    );

    if (context.isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER") {
      const warehouses = await this.prisma.warehouse.findMany({
        where: { status: ReferentialStatus.ACTIVE },
        orderBy: [{ code: "asc" }],
        select: { id: true, code: true, name: true },
      });
      for (const warehouse of warehouses) {
        items.push({ scopeType: ScopeType.WAREHOUSE, warehouse });
      }
    }

    const storeIds = context.isGlobalScope
      ? (
          await this.prisma.store.findMany({
            where: { status: ReferentialStatus.ACTIVE },
            select: { id: true },
          })
        ).map((row) => row.id)
      : actor.stores.map((store) => store.id);

    if (storeIds.length) {
      const stores = await this.prisma.store.findMany({
        where: { id: { in: storeIds }, status: ReferentialStatus.ACTIVE },
        orderBy: [{ code: "asc" }],
        select: placeSelect,
      });
      for (const store of stores) {
        items.push({
          scopeType: ScopeType.STORE,
          store,
          openSession: openSessionByStore.get(store.id) ?? null,
        });
      }
    }

    return { items };
  }

  async todayForDashboard(actor: AuthUser): Promise<DashboardTodayExpenses> {
    const decRate = await this.loadDecaissementRate();
    const since = startOfToday();
    const baseWhere = await this.buildScopeFilter(actor, {});
    const todayWhere: Prisma.ExpenseWhereInput = {
      ...baseWhere,
      spentAt: { gte: since },
      status: { not: ExpenseStatus.CANCELLED },
    };
    const drawerTodayWhere: Prisma.ExpenseWhereInput = {
      ...todayWhere,
      status: ExpenseStatus.CONFIRMED,
      cashSessionId: { not: null },
    };
    const pendingTodayWhere: Prisma.ExpenseWhereInput = {
      ...todayWhere,
      status: ExpenseStatus.PENDING_CASHIER_CONFIRMATION,
    };

    const [todayRows, drawerRows, pendingToday, listRows] = await Promise.all([
      this.prisma.expense.findMany({ where: todayWhere, select: { amount: true, currency: true } }),
      this.prisma.expense.findMany({ where: drawerTodayWhere, select: { amount: true, currency: true } }),
      this.prisma.expense.count({ where: pendingTodayWhere }),
      this.prisma.expense.findMany({
        where: todayWhere,
        orderBy: [{ spentAt: "desc" }],
        take: 24,
        include: expenseInclude,
      }),
    ]);

    return {
      summary: {
        count: todayRows.length,
        amountUsd: Number(sumUsdEquivalent(todayRows, decRate).toFixed(2)),
        drawerUsd: Number(sumUsdEquivalent(drawerRows, decRate).toFixed(2)),
        pendingCashier: pendingToday,
      },
      items: listRows.map((row) => toListItem(row, decRate)),
    };
  }

  async summary(actor: AuthUser, storeId?: string): Promise<ExpensesSummary> {
    const decRate = await this.loadDecaissementRate();
    const since = startOfToday();
    const monthStart = startOfMonth();

    const baseWhere = await this.buildScopeFilter(actor, { storeId });
    const todayWhere: Prisma.ExpenseWhereInput = {
      ...baseWhere,
      spentAt: { gte: since },
    };
    const monthWhere: Prisma.ExpenseWhereInput = {
      ...baseWhere,
      spentAt: { gte: monthStart },
    };
    const drawerTodayWhere: Prisma.ExpenseWhereInput = {
      ...todayWhere,
      status: ExpenseStatus.CONFIRMED,
      cashSessionId: { not: null },
    };
    const pendingTodayWhere: Prisma.ExpenseWhereInput = {
      ...todayWhere,
      status: ExpenseStatus.PENDING_CASHIER_CONFIRMATION,
    };

    const [todayRows, monthRows, drawerRows, pendingToday] = await Promise.all([
      this.prisma.expense.findMany({ where: todayWhere, select: { amount: true, currency: true } }),
      this.prisma.expense.findMany({ where: monthWhere, select: { amount: true, currency: true } }),
      this.prisma.expense.findMany({ where: drawerTodayWhere, select: { amount: true, currency: true } }),
      this.prisma.expense.count({ where: pendingTodayWhere }),
    ]);

    return {
      todayCount: todayRows.length,
      todayAmountUsd: sumUsdEquivalent(todayRows, decRate),
      monthAmountUsd: sumUsdEquivalent(monthRows, decRate),
      drawerTodayUsd: sumUsdEquivalent(drawerRows, decRate),
      pendingCashierToday: pendingToday,
      decaissementRate: decRate,
    };
  }

  async listPendingCashierConfirmation(
    actor: AuthUser,
    storeId: string,
    cashRegisterId?: string,
  ): Promise<{ items: ExpenseListItem[] }> {
    this.assertStoreMembership(actor, storeId);
    const where: Prisma.ExpenseWhereInput = {
      storeId,
      status: ExpenseStatus.PENDING_CASHIER_CONFIRMATION,
    };
    if (cashRegisterId) {
      where.cashRegisterId = cashRegisterId;
    }

    const decRate = await this.loadDecaissementRate();
    const rows = await this.prisma.expense.findMany({
      where,
      orderBy: [{ createdAt: "asc" }],
      take: 50,
      include: expenseInclude,
    });
    return { items: rows.map((row) => toListItem(row, decRate)) };
  }

  async confirmCashier(actor: AuthUser, id: string, meta: RequestMeta): Promise<ExpenseDetail> {
    const context = await this.access.loadContext(actor.id);
    if (!this.access.hasPermission(context, "cash.session")) {
      throw forbiddenConfirm();
    }

    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { cashRegister: { select: registerSelect } },
    });
    if (!expense) {
      throw notFound();
    }
    if (expense.status !== ExpenseStatus.PENDING_CASHIER_CONFIRMATION) {
      throw invalidStatus("Seule une dépense en attente peut être confirmée par la caisse.");
    }
    if (!expense.storeId || !expense.cashRegisterId) {
      throw invalidStatus("Dépense invalide pour confirmation caisse.");
    }
    this.assertStoreMembership(actor, expense.storeId);

    const openSession = await this.prisma.cashSession.findFirst({
      where: {
        cashRegisterId: expense.cashRegisterId,
        status: CashSessionStatus.OPEN,
      },
      select: { id: true },
    });
    if (!openSession) {
      throw sessionNotOpen();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.CONFIRMED,
          cashSessionId: openSession.id,
          cashierConfirmedAt: new Date(),
          cashierConfirmedById: actor.id,
        },
      });
      await tx.notification.updateMany({
        where: {
          entityType: "Expense",
          entityId: id,
          storeId: expense.storeId,
          readAt: null,
        },
        data: { readAt: new Date(), readById: actor.id },
      });
      await this.audit.write(
        {
          actorId: actor.id,
          action: EXPENSE_AUDIT.CASHIER_CONFIRMED,
          entityType: EXPENSE_AUDIT_ENTITY,
          entityId: id,
          storeId: expense.storeId,
          newValue: { cashSessionId: openSession.id, reference: expense.reference },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.findOne(actor, id);
  }

  async list(actor: AuthUser, query: ListExpensesQueryDto) {
    const decRate = await this.loadDecaissementRate();
    const where = await this.buildWhere(actor, query);
    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ spentAt: "desc" }],
        include: expenseInclude,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      items: rows.map((row) => toListItem(row, decRate)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(actor: AuthUser, id: string): Promise<ExpenseDetail> {
    const decRate = await this.loadDecaissementRate();
    const row = await this.prisma.expense.findUnique({
      where: { id },
      include: expenseInclude,
    });
    if (!row) {
      throw notFound();
    }
    await this.assertCanAccess(actor, row.storeId, row.warehouseId);
    return {
      ...toListItem(row, decRate),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(actor: AuthUser, dto: CreateExpenseDto, meta: RequestMeta): Promise<ExpenseDetail> {
    if (actor.role.code === "CASHIER") {
      throw createForbidden();
    }
    if (!EXPENSE_CATEGORIES.includes(dto.category)) {
      throw categoryInvalid();
    }
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw amountInvalid();
    }

    const storeId = dto.scopeType === ScopeType.STORE ? dto.storeId! : null;
    const warehouseId = dto.scopeType === ScopeType.WAREHOUSE ? dto.warehouseId! : null;
    if (!storeId && !warehouseId) {
      throw locationRequired();
    }

    await this.assertCanAccess(actor, storeId, warehouseId);
    await this.assertLocationActive(storeId, warehouseId);

    const drawer = Boolean(dto.fromCashDrawer);
    let status: ExpenseStatus = ExpenseStatus.CONFIRMED;
    let cashSessionId: string | null = null;
    let cashRegisterId: string | null = null;
    let registerLabel: string | null = null;

    if (drawer) {
      if (!storeId) {
        throw drawerRequiresStore();
      }
      if (!dto.cashRegisterId) {
        throw registerRequired();
      }
      const register = await this.prisma.cashRegister.findFirst({
        where: { id: dto.cashRegisterId, storeId, status: ReferentialStatus.ACTIVE },
        select: registerSelect,
      });
      if (!register) {
        throw registerStoreMismatch();
      }
      cashRegisterId = register.id;
      registerLabel = `${register.code} — ${register.name}`;
      status = ExpenseStatus.PENDING_CASHIER_CONFIRMATION;
    }

    const spentAt = dto.spentAt ? new Date(dto.spentAt) : new Date();
    if (Number.isNaN(spentAt.getTime())) {
      throw amountInvalid();
    }

    const amountFormatted = moneyString(dto.amount, dto.currency === CurrencyCode.CDF ? 0 : 2);
    const createdByName = `${actor.firstName} ${actor.lastName}`.trim();

    const createdId = await this.prisma.$transaction(async (tx) => {
      const reference = await this.sequences.nextReference(DocumentSequenceCode.EXPENSE, tx);
      const expense = await tx.expense.create({
        data: {
          reference,
          status,
          category: dto.category,
          amount: amountFormatted,
          currency: dto.currency,
          storeId,
          warehouseId,
          cashRegisterId,
          cashSessionId,
          spentAt,
          createdById: actor.id,
          description: trimNullable(dto.description),
        },
      });

      await this.audit.write(
        {
          actorId: actor.id,
          action: EXPENSE_AUDIT.CREATED,
          entityType: EXPENSE_AUDIT_ENTITY,
          entityId: expense.id,
          storeId,
          newValue: {
            reference,
            amount: amountFormatted,
            currency: dto.currency,
            category: dto.category,
            fromCashDrawer: drawer,
            status,
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );

      if (status === ExpenseStatus.PENDING_CASHIER_CONFIRMATION && storeId && registerLabel) {
        const amountLabel =
          dto.currency === CurrencyCode.CDF ? `${amountFormatted} CDF` : `${amountFormatted} USD`;
        await this.notifications.notifyDrawerPending(tx, {
          expenseId: expense.id,
          reference,
          storeId,
          registerLabel,
          amountLabel,
          createdByName,
        });
      }

      return expense.id;
    });

    return this.findOne(actor, createdId);
  }

  async attachReceipt(actor: AuthUser, id: string, file: Express.Multer.File, meta: RequestMeta): Promise<ExpenseDetail> {
    const row = await this.prisma.expense.findUnique({ where: { id } });
    if (!row) {
      throw notFound();
    }
    await this.assertCanAccess(actor, row.storeId, row.warehouseId);

    const relative = await this.receipts.store(id, file, row.receiptPath);
    await this.prisma.expense.update({
      where: { id },
      data: { receiptPath: relative },
    });

    await this.audit.write({
      actorId: actor.id,
      action: EXPENSE_AUDIT.RECEIPT_UPDATED,
      entityType: EXPENSE_AUDIT_ENTITY,
      entityId: id,
      storeId: row.storeId,
      newValue: { receiptPath: relative },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.findOne(actor, id);
  }

  private assertStoreMembership(actor: AuthUser, storeId: string): void {
    const context = {
      roleCode: actor.role.code,
      permissions: actor.permissions,
      storeIds: actor.stores.map((store) => store.id),
      stores: actor.stores,
      isGlobalScope: this.access.isGlobalRole(actor.role.code),
    };
    if (!this.access.canAccessStore(context, storeId)) {
      throw forbiddenLocation();
    }
  }

  private async buildWhere(actor: AuthUser, query: ListExpensesQueryDto): Promise<Prisma.ExpenseWhereInput> {
    const scope = await this.buildScopeFilter(actor, {
      storeId: query.storeId,
      warehouseId: query.warehouseId,
      scopeType: query.scopeType,
    });

    const where: Prisma.ExpenseWhereInput = { ...scope };

    if (query.currency) {
      where.currency = query.currency;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.fromCashDrawer === true) {
      where.OR = [
        { cashSessionId: { not: null } },
        { status: ExpenseStatus.PENDING_CASHIER_CONFIRMATION, cashRegisterId: { not: null } },
      ];
    } else if (query.fromCashDrawer === false) {
      where.AND = [{ cashSessionId: null }, { status: { not: ExpenseStatus.PENDING_CASHIER_CONFIRMATION } }];
    }

    const spentFrom = query.spentFrom ? new Date(query.spentFrom) : null;
    const spentTo = query.spentTo ? new Date(query.spentTo) : null;
    if (spentFrom || spentTo) {
      where.spentAt = {};
      if (spentFrom && !Number.isNaN(spentFrom.getTime())) {
        where.spentAt.gte = spentFrom;
      }
      if (spentTo && !Number.isNaN(spentTo.getTime())) {
        where.spentAt.lte = spentTo;
      }
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
        { store: { name: { contains: search, mode: "insensitive" } } },
        { warehouse: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    return where;
  }

  private async buildScopeFilter(
    actor: AuthUser,
    filter: { storeId?: string; warehouseId?: string; scopeType?: ScopeType },
  ): Promise<Prisma.ExpenseWhereInput> {
    const context = await this.access.loadContext(actor.id);

    if (filter.storeId) {
      if (!this.access.canAccessStore(context, filter.storeId)) {
        return { id: { in: [] } };
      }
      return { storeId: filter.storeId };
    }

    if (filter.warehouseId) {
      if (!context.isGlobalScope && actor.role.code !== "WAREHOUSE_MANAGER") {
        return { id: { in: [] } };
      }
      return { warehouseId: filter.warehouseId };
    }

    if (filter.scopeType === ScopeType.STORE) {
      if (context.isGlobalScope) {
        return { storeId: { not: null } };
      }
      const ids = actor.stores.map((store) => store.id);
      if (!ids.length) {
        return { id: { in: [] } };
      }
      return { storeId: { in: ids } };
    }

    if (filter.scopeType === ScopeType.WAREHOUSE) {
      if (context.isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER") {
        return { warehouseId: { not: null } };
      }
      return { id: { in: [] } };
    }

    if (context.isGlobalScope) {
      return {};
    }

    const storeIds = actor.stores.map((store) => store.id);
    const clauses: Prisma.ExpenseWhereInput[] = [];
    if (storeIds.length) {
      clauses.push({ storeId: { in: storeIds } });
    }
    if (actor.role.code === "WAREHOUSE_MANAGER") {
      clauses.push({ warehouseId: { not: null } });
    }
    if (!clauses.length) {
      return { id: { in: [] } };
    }
    return { OR: clauses };
  }

  private async assertCanAccess(actor: AuthUser, storeId: string | null, warehouseId: string | null): Promise<void> {
    const context = await this.access.loadContext(actor.id);
    if (storeId) {
      if (!this.access.canAccessStore(context, storeId)) {
        throw forbiddenLocation();
      }
      return;
    }
    if (warehouseId) {
      if (context.isGlobalScope || actor.role.code === "WAREHOUSE_MANAGER") {
        return;
      }
      throw forbiddenLocation();
    }
    throw locationRequired();
  }

  private async assertLocationActive(storeId: string | null, warehouseId: string | null): Promise<void> {
    if (storeId) {
      const store = await this.prisma.store.findUnique({ where: { id: storeId } });
      if (!store || store.status !== ReferentialStatus.ACTIVE) {
        throw storeInactive();
      }
      return;
    }
    if (warehouseId) {
      const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
      if (!warehouse || warehouse.status !== ReferentialStatus.ACTIVE) {
        throw warehouseInactive();
      }
    }
  }

  private async loadDecaissementRate(): Promise<number | null> {
    const row = await this.prisma.exchangeRate.findFirst({
      where: { rateType: ExchangeRateType.DECAISSEMENT, validTo: null },
      select: { rate: true },
    });
    return row ? Number(row.rate) : null;
  }
}

function toListItem(
  row: Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>,
  decaissementRate: number | null,
): ExpenseListItem {
  const amount = Number(row.amount);
  const amountUsdEquivalent = toUsdEquivalent(amount, row.currency, decaissementRate);
  const drawerIntent =
    Boolean(row.cashSessionId) ||
    row.status === ExpenseStatus.PENDING_CASHIER_CONFIRMATION;
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    category: row.category as ExpenseCategoryCode,
    amount,
    currency: row.currency,
    amountUsdEquivalent,
    spentAt: row.spentAt.toISOString(),
    description: row.description,
    receiptUrl: row.receiptPath ? `/uploads/${row.receiptPath.replace(/^\/+/, "")}` : null,
    fromCashDrawer: drawerIntent,
    scopeType: row.storeId ? ScopeType.STORE : ScopeType.WAREHOUSE,
    store: row.store,
    warehouse: row.warehouse,
    cashRegister: row.cashRegister
      ? { id: row.cashRegister.id, code: row.cashRegister.code, name: row.cashRegister.name }
      : null,
    createdByName: `${row.createdBy.firstName} ${row.createdBy.lastName}`.trim(),
    cashierConfirmedAt: row.cashierConfirmedAt?.toISOString() ?? null,
    cashierConfirmedByName: row.cashierConfirmedBy
      ? `${row.cashierConfirmedBy.firstName} ${row.cashierConfirmedBy.lastName}`.trim()
      : null,
    cashSessionId: row.cashSessionId,
  };
}

function toUsdEquivalent(amount: number, currency: CurrencyCode, decaissementRate: number | null): number {
  if (currency === CurrencyCode.USD) {
    return amount;
  }
  if (!decaissementRate || decaissementRate <= 0) {
    return 0;
  }
  return Number(convertCdfToUsd(amount, decaissementRate));
}

function sumUsdEquivalent(rows: Array<{ amount: Prisma.Decimal; currency: CurrencyCode }>, decRate: number | null): number {
  return rows.reduce((acc, row) => acc + toUsdEquivalent(Number(row.amount), row.currency, decRate), 0);
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(): Date {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function trimNullable(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function notFound(): ApiException {
  return new ApiException(EXPENSE_ERROR.NOT_FOUND, "Dépense introuvable.", HttpStatus.NOT_FOUND);
}

function forbiddenLocation(): ApiException {
  return new ApiException(EXPENSE_ERROR.FORBIDDEN_LOCATION, "Site hors de votre périmètre.", HttpStatus.FORBIDDEN);
}

function locationRequired(): ApiException {
  return new ApiException(EXPENSE_ERROR.LOCATION_REQUIRED, "Boutique ou entrepôt requis.", HttpStatus.BAD_REQUEST);
}

function storeInactive(): ApiException {
  return new ApiException(EXPENSE_ERROR.STORE_INACTIVE, "Boutique inactive ou introuvable.", HttpStatus.BAD_REQUEST);
}

function warehouseInactive(): ApiException {
  return new ApiException(
    EXPENSE_ERROR.WAREHOUSE_INACTIVE,
    "Entrepôt inactive ou introuvable.",
    HttpStatus.BAD_REQUEST,
  );
}

function amountInvalid(): ApiException {
  return new ApiException(EXPENSE_ERROR.AMOUNT_INVALID, "Montant invalide.", HttpStatus.BAD_REQUEST);
}

function categoryInvalid(): ApiException {
  return new ApiException(EXPENSE_ERROR.CATEGORY_INVALID, "Catégorie invalide.", HttpStatus.BAD_REQUEST);
}

function sessionNotOpen(): ApiException {
  return new ApiException(
    EXPENSE_ERROR.SESSION_NOT_OPEN,
    "Aucune session ouverte sur ce site pour prélever le tiroir.",
    HttpStatus.CONFLICT,
  );
}

function sessionStoreMismatch(): ApiException {
  return new ApiException(
    EXPENSE_ERROR.SESSION_STORE_MISMATCH,
    "La session ne correspond pas à la boutique.",
    HttpStatus.BAD_REQUEST,
  );
}

function drawerRequiresStore(): ApiException {
  return new ApiException(
    EXPENSE_ERROR.DRAWER_REQUIRES_STORE,
    "Seule une dépense boutique peut être prélevée sur le tiroir.",
    HttpStatus.BAD_REQUEST,
  );
}

function registerRequired(): ApiException {
  return new ApiException(
    EXPENSE_ERROR.REGISTER_REQUIRED,
    "Sélectionnez la caisse concernée par cette sortie d’espèces.",
    HttpStatus.BAD_REQUEST,
  );
}

function registerStoreMismatch(): ApiException {
  return new ApiException(
    EXPENSE_ERROR.REGISTER_STORE_MISMATCH,
    "Cette caisse n’appartient pas à la boutique sélectionnée.",
    HttpStatus.BAD_REQUEST,
  );
}

function invalidStatus(message: string): ApiException {
  return new ApiException(EXPENSE_ERROR.INVALID_STATUS, message, HttpStatus.CONFLICT);
}

function forbiddenConfirm(): ApiException {
  return new ApiException(
    EXPENSE_ERROR.FORBIDDEN_CONFIRM,
    "Droits insuffisants pour confirmer une sortie de caisse.",
    HttpStatus.FORBIDDEN,
  );
}

function createForbidden(): ApiException {
  return new ApiException(
    EXPENSE_ERROR.CREATE_FORBIDDEN,
    "La saisie des dépenses est réservée à l’administration ou à la comptabilité.",
    HttpStatus.FORBIDDEN,
  );
}