# 00 — Visão geral e stack

## Objetivo
Aplicação web para mobilizar voluntários em demandas pontuais de uma prefeitura: o cidadão
se cadastra com área de interesse, disponibilidade e região; o gestor cadastra demandas; o
sistema cruza perfis e demandas, notifica os compatíveis e mantém histórico de horas,
certificados, indicadores e relatórios.

## Perfis (atores)
| Perfil | Papel |
|---|---|
| `voluntario` | Cadastra-se, mantém perfil, responde oportunidades, vê histórico, emite certificado, exclui a conta |
| `gestor` | Cadastra/edita/cancela demandas, consulta compatíveis, seleciona voluntários, registra presença |
| `administrador` | Gerencia usuários, áreas, regiões, configurações, painel e relatórios |

## Stack (adaptação do projeto original PHP/MySQL)
| Projeto original | Esta implementação | Motivo |
|---|---|---|
| PHP 8 | Node 20+ / NestJS 10 (TypeScript) | Requisito do cliente |
| MySQL 8 | PostgreSQL no Neon | Requisito do cliente |
| PDO + consultas parametrizadas | `pg` + consultas parametrizadas (`$1, $2…`) | Mesma garantia contra SQL Injection |
| PHPMailer | Nodemailer (SMTP configurável) | Equivalente em Node |
| FPDF | pdf-lib | PDF puro JS, sem arquivos de fonte (ok em serverless) |
| Apache/XAMPP | `nest start` local; Vercel em produção | Deploy |
| HTML5/CSS3/JS, Bootstrap 5, Chart.js | Idem (SPA estática em `public/`) | Mantido |
| `password_hash` | bcryptjs | Hash de senha |

## Arquitetura (RNF Manutenibilidade — camadas)
```
Controller (apresentação/HTTP + validação DTO)
  → Service (regras de negócio)
    → Repository/DatabaseService (SQL parametrizado)
```
Módulos Nest: `auth`, `usuarios`, `voluntarios`, `catalogos` (áreas/regiões), `demandas`,
`participacoes`, `notificacoes`, `certificados`, `indicadores`, `relatorios`, `config`, `mail`, `pdf`.

## Decisões
- **Sessão:** JWT em cookie `httpOnly` + `SameSite=Lax` + `Secure` em produção; expira por
  inatividade (30 min), renovado a cada requisição autenticada (sessão deslizante).
- **Fuso:** todas as datas de ação são interpretadas em `America/Sao_Paulo`; o banco guarda `timestamptz`.
- **Frontend:** SPA com roteamento por hash servida de `public/`; consome `/api/*`.
- **Vercel:** função serverless única (`api/index.ts`) que embute o app Nest; estáticos servidos de `public/`.
- **Backup (RNF Confiabilidade):** o Neon mantém histórico contínuo (point-in-time restore) e
  permite branches; a rotina equivalente ao "backup a cada 24 h" é o restore/branch do Neon
  (documentado em `06-deploy.md`). Não há job próprio de dump.
- **Sem rastro de e-mail real obrigatório:** se SMTP não estiver configurado, o envio de
  e-mail é registrado como `ignorado` e o aviso dentro do sistema continua funcionando.

## Convenções do spec-driven
1. Toda funcionalidade nasce em `specs/` (caso de uso → API → regras).
2. `specs/07-rastreabilidade.md` liga cada UC/RF/RNF a endpoint, tela e teste.
3. Código e testes devem refletir os identificadores `UCxx`/`RNxx` citados nos specs.
