import { ZodError } from "zod";
import { DomainError } from "./application-service";
export function publicError(error: unknown) {
  if (error instanceof ZodError)
    return error.issues.map((i) => i.message).join(". ");
  if (error instanceof DomainError) return error.message;
  return "We couldn’t save your changes. Please try again.";
}
