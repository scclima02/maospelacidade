import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { Perfis, Usuario, UsuarioSessao } from '../auth/auth.decorators';
import { AdminService } from './admin.service';
import { RelatoriosService } from './relatorios.service';

@Controller('admin')
@Perfis('administrador')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly relatorios: RelatoriosService,
  ) {}

  // UC19
  @Get('usuarios')
  usuarios(@Query() q: Record<string, any>) {
    return this.admin.listarUsuarios(q);
  }

  @Post('usuarios')
  criarUsuario(@Body() body: unknown) {
    return this.admin.criarUsuario(body);
  }

  @Put('usuarios/:id')
  atualizarUsuario(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.admin.atualizarUsuario(u, id, body);
  }

  @Delete('usuarios/:id')
  excluirUsuario(@Usuario() u: UsuarioSessao, @Param('id', ParseIntPipe) id: number) {
    return this.admin.excluirUsuario(u, id);
  }

  @Post('usuarios/:id/redefinir-acesso')
  @HttpCode(200)
  redefinirAcesso(@Param('id', ParseIntPipe) id: number) {
    return this.admin.redefinirAcesso(id);
  }

  // UC20
  @Get('areas')
  areas() {
    return this.admin.listarCatalogo('areas');
  }

  @Post('areas')
  criarArea(@Body() body: unknown) {
    return this.admin.criarCatalogo('areas', body);
  }

  @Put('areas/:id')
  atualizarArea(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.admin.atualizarCatalogo('areas', id, body);
  }

  @Delete('areas/:id')
  excluirArea(@Param('id', ParseIntPipe) id: number) {
    return this.admin.excluirCatalogo('areas', id);
  }

  @Get('regioes')
  regioes() {
    return this.admin.listarCatalogo('regioes');
  }

  @Post('regioes')
  criarRegiao(@Body() body: unknown) {
    return this.admin.criarCatalogo('regioes', body);
  }

  @Put('regioes/:id')
  atualizarRegiao(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.admin.atualizarCatalogo('regioes', id, body);
  }

  @Delete('regioes/:id')
  excluirRegiao(@Param('id', ParseIntPipe) id: number) {
    return this.admin.excluirCatalogo('regioes', id);
  }

  // Configurações
  @Get('config')
  config() {
    return this.admin.obterConfig();
  }

  @Put('config')
  atualizarConfig(@Body() body: unknown) {
    return this.admin.atualizarConfig(body);
  }

  // UC21 / UC22
  @Get('indicadores')
  indicadores(@Query() q: Record<string, any>) {
    return this.relatorios.indicadores(q);
  }

  @Get('relatorios/engajamento')
  engajamento(@Query() q: Record<string, any>) {
    return this.relatorios.engajamento(q);
  }

  @Get('relatorios/engajamento.pdf')
  async engajamentoPdf(@Query() q: Record<string, any>, @Res({ passthrough: true }) res: Response) {
    const bytes = await this.relatorios.engajamentoPdf(q);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="relatorio-engajamento.pdf"',
    });
    return new StreamableFile(Buffer.from(bytes));
  }
}
