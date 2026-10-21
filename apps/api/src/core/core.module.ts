import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ZodValidationPipe } from "nestjs-zod";
import { validateEnv } from "./config/env.schema";
import { PrismaExceptionFilter } from "./filters/prisma-exception.filter";
import { PrismaModule } from "./prisma/prisma.module";

// Cross-cutting providers, available app-wide. Keeps AppModule to wiring only.
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    // Global rate limit on the unauthenticated write surface: 30 req / 60s / IP.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
  exports: [PrismaModule],
})
export class CoreModule {}
