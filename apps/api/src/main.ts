import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { json } from "express";
import { AppModule } from "./app.module";
import type { Env } from "./core/config/env.schema";

async function bootstrap(): Promise<void> {
  // Disable the default 100kb body parser so we can cap it ourselves.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService<Env, true>);

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
