import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog() {
    const rows = await this.prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { code: "asc" }],
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        module: row.module,
        description: row.description,
      })),
    };
  }
}