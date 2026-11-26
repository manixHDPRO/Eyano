import { SetMetadata } from "@nestjs/common";

export const STORE_SCOPE_KEY = "eyano:store_scope";

export type StoreScopeSource = "query" | "param" | "body";

export type StoreScopeMeta = {
  source: StoreScopeSource;
  key: string;
};

/** Vérifie que `storeId` appartient au périmètre de l'utilisateur (sauf rôles globaux). */
export const StoreScoped = (source: StoreScopeSource, key = "storeId") =>
  SetMetadata(STORE_SCOPE_KEY, { source, key } satisfies StoreScopeMeta);