import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

async function bootstrap() {
  carregarEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);
  // Em produção (Vercel) os estáticos saem direto de public/; localmente o Nest serve a pasta.
  app.useStaticAssets(join(process.cwd(), 'public'));
  const porta = Number(process.env.PORT ?? 3000);
  await app.listen(porta);
  console.log(`Servidor em http://localhost:${porta}`);
}

/** Carrega .env em desenvolvimento, sem depender de pacote extra. */
function carregarEnv() {
  try {
    const { readFileSync } = require('fs');
    for (const linha of readFileSync(join(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* sem .env: usa as variáveis do ambiente */
  }
}

bootstrap();
