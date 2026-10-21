import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { json } from "express";
import { AppModule } from "./app.module";
import type { Env } from "./core/config/env.schema";

async function bootstrap(): Promise<void> {
  // Disable the default 100kb body parser so we can cap it ourselves.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(ConfigService<Env, true>);

  // Trust the first proxy hop (Caddy) so req.ip is the real client IP from
  // X-Forwarded-For — otherwise the throttler keys every request on Caddy's
  // address and collapses to a single shared bucket.
  app.set("trust proxy", 1);

  app.use(json({ limit: config.get("BODY_LIMIT", { infer: true }) }));

  app.enableCors({
    origin: config
      .get("CORS_ORIGINS", { infer: true })
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    // No cookies/sessions — never reflect credentials with a loose origin.
    credentials: false,
  });

  app.enableShutdownHooks();
  await app.listen(config.get("PORT", { infer: true }));
}

void bootstrap();
