import { HttpStatus, Injectable } from "@nestjs/common";
import {
  DocumentSequenceCode,
  InternalIssueReason,
  InternalIssueStatus,
  Prisma,
  ProductStatus,
  ReferentialStatus,
  ScopeType,
  type InternalStockIssue,
} from "@prisma/client";
import { AccessService } from "../../common/access/access.service";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import { DocumentSequenceService } from "../../common/sequences/document-sequence.service";
import type { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { StockMovementsService } from "../stock-movements/stock-movements.service";
import type { CancelInternalIssueDto } from "./dto/cancel-internal-issue.dto";
import type { CreateInternalIssueDto } from "./dto/create-internal-issue.dto";
import type { InternalIssueCatalogQueryDto } from "./dto/internal-issue-catalog.query.dto";
import type { ListInternalIssuesQueryDto } from "./dto/list-internal-issues.query.dto";
import type { RejectInternalIssueDto } from "./dto/reject-internal-issue.dto";
import type { ReviewInternalIssueDto } from "./dto/review-internal-issue.dto";
import type { UpdateInternalIssueDto } from "./dto/update-internal-issue.dto";
import { InternalIssueNotificationsService } from "./internal-issue-notifications.service";
import {
  CANCELABLE_INTERNAL_ISSUE_STATUSES,
  INTERNAL_ISSUE_AUDIT,
  INTERNAL_ISSUE_AUDIT_ENTITY,
  INTERNAL_ISSUE_ERROR,
  SETTING_INTERNAL_ISSUE_REQUIRES_APPROVAL,
  SETTING_INTERNAL_ISSUE_REQUIRES_STORE_CONFIRMATION,
} from "./internal-issues.constants";

type PrismaTx = Prisma.TransactionClient;

const personSelect = { id: true, firstName: true, lastName: true } as const;
const placeSelect = { id: true, code: true, name: true } as const;

export type InternalIssueLocationOption =
  | { scopeType: typeof ScopeType.WAREHOUSE; warehouse: { id: string; code: string; name: string } }
  | { scopeType: typeof ScopeType.STORE; store: { id: string; code: string; name: string; city: string | null } };

export type InternalIssueCatalogItem = {
  productId: string;
  reference: string;
  name: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
};

export type InternalIssueListItem = {
  id: string;
  reference: string;
  status: InternalIssueStatus;
  scopeType: ScopeType;
  warehouse: { id: string; code: string; name: string } | null;
  store: { id: string; code: string; name: string } | null;
  productReference: string;
  productName: string;
  quantity: number;
  reasonCode: InternalIssueReason;
  reasonText: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: { id: string; firstName: string; lastName: string } | null;
  storeConfirmedAt: string | null;
  storeConfirmedBy: { id: string; firstName: string; lastName: string } | null;
};

export type InternalIssueDetail = InternalIssueListItem & {
  productId: string;
  reasonText: string | null;
  reviewNote: string | null;
  requestedBy: { id: string; firstName: string; lastName: string };
  reviewedBy: { id: string; firstName: string; lastName: string } | null;
  updatedAt: string;
};

@Injectable()
export class InternalIssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditLogsService,
    private readonly sequences: DocumentSequenceService,
    private readonly stockMovements: StockMovementsService,
    private readonly notifications: InternalIssueNotificationsService,
  ) {}

  async summary(actor: AuthUser) {
    const scope = await this.buildScope(actor, {});
    const grouped = await this.prisma.internalStockIssue.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    });
    const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all])) as Record<
      InternalIssueStatus,
      number
    >;
    return {
      draft: counts.DRAFT ?? 0,
      pending: counts.PENDING ?? 0,
      approved: counts.APPROVED ?? 0,
      rejected: counts.REJECTED ?? 0,
      cancelled: counts.CANCELLED ?? 0,
      open: (counts.DRAFT ?? 0) + (counts.PENDING ?? 0),
      toValidate: counts.PENDING ?? 0,
    };
  }

  async locations(actor: AuthUser): Promise<{ items: InternalIssueLocationOption[] }> {
    const context = await this.access.loadContext(actor.id);
    const items: InternalIssueLocationOption[] = [];

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

    if (context.isGlobalScope) {
      const stores = await this.prisma.store.findMany({
        where: { status: ReferentialStatus.ACTIVE },
        orderBy: [{ code: "asc" }],
        select: { id: true, code: true, name: true, city: true },
      });
      for (const store of stores) {
        items.push({ scopeType: ScopeType.STORE, store });
      }
    } else if (actor.role.code !== "WAREHOUSE_MANAGER") {
      const storeIds = actor.stores.map((store) => store.id);
      if (storeIds.length) {
        const stores = await this.prisma.store.findMany({
          where: { id: { in: storeIds }, status: ReferentialStatus.ACTIVE },
          orderBy: [{ code: "asc" }],
          select: { id: true, code: true, name: true, city: true },
        });
        for (const store of stores) {
          items.push({ scopeType: ScopeType.STORE, store });
        }
      }
    }

    return { items };
  }

  async catalog(actor: AuthUser, query: InternalIssueCatalogQueryDto): Promise<{ items: InternalIssueCatalogItem[] }> {
    const search = query.search?.trim() ?? "";
    const productTextFilter =
      search.length >= 2
        ? {
            OR: [
              { reference: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {};
    if (query.scopeType === ScopeType.WAREHOUSE) {
      await this.assertCanRequest(actor, query.scopeType, query.warehouseId ?? null, null);
      const rows = await this.prisma.stockLevel.findMany({
        where: {
          warehouseId: query.warehouseId,
          storeId: null,
          quantityOnHand: { gt: 0 },
          product: {
            status: ProductStatus.ACTIVE,
            ...productTextFilter,
          },
        },
        take: query.pageSize,
        orderBy: { product: { name: "asc" } },
        include: {
          product: { select: { id: true, reference: true, name: true } },
        },
      });
      return {
        items: rows.map((row) => ({
          productId: row.product.id,
          reference: row.product.reference,
          name: row.product.name,
          quantityOnHand: row.quantityOnHand,
          quantityReserved: row.quantityReserved,
          quantityAvailable: row.quantityOnHand - row.quantityReserved,
        })),
      };
    }

    await this.assertCanRequest(actor, query.scopeType, null, query.storeId ?? null);
    const rows = await this.prisma.productStore.findMany({
      where: {
        storeId: query.storeId!,
        isAuthorized: true,
        product: {
          status: ProductStatus.ACTIVE,
          ...productTextFilter,
        },
      },
      take: query.pageSize,
      orderBy: { product: { name: "asc" } },
      include: {
        product: {
          select: {
            id: true,
            reference: true,
            name: true,
            stockLevels: {
              where: { storeId: query.storeId, warehouseId: null },
              select: { quantityOnHand: true, quantityReserved: true },
            },
          },
        },
      },
    });

    return {
      items: rows
        .map((row) => {
          const level = row.product.stockLevels[0];
          const onHand = level?.quantityOnHand ?? 0;
          const reserved = level?.quantityReserved ?? 0;
          return {
            productId: row.product.id,
            reference: row.product.reference,
            name: row.product.name,
            quantityOnHand: onHand,
            quantityReserved: reserved,
            quantityAvailable: onHand - reserved,
          };
        })
        .filter((row) => row.quantityOnHand > 0),
    };
  }

  async list(actor: AuthUser, query: ListInternalIssuesQueryDto) {
    const scope = await this.buildScope(actor, query);
    const where: Prisma.InternalStockIssueWhereInput = { ...scope };
    if (query.status) {
      where.status = query.status;
    }
    if (query.scopeType) {
      where.scopeType = query.scopeType;
    }
    if (query.storeId) {
      where.storeId = query.storeId;
    }
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query.reasonCode) {
      where.reasonCode = query.reasonCode;
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: "insensitive" } },
        { product: { reference: { contains: search, mode: "insensitive" } } },
        { product: { name: { contains: search, mode: "insensitive" } } },
        { store: { name: { contains: search, mode: "insensitive" } } },
        { warehouse: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.internalStockIssue.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }],
        include: {
          warehouse: { select: placeSelect },
          store: { select: placeSelect },
          product: { select: { id: true, reference: true, name: true } },
          reviewedBy: { select: personSelect },
          storeConfirmedBy: { select: personSelect },
        },
      }),
      this.prisma.internalStockIssue.count({ where }),
    ]);

    return {
      items: rows.map(toListItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(actor: AuthUser, id: string): Promise<InternalIssueDetail> {
    const detail = await this.loadDetail(id);
    if (!detail) {
      throw notFound();
    }
    await this.assertCanView(actor, detail);
    return detail;
  }

  async create(actor: AuthUser, dto: CreateInternalIssueDto, meta: RequestMeta): Promise<InternalIssueDetail> {
    await this.assertCanRequest(actor, dto.scopeType, dto.warehouseId ?? null, dto.storeId ?? null);
    await this.assertLocationActive(dto.scopeType, dto.warehouseId, dto.storeId);
    await this.assertProductEligible(
      dto.scopeType,
      dto.productId,
      dto.warehouseId ?? null,
      dto.storeId ?? null,
    );
    assertReasonText(dto.reasonCode, dto.reasonText);

    const createdId = await this.prisma.$transaction(async (tx) => {
      const reference = await this.sequences.nextReference(DocumentSequenceCode.INTERNAL_ISSUE, tx);
      const issue = await tx.internalStockIssue.create({
        data: {
          reference,
          scopeType: dto.scopeType,
          warehouseId: dto.scopeType === ScopeType.WAREHOUSE ? dto.warehouseId! : null,
          storeId: dto.scopeType === ScopeType.STORE ? dto.storeId! : null,
          productId: dto.productId,
          quantity: dto.quantity,
          reasonCode: dto.reasonCode,
          reasonText: trimNullable(dto.reasonText),
          status: InternalIssueStatus.DRAFT,
          requestedById: actor.id,
        },
      });
      await this.audit.write(
        {
          actorId: actor.id,
          action: INTERNAL_ISSUE_AUDIT.CREATED,
          entityType: INTERNAL_ISSUE_AUDIT_ENTITY.ISSUE,
          entityId: issue.id,
          storeId: issue.storeId,
          newValue: {
            reference,
            quantity: dto.quantity,
            reasonCode: dto.reasonCode,
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
      return issue.id;
    });

    return this.findOne(actor, createdId);
  }

  async update(actor: AuthUser, id: string, dto: UpdateInternalIssueDto, meta: RequestMeta): Promise<InternalIssueDetail> {
    const issue = await this.requireIssue(id);
    const detail = await this.mustDetail(issue);
    await this.assertCanView(actor, detail);
    if (issue.status !== InternalIssueStatus.DRAFT) {
      throw invalidStatus("Seule une demande en brouillon peut être modifiée.");
    }
    if (dto.reasonCode !== undefined || dto.reasonText !== undefined) {
      const code = dto.reasonCode ?? issue.reasonCode;
      const text = dto.reasonText === undefined ? issue.reasonText : trimNullable(dto.reasonText);
      assertReasonText(code, text ?? undefined);
    }
    if (dto.quantity !== undefined && dto.quantity < 1) {
      throw quantityInvalid();
    }

    await this.prisma.internalStockIssue.update({
      where: { id },
      data: {
        quantity: dto.quantity,
        reasonCode: dto.reasonCode,
        reasonText: dto.reasonText === undefined ? undefined : trimNullable(dto.reasonText),
      },
    });
    await this.audit.write({
      actorId: actor.id,
      action: INTERNAL_ISSUE_AUDIT.UPDATED,
      entityType: INTERNAL_ISSUE_AUDIT_ENTITY.ISSUE,
      entityId: id,
      storeId: issue.storeId,
      newValue: dto,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.findOne(actor, id);
  }

  async submit(actor: AuthUser, id: string, meta: RequestMeta): Promise<InternalIssueDetail> {
    const issue = await this.requireIssue(id);
    const detail = await this.mustDetail(issue);
    await this.assertCanRequest(actor, issue.scopeType, issue.warehouseId, issue.storeId);
    await this.assertCanView(actor, detail);
    if (issue.status !== InternalIssueStatus.DRAFT) {
      throw invalidStatus("Seul un brouillon peut être soumis.");
    }

    const requiresApproval = await this.loadRequiresApproval();
    const nextStatus = requiresApproval ? InternalIssueStatus.PENDING : InternalIssueStatus.APPROVED;

    await this.prisma.$transaction(async (tx) => {
      await tx.internalStockIssue.update({
        where: { id },
        data: { status: nextStatus },
      });
      if (nextStatus === InternalIssueStatus.PENDING) {
        await this.notifications.notifyPending(tx, {
          issueId: id,
          reference: issue.reference,
          locationLabel: locationLabelFromIssue(issue),
          productLabel: `${detail.productReference} — ${detail.productName}`,
          quantity: issue.quantity,
          storeId: issue.storeId,
        });
      } else {
        await this.approveStock(tx, issue, actor.id, null);
        await tx.internalStockIssue.update({
          where: { id },
          data: {
            reviewedById: actor.id,
            reviewedAt: new Date(),
          },
        });
      }
      await this.audit.write(
        {
          actorId: actor.id,
          action: INTERNAL_ISSUE_AUDIT.SUBMITTED,
          entityType: INTERNAL_ISSUE_AUDIT_ENTITY.ISSUE,
          entityId: id,
          storeId: issue.storeId,
          newValue: { status: nextStatus },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
      if (nextStatus === InternalIssueStatus.APPROVED) {
        await this.audit.write(
          {
            actorId: actor.id,
            action: INTERNAL_ISSUE_AUDIT.APPROVED,
            entityType: INTERNAL_ISSUE_AUDIT_ENTITY.ISSUE,
            entityId: id,
            storeId: issue.storeId,
            newValue: { autoApproved: true },
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
          tx,
        );
      }
    });

    return this.findOne(actor, id);
  }

  async approve(
    actor: AuthUser,
    id: string,
    dto: ReviewInternalIssueDto,
    meta: RequestMeta,
  ): Promise<InternalIssueDetail> {
    const context = await this.access.loadContext(actor.id);
    if (!this.access.hasPermission(context, "internal_issues.validate")) {
      throw forbiddenScope();
    }
    const issue = await this.requireIssue(id);
    const detail = await this.mustDetail(issue);
    await this.assertCanView(actor, detail);
    if (issue.status !== InternalIssueStatus.PENDING) {
      throw invalidStatus("Seule une demande en attente peut être approuvée.");
    }
    if (await this.requiresStoreConfirmation(issue)) {
      throw new ApiException(
        INTERNAL_ISSUE_ERROR.STORE_CONFIRM_REQUIRED,
        "La boutique doit confirmer la demande en caisse avant validation centrale.",
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.approveStock(tx, issue, actor.id, dto.reviewNote?.trim() || null);
      await tx.internalStockIssue.update({
        where: { id },
        data: {
          status: InternalIssueStatus.APPROVED,
          reviewedById: actor.id,
          reviewedAt: new Date(),
          reviewNote: dto.reviewNote?.trim() || null,
        },
      });
      await this.audit.write(
        {
          actorId: actor.id,
          action: INTERNAL_ISSUE_AUDIT.APPROVED,
          entityType: INTERNAL_ISSUE_AUDIT_ENTITY.ISSUE,
          entityId: id,
          storeId: issue.storeId,
          newValue: { reviewNote: dto.reviewNote ?? null },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.findOne(actor, id);
  }

  async reject(actor: AuthUser, id: string, dto: RejectInternalIssueDto, meta: RequestMeta): Promise<InternalIssueDetail> {
    const context = await this.access.loadContext(actor.id);
    if (!this.access.hasPermission(context, "internal_issues.validate")) {
      throw forbiddenScope();
    }
    const issue = await this.requireIssue(id);
    const detail = await this.mustDetail(issue);
    await this.assertCanView(actor, detail);
    if (issue.status !== InternalIssueStatus.PENDING) {
      throw invalidStatus("Seule une demande en attente peut être rejetée.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.internalStockIssue.update({
        where: { id },
        data: {
          status: InternalIssueStatus.REJECTED,
          reviewedById: actor.id,
          reviewedAt: new Date(),
          reviewNote: dto.reviewNote.trim(),
        },
      });
      await this.audit.write(
        {
          actorId: actor.id,
          action: INTERNAL_ISSUE_AUDIT.REJECTED,
          entityType: INTERNAL_ISSUE_AUDIT_ENTITY.ISSUE,
          entityId: id,
          storeId: issue.storeId,
          newValue: { reviewNote: dto.reviewNote },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.findOne(actor, id);
  }

  async cancel(actor: AuthUser, id: string, dto: CancelInternalIssueDto, meta: RequestMeta): Promise<InternalIssueDetail> {
    const issue = await this.requireIssue(id);
    const detail = await this.mustDetail(issue);
    await this.assertCanView(actor, detail);
    if (!CANCELABLE_INTERNAL_ISSUE_STATUSES.includes(issue.status)) {
      throw invalidStatus("Cette demande ne peut plus être annulée.");
    }
    const isValidatorOnly =
      !this.access.hasPermission(await this.access.loadContext(actor.id), "internal_issues.request") &&
      this.access.hasPermission(await this.access.loadContext(actor.id), "internal_issues.validate");
    if (isValidatorOnly && issue.status !== InternalIssueStatus.PENDING) {
      throw invalidStatus("En tant que validateur, vous ne pouvez annuler que les demandes en attente.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.internalStockIssue.update({
        where: { id },
        data: {
          status: InternalIssueStatus.CANCELLED,
          reviewNote: dto.reason?.trim() || issue.reviewNote,
        },
      });
      await this.audit.write(
        {
          actorId: actor.id,
          action: INTERNAL_ISSUE_AUDIT.CANCELLED,
          entityType: INTERNAL_ISSUE_AUDIT_ENTITY.ISSUE,
          entityId: id,
          storeId: issue.storeId,
          newValue: { reason: dto.reason ?? null },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.findOne(actor, id);
  }

  async listPendingStoreConfirmation(actor: AuthUser, storeId: string): Promise<{ items: InternalIssueListItem[] }> {
    const context = await this.access.loadContext(actor.id);
    if (!this.access.hasPermission(context, "stock.read")) {
      throw forbiddenScope();
    }
    this.assertStoreAssigned(actor, storeId);

    const rows = await this.prisma.internalStockIssue.findMany({
      where: {
        storeId,
        scopeType: ScopeType.STORE,
        status: InternalIssueStatus.PENDING,
        storeConfirmedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        warehouse: { select: placeSelect },
        store: { select: placeSelect },
        product: { select: { id: true, reference: true, name: true } },
        reviewedBy: { select: personSelect },
        storeConfirmedBy: { select: personSelect },
      },
    });

    return { items: rows.map(toListItem) };
  }

  async confirmStore(actor: AuthUser, id: string, meta: RequestMeta): Promise<InternalIssueDetail> {
    const context = await this.access.loadContext(actor.id);
    if (!this.access.hasPermission(context, "stock.read")) {
      throw forbiddenScope();
    }

    const issue = await this.requireIssue(id);
    if (issue.scopeType !== ScopeType.STORE || !issue.storeId) {
      throw invalidStatus("Seules les sorties boutique peuvent être confirmées en caisse.");
    }
    if (issue.status !== InternalIssueStatus.PENDING) {
      throw invalidStatus("Seule une demande en attente peut être confirmée en boutique.");
    }
    if (issue.storeConfirmedAt) {
      throw new ApiException(
        INTERNAL_ISSUE_ERROR.STORE_ALREADY_CONFIRMED,
        "Cette demande a déjà été confirmée par la boutique.",
        HttpStatus.CONFLICT,
      );
    }
    this.assertStoreAssigned(actor, issue.storeId);

    await this.prisma.$transaction(async (tx) => {
      await tx.internalStockIssue.update({
        where: { id },
        data: {
          storeConfirmedAt: new Date(),
          storeConfirmedById: actor.id,
        },
      });
      await tx.notification.updateMany({
        where: {
          entityType: "InternalStockIssue",
          entityId: id,
          storeId: issue.storeId,
          readAt: null,
        },
        data: { readAt: new Date(), readById: actor.id },
      });
      await this.audit.write(
        {
          actorId: actor.id,
          action: INTERNAL_ISSUE_AUDIT.STORE_CONFIRMED,
          entityType: INTERNAL_ISSUE_AUDIT_ENTITY.ISSUE,
          entityId: id,
          storeId: issue.storeId,
          newValue: { storeConfirmed: true },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    return this.findOne(actor, id);
  }

  private async requiresStoreConfirmation(issue: InternalStockIssue): Promise<boolean> {
    if (issue.scopeType !== ScopeType.STORE || !issue.storeId) {
      return false;
    }
    if (issue.storeConfirmedAt) {
      return false;
    }
    const row = await this.prisma.appSetting.findUnique({
      where: { key: SETTING_INTERNAL_ISSUE_REQUIRES_STORE_CONFIRMATION },
    });
    if (!row) {
      return true;
    }
    return row.value === true;
  }

  private async approveStock(
    tx: PrismaTx,
    issue: InternalStockIssue,
    actorId: string,
    note: string | null,
  ): Promise<void> {
    const movementNote = buildMovementNote(issue, note);
    await this.stockMovements.recordInternalIssue(tx, {
      productId: issue.productId,
      warehouseId: issue.warehouseId,
      storeId: issue.storeId,
      quantity: issue.quantity,
      internalIssueId: issue.id,
      createdById: actorId,
      note: movementNote,
    });
  }

  private async assertProductEligible(
    scopeType: ScopeType,
    productId: string,
    warehouseId: string | null,
    storeId: string | null,
  ): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true },
    });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw productNotFound();
    }
    if (scopeType === ScopeType.STORE && storeId) {
      const link = await this.prisma.productStore.findUnique({
        where: { productId_storeId: { productId, storeId } },
        select: { isAuthorized: true },
      });
      if (!link?.isAuthorized) {
        throw productNotAuthorized();
      }
    }
    const level = await this.prisma.stockLevel.findFirst({
      where: {
        productId,
        warehouseId: scopeType === ScopeType.WAREHOUSE ? warehouseId : null,
        storeId: scopeType === ScopeType.STORE ? storeId : null,
      },
      select: { quantityOnHand: true, quantityReserved: true },
    });
    if (!level || level.quantityOnHand <= 0) {
      throw new ApiException(
        INTERNAL_ISSUE_ERROR.QUANTITY_INVALID,
        "Aucun stock disponible pour ce produit à ce lieu.",
        HttpStatus.CONFLICT,
      );
    }
  }

  private async assertLocationActive(
    scopeType: ScopeType,
    warehouseId?: string,
    storeId?: string,
  ): Promise<void> {
    if (scopeType === ScopeType.WAREHOUSE) {
      if (!warehouseId) {
        throw locationRequired();
      }
      const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
      if (!warehouse || warehouse.status !== ReferentialStatus.ACTIVE) {
        throw warehouseInactive();
      }
      return;
    }
    if (!storeId) {
      throw locationRequired();
    }
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.status !== ReferentialStatus.ACTIVE) {
      throw storeInactive();
    }
  }

  private async assertCanRequest(
    actor: AuthUser,
    scopeType: ScopeType,
    warehouseId: string | null,
    storeId: string | null,
  ): Promise<void> {
    const context = await this.access.loadContext(actor.id);
    if (!this.access.hasPermission(context, "internal_issues.request")) {
      throw forbiddenScope();
    }
    if (context.isGlobalScope) {
      return;
    }
    if (scopeType === ScopeType.WAREHOUSE) {
      if (actor.role.code !== "WAREHOUSE_MANAGER") {
        throw forbiddenScope();
      }
      return;
    }
    if (storeId) {
      this.assertStoreAssigned(actor, storeId);
    }
  }

  private async assertCanView(actor: AuthUser, detail: InternalIssueDetail): Promise<void> {
    const context = await this.access.loadContext(actor.id);
    if (context.isGlobalScope || this.access.hasPermission(context, "internal_issues.validate")) {
      return;
    }
    if (detail.scopeType === ScopeType.WAREHOUSE) {
      if (actor.role.code === "WAREHOUSE_MANAGER") {
        return;
      }
      throw forbiddenScope();
    }
    if (detail.store?.id) {
      if (
        this.access.hasPermission(context, "internal_issues.request") ||
        this.access.hasPermission(context, "stock.read")
      ) {
        this.assertStoreAssigned(actor, detail.store.id);
        return;
      }
    }
    throw forbiddenScope();
  }

  private async buildScope(
    actor: AuthUser,
    query: Pick<ListInternalIssuesQueryDto, "storeId" | "warehouseId">,
  ): Promise<Prisma.InternalStockIssueWhereInput> {
    const context = await this.access.loadContext(actor.id);
    if (context.isGlobalScope || this.access.hasPermission(context, "internal_issues.validate")) {
      const filter: Prisma.InternalStockIssueWhereInput = {};
      if (query.storeId) {
        filter.storeId = query.storeId;
      }
      if (query.warehouseId) {
        filter.warehouseId = query.warehouseId;
      }
      return filter;
    }
    if (actor.role.code === "WAREHOUSE_MANAGER") {
      return { scopeType: ScopeType.WAREHOUSE };
    }
    const storeIds = actor.stores.map((store) => store.id);
    if (storeIds.length === 0) {
      return { id: { in: [] } };
    }
    if (query.storeId) {
      this.assertStoreAssigned(actor, query.storeId);
      return { storeId: query.storeId };
    }
    return { storeId: { in: storeIds } };
  }

  private assertStoreAssigned(actor: AuthUser, storeId: string): void {
    if (!actor.stores.some((store) => store.id === storeId)) {
      throw forbiddenScope();
    }
  }

  private async requireIssue(id: string): Promise<InternalStockIssue> {
    const issue = await this.prisma.internalStockIssue.findUnique({ where: { id } });
    if (!issue) {
      throw notFound();
    }
    return issue;
  }

  private async mustDetail(issue: InternalStockIssue): Promise<InternalIssueDetail> {
    const detail = await this.loadDetail(issue.id);
    if (!detail) {
      throw notFound();
    }
    return detail;
  }

  private async loadDetail(id: string): Promise<InternalIssueDetail | null> {
    const row = await this.prisma.internalStockIssue.findUnique({
      where: { id },
      include: {
        warehouse: { select: placeSelect },
        store: { select: placeSelect },
        product: { select: { id: true, reference: true, name: true } },
        requestedBy: { select: personSelect },
        reviewedBy: { select: personSelect },
        storeConfirmedBy: { select: personSelect },
      },
    });
    if (!row) {
      return null;
    }
    return toDetail(row);
  }

  private async loadRequiresApproval(): Promise<boolean> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: SETTING_INTERNAL_ISSUE_REQUIRES_APPROVAL },
    });
    if (!row) {
      return true;
    }
    return row.value === true;
  }
}

function toListItem(
  row: InternalStockIssue & {
    warehouse: { id: string; code: string; name: string } | null;
    store: { id: string; code: string; name: string } | null;
    product: { id: string; reference: string; name: string };
    reviewedBy: { id: string; firstName: string; lastName: string } | null;
    storeConfirmedBy: { id: string; firstName: string; lastName: string } | null;
  },
): InternalIssueListItem {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    scopeType: row.scopeType,
    warehouse: row.warehouse,
    store: row.store,
    productReference: row.product.reference,
    productName: row.product.name,
    quantity: row.quantity,
    reasonCode: row.reasonCode,
    reasonText: row.reasonText,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy,
    storeConfirmedAt: row.storeConfirmedAt?.toISOString() ?? null,
    storeConfirmedBy: row.storeConfirmedBy,
  };
}

function toDetail(
  row: InternalStockIssue & {
    warehouse: { id: string; code: string; name: string } | null;
    store: { id: string; code: string; name: string } | null;
    product: { id: string; reference: string; name: string };
    requestedBy: { id: string; firstName: string; lastName: string };
    reviewedBy: { id: string; firstName: string; lastName: string } | null;
    storeConfirmedBy: { id: string; firstName: string; lastName: string } | null;
  },
): InternalIssueDetail {
  return {
    ...toListItem(row),
    productId: row.product.id,
    reasonText: row.reasonText,
    reviewNote: row.reviewNote,
    requestedBy: row.requestedBy,
    reviewedBy: row.reviewedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function locationLabelFromIssue(issue: InternalStockIssue): string {
  if (issue.scopeType === ScopeType.WAREHOUSE) {
    return "entrepôt";
  }
  return "boutique";
}

function buildMovementNote(issue: InternalStockIssue, reviewNote: string | null): string {
  const parts = [`Sortie interne ${issue.reference}`, `motif=${issue.reasonCode}`];
  if (issue.reasonText) {
    parts.push(issue.reasonText);
  }
  if (reviewNote) {
    parts.push(`note=${reviewNote}`);
  }
  return parts.join(" — ").slice(0, 500);
}

function assertReasonText(code: InternalIssueReason, text?: string | null): void {
  if (code === InternalIssueReason.OTHER && !text?.trim()) {
    throw new ApiException(
      INTERNAL_ISSUE_ERROR.REASON_TEXT_REQUIRED,
      "Précisez le motif lorsque vous choisissez « Autre ».",
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

function trimNullable(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function notFound(): ApiException {
  return new ApiException(INTERNAL_ISSUE_ERROR.NOT_FOUND, "Demande de sortie introuvable.", HttpStatus.NOT_FOUND);
}

function invalidStatus(message: string): ApiException {
  return new ApiException(INTERNAL_ISSUE_ERROR.INVALID_STATUS, message, HttpStatus.CONFLICT);
}

function forbiddenScope(): ApiException {
  return new ApiException(INTERNAL_ISSUE_ERROR.FORBIDDEN_SCOPE, "Périmètre insuffisant pour cette action.", HttpStatus.FORBIDDEN);
}

function locationRequired(): ApiException {
  return new ApiException(INTERNAL_ISSUE_ERROR.LOCATION_REQUIRED, "Le lieu de sortie est obligatoire.", HttpStatus.BAD_REQUEST);
}

function warehouseInactive(): ApiException {
  return new ApiException(INTERNAL_ISSUE_ERROR.WAREHOUSE_INACTIVE, "Entrepôt inactif ou inconnu.", HttpStatus.CONFLICT);
}

function storeInactive(): ApiException {
  return new ApiException(INTERNAL_ISSUE_ERROR.STORE_INACTIVE, "Boutique inactive ou inconnue.", HttpStatus.CONFLICT);
}

function productNotFound(): ApiException {
  return new ApiException(INTERNAL_ISSUE_ERROR.PRODUCT_NOT_FOUND, "Produit introuvable ou inactif.", HttpStatus.NOT_FOUND);
}

function productNotAuthorized(): ApiException {
  return new ApiException(
    INTERNAL_ISSUE_ERROR.PRODUCT_NOT_AUTHORIZED,
    "Ce produit n'est pas autorisé dans cette boutique.",
    HttpStatus.CONFLICT,
  );
}

function quantityInvalid(): ApiException {
  return new ApiException(INTERNAL_ISSUE_ERROR.QUANTITY_INVALID, "La quantité doit être au moins 1.", HttpStatus.BAD_REQUEST);
}