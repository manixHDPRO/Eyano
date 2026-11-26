import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class PosDailySalesReportQueryDto {
  @IsUUID()
  storeId!: string;

  @IsUUID()
  cashRegisterId!: string;

  /** Jour civil (YYYY-MM-DD). Défaut : aujourd’hui (fuseau serveur). */
  @IsOptional()
  @IsDateString()
  date?: string;
}