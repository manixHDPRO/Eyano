import { registerAs } from "@nestjs/config";
import { resolveUploadRoot } from "../common/uploads/upload-root";

export default registerAs("app", () => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  version: process.env.npm_package_version ?? "0.1.0",
  uploadDir: resolveUploadRoot(process.env.UPLOAD_DIR),
  backupStatusFile: process.env.BACKUP_STATUS_FILE ?? "",
}));