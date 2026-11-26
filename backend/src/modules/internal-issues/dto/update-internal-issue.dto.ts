import { InternalIssueReason } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class UpdateInternalIssueDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity?: number;

  @IsOptional()
  @IsEnum(InternalIssueReason)
  reasonCode?: InternalIssueReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonText?: string | null;
}