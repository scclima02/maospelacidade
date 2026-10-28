import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../common/database.service';
import { IS_PUBLIC, Perfil, ROLES } from './auth.decorators';
import { COOKIE_SESSAO, definirCookieSessao } from './sessao';

/**
 * Guard global: valida o cookie de sessão, confere se a conta continua ativa,
 * renova a sessão (expiração por inatividade) e aplica o controle de perfis.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    const publico = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, alvos);
    const perfis = this.reflector.getAllAndOverride<Perfil[]>(ROLES, alvos);
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();

    let usuario: any = null;
    const token = req.cookies?.[COOKIE_SESSAO];
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: number }>(token);
        const linhas = await this.db.query(
          `SELECT id_usuario AS id, nome, email, perfil FROM usuario WHERE id_usuario = $1 AND situacao = 'ativo'`,
          [payload.sub],
        );
        usuario = linhas[0] ?? null;
      } catch {
        usuario = null;
      }
    }

    if (!usuario) {
      if (publico) return true;
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    req.user = usuario;
    definirCookieSessao(res, await this.jwt.signAsync({ sub: usuario.id }));

    if (perfis && !perfis.includes(usuario.perfil)) {
      throw new ForbiddenException('Você não tem permissão para acessar este recurso.');
    }
    return true;
  }
}
