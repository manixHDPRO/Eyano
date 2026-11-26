import type { Request } from "express";
import type { AccessContext } from "./access-context";
import type { AuthUser } from "./auth-user";

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
  access?: AccessContext;
};
