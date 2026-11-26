import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";
import { CATEGORY_NAME_MAX } from "../categories.constants";

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(CATEGORY_NAME_MAX)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}
