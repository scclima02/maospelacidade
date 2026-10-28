import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

let servidor: any;

/** Ponto de entrada da função serverless (api/index.js). */
export default async function handler(req: any, res: any) {
  if (!servidor) {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn'] });
    configurarApp(app);
    await app.init();
    servidor = app.getHttpAdapter().getInstance();
  }
  return servidor(req, res);
}
