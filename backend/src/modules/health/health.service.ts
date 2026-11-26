import { Injectable } from "@nestjs/common";
import packageJson from "../../../package.json";
import { PrismaService } from "../../prisma/prisma.service";

export type HealthCheckResult = {
  status: "ok" | "degraded";
  version: string;
  timestamp: string;
  database: {
    status: "up" | "down";
    latencyMs?: number;
  };
};

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    const started = Date.now();
    let databaseStatus: "up" | "down" = "down";
    let latencyMs: number | undefined;

    try {
      await this.prisma.ping();
      latencyMs = Date.now() - started;
      databaseStatus = "up";
    } catch {
      databaseStatus = "down";
    }

    const version = packageJson.version;

    return {
      status: databaseStatus === "up" ? "ok" : "degraded",
      version,
      timestamp: new Date().toISOString(),
      database: {
        status: databaseStatus,
        ...(latencyMs !== undefined ? { latencyMs } : {}),
      },
    };
  }
}