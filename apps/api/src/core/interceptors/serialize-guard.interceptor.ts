import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, Observable } from "rxjs";

/**
 * DEV-ONLY backstop. The real guarantee is that services return mapped response
 * DTOs (Decimal -> .toFixed(0), bigint -> .toString()); this interceptor throws
 * if any un-serialized Decimal/bigint still escapes, so leaks fail loudly in
 * dev/test instead of silently corrupting large values. No-op in production.
 */
@Injectable()
export class SerializeGuardInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (process.env.NODE_ENV === "production") return next.handle();
    return next.handle().pipe(
      map((data) => {
        assertJsonSafe(data, "$");
        return data;
      }),
    );
  }
}

function assertJsonSafe(value: unknown, path: string): void {
  if (typeof value === "bigint") {
    throw new Error(`unserialized bigint at ${path} — return a mapped response DTO`);
  }
  if (value !== null && typeof value === "object") {
    if (isDecimalLike(value)) {
      throw new Error(`unserialized Decimal at ${path} — map with .toFixed(0)`);
    }
    for (const [key, val] of Object.entries(value)) {
      assertJsonSafe(val, `${path}.${key}`);
    }
  }
}

function isDecimalLike(value: object): boolean {
  return (
    typeof (value as { toFixed?: unknown }).toFixed === "function" &&
    (value as { constructor?: { name?: string } }).constructor?.name === "Decimal"
  );
}
