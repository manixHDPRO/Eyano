import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { TransferLineDto } from "./transfer-line.dto";

export class CreateTransferDto {
  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  storeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  items?: TransferLineDto[];

  /** Comme HD : créer directement en attente de validation (sans brouillon). */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  submitImmediately?: boolean;
}
