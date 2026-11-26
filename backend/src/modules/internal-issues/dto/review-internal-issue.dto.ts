import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewInternalIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}