import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export type Perfil = 'voluntario' | 'gestor' | 'administrador';

export interface UsuarioSessao {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
}

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Rota acessível sem login. */
export const Publico = () => SetMetadata(IS_PUBLIC, true);

/** Restringe a rota aos perfis informados (sem @Perfis, qualquer autenticado acessa). */
export const Perfis = (...perfis: Perfil[]) => SetMetadata(ROLES, perfis);

export const Usuario = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioSessao => {
  return ctx.switchToHttp().getRequest().user;
});
