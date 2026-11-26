import { IsOptional, IsUUID } from "class-validator";

export class PendingCashierExpensesQueryDto {
  @IsUUID()
  storeId!: string;

  @IsOptional()
  @IsUUID()
  cashRegisterId?: string;
}