import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash, hashSync } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { Response } from 'express';
import { DatabaseService } from '../common/database.service';
import { MailService } from '../common/mail.service';
import { definirCookieSessao } from './sessao';

const MENSAGEM_LOGIN = 'E-mail ou senha inválidos.';
const DUMMY_HASH = hashSync('senha-inexistente', 10);

export const hashSenha = (senha: string) => hash(senha, 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async emitirSessao(res: Response, idUsuario: number) {
    definirCookieSessao(res, await this.jwt.signAsync({ sub: idUsuario }));
  }

  async login(email: string, senha: string, res: Response) {
    const [u] = await this.db.query(
      `SELECT id_usuario AS id, nome, email, perfil, senha_hash, situacao FROM usuario WHERE email = $1`,
      [email],
    );
    // compara sempre, para não revelar por tempo de resposta se o e-mail existe
    const confere = await compare(senha, u?.senha_hash ?? DUMMY_HASH);
    if (!u || !confere || u.situacao !== 'ativo') throw new UnauthorizedException(MENSAGEM_LOGIN);

    await this.db.query('UPDATE usuario SET ultimo_acesso = now() WHERE id_usuario = $1', [u.id]);
    await this.emitirSessao(res, u.id);
    return { usuario: { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil } };
  }

  async recuperarSenha(email: string) {
    const [u] = await this.db.query(
      `SELECT id_usuario AS id, nome, email FROM usuario WHERE email = $1 AND situacao = 'ativo'`,
      [email],
    );
    if (u) {
      const token = randomBytes(32).toString('hex');
      await this.db.query(
        `INSERT INTO redefinicao_senha (id_usuario, token_hash, expira_em)
         VALUES ($1, $2, now() + interval '1 hour')`,
        [u.id, this.hashToken(token)],
      );
      const base = process.env.APP_URL ?? 'http://localhost:3000';
      await this.mail.enviar(
        u.email,
        'Redefinição de senha',
        `Olá, ${u.nome}.\n\nPara definir uma nova senha acesse o link abaixo (válido por 1 hora e de uso único):\n${base}/#/redefinir-senha?token=${token}\n\nSe você não pediu a redefinição, ignore esta mensagem.`,
      );
    }
    return { mensagem: 'Se o e-mail estiver cadastrado, enviaremos as instruções de redefinição.' };
  }

  async redefinirSenha(token: string, novaSenha: string) {
    const senhaHash = await hashSenha(novaSenha);
    const atualizado = await this.db.tx(async (tx) => {
      const [r] = await tx.query(
        `UPDATE redefinicao_senha SET usado_em = now()
         WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > now()
         RETURNING id_usuario`,
        [this.hashToken(token)],
      );
      if (!r) return false;
      await tx.query('UPDATE usuario SET senha_hash = $1 WHERE id_usuario = $2', [senhaHash, r.id_usuario]);
      return true;
    });
    if (!atualizado) throw new UnprocessableEntityException('Link inválido, expirado ou já utilizado.');
    return { mensagem: 'Senha redefinida com sucesso. Faça login com a nova senha.' };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
