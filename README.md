# Mãos pela Cidade

*Plataforma de voluntariado comunitário.*

Projeto Tecnológico em Desenvolvimento de Sistemas (ULBRA EAD): aplicação web para mobilizar
voluntários em ações pontuais de uma organização comunitária. O cidadão se cadastra com áreas de interesse,
disponibilidade e região; o gestor cadastra demandas; o sistema cruza perfis e demandas, notifica os
compatíveis e mantém histórico de horas, certificados, indicadores e relatórios.

**Stack:** Node 20+ · NestJS 10 (TypeScript) · PostgreSQL no Neon (`pg`, consultas parametrizadas) ·
frontend estático (HTML5, Bootstrap 5, Chart.js, JavaScript) · pdf-lib · Nodemailer · deploy na Vercel.

## Acesso público

Sistema publicado em **https://svgmunicipal.vercel.app** (Vercel + banco no Neon). Veja as contas de teste abaixo.

## Desenvolvimento orientado a especificação

Tudo nasce em [`specs/`](specs), que é a fonte de verdade do código:

| Arquivo | Conteúdo |
|---|---|
| [00-visao-e-stack](specs/00-visao-e-stack.md) | Objetivo, perfis, stack, decisões de arquitetura |
| [01-requisitos](specs/01-requisitos.md) | RF01–RF23 e RNF01–RNF12 |
| [02-regras-de-negocio](specs/02-regras-de-negocio.md) | Regras verificáveis RN01–RN33 por caso de uso |
| [03-modelo-de-dados](specs/03-modelo-de-dados.md) | Tabelas (ER do projeto + acréscimos justificados) |
| [04-api](specs/04-api.md) | Contrato da API REST |
| [05-telas](specs/05-telas.md) | Telas e navegação |
| [06-deploy](specs/06-deploy.md) | Variáveis, Neon, Vercel, contas de demonstração |
| [07-rastreabilidade](specs/07-rastreabilidade.md) | UC → endpoint → tela → status |

## Executar localmente

```bash
npm install
cp .env.example .env      # preencher DATABASE_URL (Neon) e JWT_SECRET
npm run db:migrate        # cria as tabelas e os catálogos iniciais
SEED_DEMO=1 npm run db:seed   # administrador inicial + dados de demonstração
npm run start:dev         # http://localhost:3000
npm test                  # unitários + fluxo completo (Postgres embutido, não usa o Neon)
```

No PowerShell use `$env:SEED_DEMO=1; npm run db:seed`.

## Contas de demonstração (`SEED_DEMO=1`)

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@maospelacidade.org` | definida em `ADMIN_SENHA` no seed (a do site publicado não está neste repositório) |
| Gestor | `gestor@maospelacidade.org` | `Gestor@123` |
| Voluntário | `maria@exemplo.com` | `Voluntario@123` |
| Voluntário | `joao@exemplo.com` | `Voluntario@123` |

Em produção defina `ADMIN_EMAIL` e `ADMIN_SENHA` antes do `db:seed`. Passo a passo de Neon e Vercel em
[specs/06-deploy.md](specs/06-deploy.md).

## Orientações para análise do código

```
db/            schema.sql (script do banco), migrate.mjs, seed.mjs
src/
  common/      banco, validação, datas (horário de Brasília), e-mail, PDF, configuração
  auth/        login, sessão em cookie, guard global e controle de perfis
  voluntarios/ UC03–UC05, UC08, UC10 (cadastro, perfil, consentimento, exclusão, histórico)
  demandas/    UC11–UC18; cruzamento.ts é a função pura do UC12 (testada isoladamente)
  participacoes/  UC06, UC07, UC09 (oportunidades, resposta, certificado)
  notificacoes/   UC13 (aviso no sistema + e-mail, com registro de cada envio)
  admin/       UC19–UC22 (usuários, catálogos, configuração, indicadores, relatórios)
  publico/     configuração pública, catálogos, validação de certificado, saúde
public/        SPA (index.html, js/, css/)
test/          fluxo.e2e.spec.ts percorre os 22 casos de uso contra um Postgres embutido
api/index.js   entrada da função serverless da Vercel
```

Arquitetura em camadas (RNF11): controller (HTTP e validação do corpo) → service (regras de negócio) →
SQL parametrizado. Controle de perfis por `@Perfis(...)`, aplicado pelo guard global.

## Funções propostas × implementadas

| Função proposta | Status |
|---|---|
| UC01 Realizar login | Implementada |
| UC02 Recuperar senha | Implementada (e-mail real requer SMTP; sem SMTP o envio é registrado como "ignorado") |
| UC03 Cadastrar-se como voluntário | Implementada |
| UC04 Registrar consentimento (LGPD) | Implementada |
| UC05 Editar perfil e disponibilidade | Implementada |
| UC06 Consultar oportunidades e notificações | Implementada |
| UC07 Confirmar ou recusar participação | Implementada |
| UC08 Consultar histórico e horas | Implementada |
| UC09 Emitir certificado de participação | Implementada |
| UC10 Excluir conta e dados (LGPD) | Implementada |
| UC11 Cadastrar demanda | Implementada |
| UC12 Cruzar perfis e demandas | Implementada |
| UC13 Notificar voluntários compatíveis | Implementada |
| UC14 Editar ou cancelar demanda | Implementada |
| UC15 Consultar voluntários compatíveis | Implementada |
| UC16 Consultar histórico do voluntário | Implementada |
| UC17 Selecionar voluntários | Implementada |
| UC18 Registrar presença e horas | Implementada |
| UC19 Gerenciar usuários e perfis | Implementada |
| UC20 Gerenciar áreas e regiões | Implementada |
| UC21 Visualizar painel de indicadores | Implementada |
| UC22 Gerar relatórios de engajamento | Implementada |
| RNF03 Backup automático a cada 24 h | Implementada em partes: usa o histórico contínuo do Neon (restauração para qualquer ponto no tempo); não há job próprio de dump |

## Adaptações em relação ao projeto original

PHP/MySQL/PHPMailer/FPDF/XAMPP foram substituídos por Node/NestJS/PostgreSQL (Neon)/Nodemailer/pdf-lib/Vercel,
mantendo as mesmas funções. O ER recebeu acréscimos justificados em
[specs/03-modelo-de-dados.md](specs/03-modelo-de-dados.md) (redefinição de senha, configuração, último acesso e
status de envio de notificação).
