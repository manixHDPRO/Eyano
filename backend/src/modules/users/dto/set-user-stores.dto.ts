import { ArrayUnique, IsBoolean, IsOptional, IsUUID, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class UserStoreLinkDto {
  @IsUUID()
  storeId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class SetUserStoresDto {
  @ValidateNested({ each: true })
  @Type(() => UserStoreLinkDto)
  @ArrayUnique((item: UserStoreLinkDto) => item.storeId)
  stores!: UserStoreLinkDto[];
}