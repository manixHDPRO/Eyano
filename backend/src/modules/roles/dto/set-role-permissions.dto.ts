import { ArrayUnique, IsUUID } from "class-validator";

export class SetRolePermissionsDto {
  @IsUUID("4", { each: true })
  @ArrayUnique()
  permissionIds!: string[];
}