import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Usuario, UsuarioSessao } from '../auth/auth.decorators';
import { NotificacoesService } from './notificacoes.service';

@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly servico: NotificacoesService) {}

  @Get()
  listar(@Usuario() u: UsuarioSessao, @Query('naoLidas') naoLidas?: string) {
    return this.servico.listar(u.id, naoLidas === '1' || naoLidas === 'true');
  }

  @Get('contagem')
  contar(@Usuario() u: UsuarioSessao) {
    return this.servico.contar(u.id);
  }

  @Post('ler-todas')
  @HttpCode(200)
  lerTodas(@Usuario() u: UsuarioSessao) {
    return this.servico.lerTodas(u.id);
  }

  @Post(':id/ler')
  @HttpCode(200)
  ler(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number) {
    return this.servico.ler(u.id, id);
  }
}
