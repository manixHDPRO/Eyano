import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDefined, IsString, ValidateNested } from "class-validator";

export class SettingUpdateItemDto {
  @IsString()
  key!: string;

  @IsDefined()
  value!: unknown;
}

export class UpdateSettingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SettingUpdateItemDto)
  updates!: SettingUpdateItemDto[];
}