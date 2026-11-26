import { Injectable } from "@nestjs/common";
import { DocumentSequenceCode, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class DocumentSequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async nextReference(code: DocumentSequenceCode, client: PrismaTx | PrismaService = this.prisma): Promise<string> {
    const row = await client.documentSequence.update({
      where: { code },
      data: { nextNumber: { increment: 1 } },
      select: { prefix: true, padding: true, nextNumber: true },
    });
    const issued = row.nextNumber - 1;
    return `${row.prefix}${String(issued).padStart(row.padding, "0")}`;
  }
}