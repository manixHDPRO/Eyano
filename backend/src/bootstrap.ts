import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { validationExceptionFactory } from "./common/pipes/validation-exception.factory";
import { ensureUploadDirectories, resolveUploadRoot } from "./common/uploads/upload-root";

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>("NODE_ENV", "development");
  const corsOrigin = config.get<string>("CORS_ORIGIN", "http://localhost:5173");
  const uploadRoot = resolveUploadRoot(config.get<string>("UPLOAD_DIR"));

  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  ensureUploadDirectories(uploadRoot);
  (app as NestExpressApplication).useStaticAssets(uploadRoot, {
    prefix: "/uploads/",
    index: false,
  });

  if (nodeEnv !== "production") {
    app.enableCors({
      origin: corsOrigin.split(",").map((value) => value.trim()),
      credentials: true,
    });
  }
}
