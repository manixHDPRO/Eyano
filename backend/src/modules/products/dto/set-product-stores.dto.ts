import { ArrayUnique, IsArray, IsUUID } from "class-validator";

export class SetProductStoresDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayUnique()
  storeIds!: string[];
}
