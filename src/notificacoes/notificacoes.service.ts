import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { MailService } from '../common/mail.service';

export type TipoNotificacao = 'oportunidade' | 'selecao' | 'alteracao' | 'cancelamento' | 'outro';

export interface NovaNotificacao {
  idUsuario: number;
  email: string;
  idDemanda: number | null;
  tipo: TipoNotificacao;
  assunto: string;
  mensagem: string;
  /** Caminho do app (após o #) para o e-mail, ex.: /oportunidades/12 */
  rota?: string;
}

@Injectable()
export class NotificacoesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
  ) {}

  /** UC13: aviso dentro do sistema (sempre) + e-mail (se possível). Cada envio é registrado. */
  async notificar(lista: NovaNotificacao[]): Promise<void> {
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    for (let i = 0; i < lista.length; i += 10) {
      await Promise.all(
        lista.slice(i, i + 10).map(async (n) => {
          await this.db.query(
            `INSERT INTO notificacao (id_usuario, id_demanda, tipo, mensagem, canal, status_envio)
             VALUES ($1, $2, $3, $4, 'sistema', 'enviada')`,
            [n.idUsuario, n.idDemanda, n.tipo, n.mensagem],
          );
          const corpo = n.rota ? `${n.mensagem}\n\nAcesse: ${base}/#${n.rota}` : n.mensagem;
          const status = await this.mail.enviar(n.email, n.assunto, corpo);
          await this.db.query(
            `INSERT INTO notificacao (id_usuario, id_demanda, tipo, mensagem, canal, status_envio)
             VALUES ($1, $2, $3, $4, 'email', $5)`,
            [n.idUsuario, n.idDemanda, n.tipo, n.mensagem, status],
          );
        }),
      );
    }
  }

  listar(idUsuario: number, apenasNaoLidas: boolean) {
    return this.db.query(
      `SELECT n.id_notificacao AS id, n.tipo, n.mensagem, n.id_demanda AS "idDemanda",
              p.id_participacao AS "idParticipacao", n.data_envio AS "dataEnvio", n.lida
       FROM notificacao n
       LEFT JOIN participacao p ON p.id_demanda = n.id_demanda AND p.id_voluntario = n.id_usuario
       WHERE n.id_usuario = $1 AND n.canal = 'sistema' ${apenasNaoLidas ? 'AND n.lida = FALSE' : ''}
       ORDER BY n.data_envio DESC, n.id_notificacao DESC
       LIMIT 200`,
      [idUsuario],
    );
  }

  async contar(idUsuario: number) {
    const [r] = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM notificacao WHERE id_usuario = $1 AND canal = 'sistema' AND lida = FALSE`,
      [idUsuario],
    );
    return { naoLidas: r.total };
  }

  /** UC06: abrir marca como lida e devolve para onde levar o usuário. */
  async ler(idUsuario: number, id: number) {
    const [n] = await this.db.query(
      `UPDATE notificacao SET lida = TRUE
       WHERE id_notificacao = $1 AND id_usuario = $2 AND canal = 'sistema'
       RETURNING id_demanda AS "idDemanda"`,
      [id, idUsuario],
    );
    if (!n) throw new NotFoundException('Notificação não encontrada.');
    const [p] = n.idDemanda
      ? await this.db.query(
          `SELECT id_participacao AS id FROM participacao WHERE id_demanda = $1 AND id_voluntario = $2`,
          [n.idDemanda, idUsuario],
        )
      : [];
    return { ok: true, idDemanda: n.idDemanda, idParticipacao: p?.id ?? null };
  }

  async lerTodas(idUsuario: number) {
    await this.db.query(`UPDATE notificacao SET lida = TRUE WHERE id_usuario = $1 AND canal = 'sistema'`, [idUsuario]);
    return { ok: true };
  }
}
