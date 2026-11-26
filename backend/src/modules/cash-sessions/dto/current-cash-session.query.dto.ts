import { IsUUID } from "class-validator";

export class CurrentCashSessionQueryDto {
  @IsUUID()
  cashRegisterId!: string;
}