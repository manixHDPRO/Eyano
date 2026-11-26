import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import jwt, { JsonWebTokenError } from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { AccessTokenPayload } from "./auth.types";

@Injectable()
export class JwtTokenService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>("auth.jwtSecret");
  }

  sign(payload: AccessTokenPayload, expiresIn: SignOptions["expiresIn"]): string {
    return jwt.sign(payload, this.secret, { algorithm: "HS256", expiresIn });
  }

  verify(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, this.secret, { algorithms: ["HS256"] });
    if (typeof decoded === "string" || typeof decoded.sub !== "string") {
      throw new JsonWebTokenError("Payload d'accès invalide.");
    }
    return {
      sub: decoded.sub,
      email: typeof decoded.email === "string" ? decoded.email : "",
      role: typeof decoded.role === "string" ? decoded.role : "",
    };
  }
}
