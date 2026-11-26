import { ArrayMaxSize, ArrayMinSize, IsUUID } from "class-validator";

export class DeleteStoresDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true, message: "Chaque identifiant doit être un UUID valide." })
  ids!: string[];
}