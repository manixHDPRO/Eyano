import { HttpStatus, Injectable } from "@nestjs/common";
import { CategoryStatus, Prisma, ProductStatus, type Category } from "@prisma/client";
import { ApiException } from "../../common/exceptions/api.exception";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { isPrismaUniqueViolation } from "../../common/utils/referential-code";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit-logs/audit-logs.constants";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { CATEGORIES_ERROR } from "./categories.constants";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";
import { slugifyCategoryName } from "./slug";

type PrismaTx = Prisma.TransactionClient;

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  status: CategoryStatus;
  sortOrder: number;
  parentId: string | null;
  depth: 1 | 2;
  productCount: number;
  activeProductCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryNode = CategorySummary & {
  children: CategoryNode[];
};

export type CategoryLeafOption = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
};

export type CategoryDetail = CategorySummary & {
  parent: { id: string; name: string; slug: string } | null;
  children: CategorySummary[];
};

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async tree(): Promise<{ items: CategoryNode[]; stats: CategoryTreeStats }> {
    const [rows, activeCounts] = await Promise.all([
      this.prisma.category.findMany({
        include: { _count: { select: { products: true, children: true } } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.prisma.product.groupBy({
        by: ["categoryId"],
        where: { status: ProductStatus.ACTIVE },
        _count: { _all: true },
      }),
    ]);

    const activeByCategory = new Map(activeCounts.map((row) => [row.categoryId, row._count._all]));
    const summaries = rows.map((row) =>
      toSummary(row, row._count.products, activeByCategory.get(row.id) ?? 0, row._count.children),
    );
    const byParent = new Map<string | null, CategorySummary[]>();
    for (const summary of summaries) {
      const key = summary.parentId;
      const list = byParent.get(key) ?? [];
      list.push(summary);
      byParent.set(key, list);
    }

    const items = (byParent.get(null) ?? []).map((root) => toNode(root, byParent));
    const archived = summaries.filter((row) => row.status === CategoryStatus.ARCHIVED).length;
    const children = summaries.filter((row) => row.parentId !== null).length;
    const leaves = summaries.filter((row) => row.childCount === 0 && row.status === CategoryStatus.ACTIVE).length;

    return {
      items,
      stats: {
        total: summaries.length,
        roots: items.length,
        children,
        leaves,
        archived,
        products: summaries.reduce((sum, row) => sum + row.productCount, 0),
      },
    };
  }

  async listLeaves(): Promise<{ items: CategoryLeafOption[] }> {
    const rows = await this.prisma.category.findMany({
      where: { status: CategoryStatus.ACTIVE, children: { none: {} } },
      include: { parent: { select: { id: true, name: true } } },
      orderBy: [{ parent: { name: "asc" } }, { name: "asc" }],
    });
    const items: CategoryLeafOption[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parentId,
      parentName: row.parent?.name ?? null,
    }));
    return { items };
  }

  async findOne(id: string): Promise<CategoryDetail> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        _count: { select: { products: true, children: true } },
      },
    });
    if (!category) {
      throw notFound();
    }
    const [activeCount, childActiveCounts] = await Promise.all([
      this.prisma.product.count({ where: { categoryId: id, status: ProductStatus.ACTIVE } }),
      category.children.length === 0
        ? Promise.resolve([])
        : this.prisma.product.groupBy({
            by: ["categoryId"],
            where: {
              categoryId: { in: category.children.map((child) => child.id) },
              status: ProductStatus.ACTIVE,
            },
            _count: { _all: true },
          }),
    ]);
    const childActive = new Map(childActiveCounts.map((row) => [row.categoryId, row._count._all]));
    const childProductCounts = await this.prisma.product.groupBy({
      by: ["categoryId"],
      where: { categoryId: { in: category.children.map((child) => child.id) } },
      _count: { _all: true },
    });
    const childTotals = new Map(childProductCounts.map((row) => [row.categoryId, row._count._all]));

    return {
      ...toSummary(category, category._count.products, activeCount, category._count.children),
      parent: category.parent
        ? { id: category.parent.id, name: category.parent.name, slug: category.parent.slug }
        : null,
      children: category.children.map((child) =>
        toSummary(child, childTotals.get(child.id) ?? 0, childActive.get(child.id) ?? 0, 0),
      ),
    };
  }

  async create(actor: AuthUser, dto: CreateCategoryDto, meta: RequestMeta): Promise<CategoryDetail> {
    const name = dto.name.trim();
    const parent = await this.resolveParent(dto.parentId);
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(parent?.id ?? null));
    const slug = await this.allocateSlug(name);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const category = await tx.category.create({
          data: {
            name,
            slug,
            parentId: parent?.id ?? null,
            sortOrder,
            status: CategoryStatus.ACTIVE,
          },
        });
        await this.audit.write(
          {
            actorId: actor.id,
            action: AUDIT_ACTION.CATEGORY_CREATED,
            entityType: AUDIT_ENTITY.CATEGORY,
            entityId: category.id,
            newValue: categorySnapshot(category),
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
          tx,
        );
        return category;
      });
      return this.findOne(created.id);
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        throw slugTaken();
      }
      throw error;
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateCategoryDto, meta: RequestMeta): Promise<CategoryDetail> {
    const current = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!current) {
      throw notFound();
    }

    const nextName = dto.name !== undefined ? dto.name.trim() : current.name;
    let nextParentId = current.parentId;
    if (dto.parentId !== undefined) {
      nextParentId = await this.resolveParentIdForUpdate(current, dto.parentId);
    }

    const nextStatus = dto.status ?? current.status;
    if (nextStatus === CategoryStatus.ACTIVE && nextParentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: nextParentId } });
      if (parent?.status === CategoryStatus.ARCHIVED) {
        throw parentArchived();
      }
    }

    const slug =
      nextName !== current.name ? await this.allocateSlug(nextName, current.id) : current.slug;

    const data: Prisma.CategoryUpdateInput = {
      ...(dto.name !== undefined ? { name: nextName, slug } : {}),
      ...(dto.parentId !== undefined ? { parent: nextParentId ? { connect: { id: nextParentId } } : { disconnect: true } } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.category.update({ where: { id }, data });
        if (dto.status === CategoryStatus.ARCHIVED) {
          await this.cascadeArchive(tx, id, actor, meta);
        }
        await this.audit.write(
          {
            actorId: actor.id,
            action: AUDIT_ACTION.CATEGORY_UPDATED,
            entityType: AUDIT_ENTITY.CATEGORY,
            entityId: id,
            oldValue: categorySnapshot(current),
            newValue: categorySnapshot(updated),
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
          tx,
        );
      });
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        throw slugTaken();
      }
      throw error;
    }

    return this.findOne(id);
  }

  async archive(actor: AuthUser, id: string, meta: RequestMeta): Promise<CategoryDetail> {
    return this.update(actor, id, { status: CategoryStatus.ARCHIVED }, meta);
  }

  async restore(actor: AuthUser, id: string, meta: RequestMeta): Promise<CategoryDetail> {
    return this.update(actor, id, { status: CategoryStatus.ACTIVE }, meta);
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta): Promise<{ id: string; name: string; slug: string }> {
    const current = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!current) {
      throw notFound();
    }
    if (current._count.children > 0) {
      throw new ApiException(
        CATEGORIES_ERROR.HAS_CHILDREN,
        "Retirez ou archivez d’abord les sous-catégories.",
        HttpStatus.CONFLICT,
      );
    }
    if (current._count.products > 0) {
      throw new ApiException(
        CATEGORIES_ERROR.HAS_PRODUCTS,
        "Cette catégorie a des produits : archivez-la plutôt que de la supprimer.",
        HttpStatus.CONFLICT,
      );
    }

    const summary = { id: current.id, name: current.name, slug: current.slug };
    await this.prisma.$transaction(async (tx) => {
      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.CATEGORY_DELETED,
          entityType: AUDIT_ENTITY.CATEGORY,
          entityId: id,
          oldValue: categorySnapshot(current),
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
      await tx.category.delete({ where: { id } });
    });
    return summary;
  }

  private async resolveParent(parentId: string | undefined): Promise<Category | null> {
    if (!parentId) {
      return null;
    }
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      include: { _count: { select: { products: true } } },
    });
    if (!parent) {
      throw new ApiException(
        CATEGORIES_ERROR.PARENT_NOT_FOUND,
        "Catégorie parente introuvable.",
        HttpStatus.NOT_FOUND,
      );
    }
    if (parent.parentId) {
      throw depthExceeded();
    }
    if (parent.status === CategoryStatus.ARCHIVED) {
      throw parentArchived();
    }
    if (parent._count.products > 0) {
      throw new ApiException(
        CATEGORIES_ERROR.PARENT_HAS_PRODUCTS,
        "Impossible d’ajouter une sous-catégorie : des produits sont déjà rattachés à ce nœud. Réaffectez-les d’abord à une feuille.",
        HttpStatus.CONFLICT,
      );
    }
    return parent;
  }

  private async resolveParentIdForUpdate(
    current: Category & { _count: { products: number; children: number } },
    parentId: string | null,
  ): Promise<string | null> {
    if (parentId === current.id) {
      throw new ApiException(
        CATEGORIES_ERROR.INVALID_PARENT,
        "Une catégorie ne peut pas être sa propre parente.",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (parentId === null) {
      return null;
    }
    if (current._count.children > 0) {
      throw depthExceeded();
    }
    const parent = await this.resolveParent(parentId);
    return parent?.id ?? null;
  }

  private async nextSortOrder(parentId: string | null): Promise<number> {
    const last = await this.prisma.category.findFirst({
      where: { parentId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async allocateSlug(name: string, excludeId?: string): Promise<string> {
    const base = slugifyCategoryName(name);
    for (let index = 0; index < 50; index += 1) {
      const candidate = index === 0 ? base : `${base}-${index + 1}`;
      const existing = await this.prisma.category.findUnique({ where: { slug: candidate } });
      if (!existing || existing.id === excludeId) {
        return candidate;
      }
    }
    throw slugTaken();
  }

  private async cascadeArchive(tx: PrismaTx, parentId: string, actor: AuthUser, meta: RequestMeta): Promise<void> {
    const children = await tx.category.findMany({
      where: { parentId, status: CategoryStatus.ACTIVE },
    });
    for (const child of children) {
      const updated = await tx.category.update({
        where: { id: child.id },
        data: { status: CategoryStatus.ARCHIVED },
      });
      await this.audit.write(
        {
          actorId: actor.id,
          action: AUDIT_ACTION.CATEGORY_UPDATED,
          entityType: AUDIT_ENTITY.CATEGORY,
          entityId: child.id,
          oldValue: categorySnapshot(child),
          newValue: categorySnapshot(updated),
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    }
  }
}

type CategoryTreeStats = {
  total: number;
  roots: number;
  children: number;
  leaves: number;
  archived: number;
  products: number;
};

function toSummary(
  category: Category,
  productCount: number,
  activeProductCount: number,
  childCount: number,
): CategorySummary {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    status: category.status,
    sortOrder: category.sortOrder,
    parentId: category.parentId,
    depth: category.parentId ? 2 : 1,
    productCount,
    activeProductCount,
    childCount,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

function toNode(summary: CategorySummary, byParent: Map<string | null, CategorySummary[]>): CategoryNode {
  const children = (byParent.get(summary.id) ?? []).map((child) => toNode(child, byParent));
  return { ...summary, children };
}

function categorySnapshot(category: Category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    status: category.status,
    sortOrder: category.sortOrder,
  };
}

function notFound(): ApiException {
  return new ApiException(CATEGORIES_ERROR.NOT_FOUND, "Catégorie introuvable.", HttpStatus.NOT_FOUND);
}

function depthExceeded(): ApiException {
  return new ApiException(
    CATEGORIES_ERROR.DEPTH_EXCEEDED,
    "L’arbre s’arrête à deux niveaux : catégorie et sous-catégorie.",
    HttpStatus.CONFLICT,
  );
}

function parentArchived(): ApiException {
  return new ApiException(
    CATEGORIES_ERROR.PARENT_ARCHIVED,
    "Impossible d’utiliser une catégorie parente archivée.",
    HttpStatus.CONFLICT,
  );
}

function slugTaken(): ApiException {
  return new ApiException(
    CATEGORIES_ERROR.SLUG_TAKEN,
    "Ce libellé produit un identifiant déjà utilisé.",
    HttpStatus.CONFLICT,
  );
}
