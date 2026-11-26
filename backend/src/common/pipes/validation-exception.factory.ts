import { UnprocessableEntityException } from "@nestjs/common";
import type { ValidationError } from "class-validator";

function flattenValidation(errors: ValidationError[]): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = [];

  for (const error of errors) {
    if (error.constraints) {
      out.push({
        field: error.property,
        message: Object.values(error.constraints).join(", "),
      });
    }
    if (error.children?.length) {
      for (const child of flattenValidation(error.children)) {
        out.push({
          field: `${error.property}.${child.field}`,
          message: child.message,
        });
      }
    }
  }

  return out;
}

export function validationExceptionFactory(errors: ValidationError[]): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: "VALIDATION_ERROR",
    message: "Les données envoyées ne sont pas valides.",
    details: flattenValidation(errors),
  });
}