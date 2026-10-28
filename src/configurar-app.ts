import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/** Configuração compartilhada entre o servidor local, a função da Vercel e os testes. */
export function configurarApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use((_req: any, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
}
