import { Response } from 'express';

export const COOKIE_SESSAO = 'sessao';
export const SESSAO_MS = 30 * 60 * 1000; // expira após 30 min de inatividade

export function definirCookieSessao(res: Response, token: string) {
  res.cookie(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!process.env.VERCEL || process.env.NODE_ENV === 'production',
    maxAge: SESSAO_MS,
    path: '/',
  });
}

export function limparCookieSessao(res: Response) {
  res.clearCookie(COOKIE_SESSAO, { path: '/' });
}
