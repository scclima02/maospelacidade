import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Perfis, Publico, Usuario, UsuarioSessao } from '../auth/auth.decorators';
import { AuthService } from '../auth/auth.service';
import { limparCookieSessao } from '../auth/sessao';
import { VoluntariosService } from './voluntarios.service';

@Controller()
export class CadastroController {
  constructor(
    private readonly servico: VoluntariosService,
    private readonly auth: AuthService,
  ) {}

  @Publico()
  @Post('voluntarios/cadastro')
  async cadastrar(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const id = await this.servico.cadastrar(body);
    await this.auth.emitirSessao(res, id);
    const p = await this.servico.obterPerfil(id);
    return { usuario: { id, nome: p.nome, email: p.email, perfil: 'voluntario' } };
  }

  /** Chamada pelo agendador da Vercel (header Authorization: Bearer CRON_SECRET). */
  @Publico()
  @Get('cron/retencao')
  async retencao(@Headers('authorization') autorizacao?: string) {
    const segredo = process.env.CRON_SECRET;
    if (!segredo || autorizacao !== `Bearer ${segredo}`) throw new ForbiddenException('Não autorizado.');
    return { anonimizados: await this.servico.anonimizarInativos() };
  }
}

@Controller('voluntarios/me')
@Perfis('voluntario')
export class VoluntariosController {
  constructor(private readonly servico: VoluntariosService) {}

  @Get()
  perfil(@Usuario() u: UsuarioSessao) {
    return this.servico.obterPerfil(u.id);
  }

  @Put()
  atualizar(@Usuario() u: UsuarioSessao, @Body() body: unknown) {
    return this.servico.atualizarPerfil(u.id, body);
  }

  @Post('consentimento')
  @HttpCode(200)
  aceitar(@Usuario() u: UsuarioSessao, @Body() body: unknown) {
    return this.servico.aceitarConsentimento(u.id, body);
  }

  @Delete('consentimento')
  revogar(@Usuario() u: UsuarioSessao) {
    return this.servico.revogarConsentimento(u.id);
  }

  @Post('excluir')
  @HttpCode(200)
  async excluir(@Usuario() u: UsuarioSessao, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const r = await this.servico.excluirConta(u.id, body);
    limparCookieSessao(res);
    return r;
  }

  @Get('historico')
  @Perfis('voluntario', 'gestor', 'administrador')
  historico(@Usuario() u: UsuarioSessao) {
    return this.servico.historico(u.id);
  }
}
