import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { Perfis, Usuario, UsuarioSessao } from '../auth/auth.decorators';
import { DemandasService } from './demandas.service';

@Controller()
@Perfis('gestor', 'administrador')
export class DemandasController {
  constructor(private readonly servico: DemandasService) {}

  @Post('demandas')
  @Perfis('gestor')
  criar(@Usuario() u: UsuarioSessao, @Body() body: unknown) {
    return this.servico.criar(u, body);
  }

  @Get('demandas')
  listar(@Usuario() u: UsuarioSessao, @Query() query: Record<string, any>) {
    return this.servico.listar(u, query);
  }

  @Get('demandas/:id')
  obter(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number) {
    return this.servico.obter(id, u);
  }

  @Put('demandas/:id')
  @Perfis('gestor')
  atualizar(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.servico.atualizar(u, id, body);
  }

  @Post('demandas/:id/cancelar')
  @Perfis('gestor')
  @HttpCode(200)
  cancelar(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number) {
    return this.servico.cancelar(u, id);
  }

  @Get('demandas/:id/voluntarios')
  voluntarios(@Param('id', ParseIntPipe) id: number) {
    return this.servico.voluntarios(id);
  }

  @Get('voluntarios/:id/resumo')
  resumo(@Param('id', ParseIntPipe) id: number) {
    return this.servico.resumoVoluntario(id);
  }

  @Post('demandas/:id/selecionar')
  @Perfis('gestor')
  @HttpCode(200)
  selecionar(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.servico.selecionar(u, id, body);
  }

  @Post('demandas/:id/desselecionar')
  @Perfis('gestor')
  @HttpCode(200)
  desselecionar(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.servico.desselecionar(u, id, body);
  }

  @Post('demandas/:id/presencas')
  @Perfis('gestor')
  @HttpCode(200)
  presencas(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.servico.registrarPresencas(u, id, body);
  }
}
