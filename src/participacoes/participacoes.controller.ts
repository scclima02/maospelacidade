import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { Perfis, Usuario, UsuarioSessao } from '../auth/auth.decorators';
import { ParticipacoesService } from './participacoes.service';

@Controller()
@Perfis('voluntario')
export class ParticipacoesController {
  constructor(private readonly servico: ParticipacoesService) {}

  @Get('oportunidades')
  listar(@Usuario() u: UsuarioSessao, @Query() query: Record<string, any>) {
    return this.servico.listar(u.id, query);
  }

  @Get('oportunidades/explorar')
  explorar(@Usuario() u: UsuarioSessao, @Query() query: Record<string, any>) {
    return this.servico.explorar(u.id, query);
  }

  @Get('oportunidades/demanda/:idDemanda')
  obterPorDemanda(@Usuario() u: UsuarioSessao, @Param('idDemanda', ParseIntPipe) idDemanda: number) {
    return this.servico.obterPorDemanda(u.id, idDemanda);
  }

  @Post('oportunidades/demanda/:idDemanda/participar')
  @HttpCode(200)
  participar(@Usuario() u: UsuarioSessao, @Param('idDemanda', ParseIntPipe) idDemanda: number) {
    return this.servico.participar(u.id, idDemanda);
  }

  @Get('oportunidades/:id')
  obter(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number) {
    return this.servico.obter(u.id, id);
  }

  @Post('participacoes/:id/confirmar')
  @HttpCode(200)
  confirmar(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number) {
    return this.servico.responder(u.id, id, 'confirmar');
  }

  @Post('participacoes/:id/recusar')
  @HttpCode(200)
  recusar(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number) {
    return this.servico.responder(u.id, id, 'recusar');
  }

  @Post('participacoes/:id/cancelar')
  @HttpCode(200)
  cancelar(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number) {
    return this.servico.responder(u.id, id, 'cancelar');
  }

  @Get('participacoes/:id/certificado')
  async certificado(
    @Usuario() u: UsuarioSessao,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const bytes = await this.servico.certificado(u.id, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="certificado-participacao.pdf"',
    });
    return new StreamableFile(Buffer.from(bytes));
  }
}
