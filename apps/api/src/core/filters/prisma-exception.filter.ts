import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@amanah/db";
import type { Response } from "express";

/**
 * Map Prisma unique-constraint violations (P2002) to a clean 409 without echoing
 * the raw error / schema. Anything else from Prisma becomes a plain 500 — but is
 * logged server-side (code + message, never returned to the client) so production
 * failures are diagnosable.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception.code === "P2002") {
      res.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        error: "Conflict",
        message: "Resource already exists",
      });
      return;
    }
    this.logger.error(`Prisma error ${exception.code}: ${exception.message}`);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "Internal Server Error",
    });
  }
}
