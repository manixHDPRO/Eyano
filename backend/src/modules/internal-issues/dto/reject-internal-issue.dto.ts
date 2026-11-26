import { IsString, MaxLength, MinLength } from "class-validator";

export class RejectInternalIssueDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reviewNote!: string;
}