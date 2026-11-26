export type UserStoreAssignment = {
  id: string;
  code: string;
  name: string;
  isPrimary: boolean;
};

export type AccessContext = {
  roleCode: string;
  permissions: string[];
  storeIds: string[];
  stores: UserStoreAssignment[];
  isGlobalScope: boolean;
};