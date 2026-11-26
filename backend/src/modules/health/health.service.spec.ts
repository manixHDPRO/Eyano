import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  let service: HealthService;
  const prisma = {
    ping: jest.fn(),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(HealthService);
    jest.clearAllMocks();
  });

  it("retourne ok quand la base répond", async () => {
    prisma.ping.mockResolvedValue(undefined);

    const result = await service.check();

    expect(result.status).toBe("ok");
    expect(result.database.status).toBe("up");
    expect(result.version).toBe("0.1.0");
  });

  it("retourne degraded quand la base est injoignable", async () => {
    prisma.ping.mockRejectedValue(new Error("db down"));

    const result = await service.check();

    expect(result.status).toBe("degraded");
    expect(result.database.status).toBe("down");
  });
});