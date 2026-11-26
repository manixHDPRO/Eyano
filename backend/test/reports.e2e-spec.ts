import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { hashPassword } from "../src/common/crypto/argon2";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp } from "./app.helper";

const PASSWORD = "Test_Eyano_Reports_P18";

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.accessToken as string;
}

function xlsxMagic(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function pdfMagic(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

describe("Rapports (palier 18)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reporterEmail = "";
  let noReportsEmail = "";
  const cleanupUsers: string[] = [];
  const cleanupRoles: string[] = [];

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(PASSWORD);
    const suffix = `${Date.now()}`;

    const reporterRole = await prisma.role.findUniqueOrThrow({ where: { code: "CENTRAL_ADMIN" } });
    const stockRead = await prisma.permission.findUniqueOrThrow({ where: { code: "stock.read" } });
    const noReportsRole = await prisma.role.create({
      data: {
        code: `P18_NORPT_${suffix}`.slice(0, 32),
        name: "Sans rapports",
        description: "Test palier 18",
        isSystem: false,
        rolePermissions: { create: { permissionId: stockRead.id } },
      },
    });
    cleanupRoles.push(noReportsRole.id);

    const reporter = await prisma.user.create({
      data: {
        email: `p18.reports.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Rapports",
        lastName: "Admin",
        status: "ACTIVE",
        roleId: reporterRole.id,
      },
    });
    const noReports = await prisma.user.create({
      data: {
        email: `p18.norpt.${suffix}@eyano.test`,
        passwordHash,
        firstName: "Stock",
        lastName: "SansRapport",
        status: "ACTIVE",
        roleId: noReportsRole.id,
      },
    });

    reporterEmail = reporter.email;
    noReportsEmail = noReports.email;
    cleanupUsers.push(reporter.id, noReports.id);
  });

  afterAll(async () => {
    if (cleanupUsers.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: cleanupUsers } } });
      await prisma.loginHistory.deleteMany({ where: { userId: { in: cleanupUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanupUsers } } });
    }
    if (cleanupRoles.length > 0) {
      await prisma.rolePermission.deleteMany({ where: { roleId: { in: cleanupRoles } } });
      await prisma.role.deleteMany({ where: { id: { in: cleanupRoles } } });
    }
    await app.close();
  });

  it("GET /reports/overview renvoie les agrégats", async () => {
    const token = await login(app, reporterEmail);
    const response = await request(app.getHttpServer())
      .get("/api/v1/reports/overview")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.financialSummary).toEqual(expect.objectContaining({ revenueUsd: expect.any(Number) }));
    expect(response.body).toHaveProperty("activeTransfers");
  });

  it("utilisateur sans reports.read reçoit 403", async () => {
    const token = await login(app, noReportsEmail);
    await request(app.getHttpServer())
      .get("/api/v1/reports/overview")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("export Excel ventes : type MIME et signature ZIP", async () => {
    const token = await login(app, reporterEmail);
    const response = await request(app.getHttpServer())
      .get("/api/v1/reports/export/sales.xlsx")
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(String(response.headers["content-type"])).toContain("spreadsheetml");
    const body = response.body as Buffer;
    expect(xlsxMagic(body)).toBe(true);
    expect(body.length).toBeGreaterThan(200);
  });

  it("export PDF synthèse : %PDF", async () => {
    const token = await login(app, reporterEmail);
    const response = await request(app.getHttpServer())
      .get("/api/v1/reports/export/overview.pdf")
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(String(response.headers["content-type"])).toContain("pdf");
    expect(pdfMagic(response.body as Buffer)).toBe(true);
  });
});