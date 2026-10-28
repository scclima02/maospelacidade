import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { Validador } from '../common/validador';
import { Publico, Usuario, UsuarioSessao } from './auth.decorators';
import { AuthService } from './auth.service';
import { limparCookieSessao } from './sessao';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const v = new Validador(body);
    const email = v.texto('email', 'E-mail', { max: 190 });
    const senha = typeof body?.senha === 'string' ? body.senha : undefined;
    if (!senha) v.erro('Senha é obrigatória.');
    v.concluir();
    return this.auth.login(email!.toLowerCase(), senha!, res);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    limparCookieSessao(res);
    return { ok: true };
  }

  @Get('me')
  me(@Usuario() u: UsuarioSessao) {
    return u;
  }

  @Publico()
  @Post('recuperar-senha')
  @HttpCode(200)
  recuperar(@Body() body: any) {
    const v = new Validador(body);
    const email = v.email();
    v.concluir();
    return this.auth.recuperarSenha(email!);
  }

  @Publico()
  @Post('redefinir-senha')
  @HttpCode(200)
  redefinir(@Body() body: any) {
    const v = new Validador(body);
    const token = v.texto('token', 'Token', { max: 200 });
    const senha = v.senha();
    v.concluir();
    return this.auth.redefinirSenha(token!, senha!);
  }
}
