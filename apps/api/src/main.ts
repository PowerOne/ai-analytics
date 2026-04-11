import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: true }),
  );
  const port = process.env.PORT ?? "3001";
  await app.listen(port, "0.0.0.0");
  console.log(`API listening on 0.0.0.0:${port}/api`);
}

bootstrap();
