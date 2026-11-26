import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response, CookieOptions } from "express";

@Injectable()
export class RefreshCookieService {
  private readonly cookieName: string;
  private readonly secure: boolean;

  constructor(private readonly config: ConfigService) {
    this.cookieName = this.config.get<string>("auth.refreshCookieName", "eyano_refresh");
    const nodeEnv = this.config.get<string>("NODE_ENV", "development");
    this.secure = nodeEnv === "production";
  }

  set(response: Response, rawToken: string, maxAgeMs: number): void {
    response.cookie(this.cookieName, rawToken, this.options(maxAgeMs));
  }

  clear(response: Response): void {
    response.clearCookie(this.cookieName, this.options(0));
  }

  read(request: Request): string | undefined {
    const value = request.cookies?.[this.cookieName];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private options(maxAgeMs: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: maxAgeMs,
    };
  }
}
