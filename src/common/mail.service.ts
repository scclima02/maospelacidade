import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

export type StatusEnvio = 'enviada' | 'falha' | 'ignorada';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private transporter?: Transporter;

  get habilitado(): boolean {
    return !!process.env.SMTP_HOST;
  }

  private obterTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        connectionTimeout: 8000,
        socketTimeout: 10000,
      });
    }
    return this.transporter;
  }

  /** Nunca lança: o aviso dentro do sistema continua disponível se o e-mail falhar. */
  async enviar(para: string, assunto: string, texto: string): Promise<StatusEnvio> {
    if (!this.habilitado) return 'ignorada';
    try {
      await this.obterTransporter().sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: para,
        subject: assunto,
        text: texto,
      });
      return 'enviada';
    } catch (e) {
      this.log.warn(`Falha ao enviar e-mail: ${(e as Error).message}`);
      return 'falha';
    }
  }
}
