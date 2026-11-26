import { registerAs } from "@nestjs/config";

const DEV_FALLBACK_SECRET = "dev-only-change-me-eyano-jwt-secret-32";

export default registerAs("auth", () => {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const secret = process.env.JWT_SECRET ?? (nodeEnv === "production" ? undefined : DEV_FALLBACK_SECRET);

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET doit être défini et contenir au moins 32 caractères.");
  }

  return {
    jwtSecret: secret,
    refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? "eyano_refresh",
    defaults: {
      accessTtlMinutes: 15,
      refreshTtlHours: 12,
      maxFailedLogins: 5,
      lockMinutes: 15,
    },
  };
});
