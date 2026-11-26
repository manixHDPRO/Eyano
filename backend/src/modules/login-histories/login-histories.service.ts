import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { ApiException } from "../../common/exceptions/api.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { LOGIN_HISTORY_ERROR } from "./login-histories.constants";
import type { ListLoginHistoriesQueryDto } from "./dto/list-login-histories.query.dto";
import { toLoginHistoryItem } from "./login-histories.mapper";

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: { select: { code: true, name: true } },
} as const;

@Injectable()
export class LoginHistoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(_actor: AuthUser, query: ListLoginHistoriesQueryDto) {
    if (query.userId) {
      const exists = await this.prisma.user.count({ where: { id: query.userId } });
      if (exists === 0) {
        throw new ApiException(
          LOGIN_HISTORY_ERROR.USER_NOT_FOUND,
          "Utilisateur introuvable.",
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const where = this.buildWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.loginHistory.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
        include: { user: { select: userSelect } },
      }),
      this.prisma.loginHistory.count({ where }),
    ]);

    return {
      items: rows.map(toLoginHistoryItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async summary(_actor: AuthUser) {
    const today = startOfToday();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const dayAgo = new Date();
    dayAgo.setHours(dayAgo.getHours() - 24);

    const failedTodayWhere: Prisma.LoginHistoryWhereInput = {
      success: false,
      createdAt: { gte: today },
    };

    const [todayTotal, todaySuccess, todayFailed, last7DaysFailed, failedLast24h, unknownAttemptsToday] =
      await Promise.all([
        this.prisma.loginHistory.count({ where: { createdAt: { gte: today } } }),
        this.prisma.loginHistory.count({ where: { success: true, createdAt: { gte: today } } }),
        this.prisma.loginHistory.count({ where: failedTodayWhere }),
        this.prisma.loginHistory.count({ where: { success: false, createdAt: { gte: weekAgo } } }),
        this.prisma.loginHistory.count({ where: { success: false, createdAt: { gte: dayAgo } } }),
        this.prisma.loginHistory.count({
          where: { ...failedTodayWhere, userId: null },
        }),
      ]);

    return {
      todayTotal,
      todaySuccess,
      todayFailed,
      last7DaysFailed,
      failedLast24h,
      unknownAttemptsToday,
    };
  }

  private buildWhere(query: ListLoginHistoriesQueryDto): Prisma.LoginHistoryWhereInput {
    const where: Prisma.LoginHistoryWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.success !== undefined) {
      where.success = query.success;
    }
    if (query.userScope === "known") {
      where.userId = { not: null };
    } else if (query.userScope === "unknown") {
      where.userId = null;
    }

    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) {
      createdAt.gte = new Date(query.from);
    }
    if (query.to) {
      createdAt.lte = new Date(query.to);
    }
    if (createdAt.gte || createdAt.lte) {
      where.createdAt = createdAt;
    }

    const term = query.search?.trim();
    if (term) {
      where.OR = [
        { ip: { contains: term, mode: "insensitive" } },
        { userAgent: { contains: term, mode: "insensitive" } },
        {
          user: {
            is: {
              OR: [
                { email: { contains: term, mode: "insensitive" } },
                { firstName: { contains: term, mode: "insensitive" } },
                { lastName: { contains: term, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    return where;
  }
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}