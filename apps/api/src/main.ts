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
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api`);
}

bootstrap();
