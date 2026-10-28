# 06 — Execução e deploy

## Variáveis de ambiente
| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | String de conexão do Neon (use a **pooled**, com `sslmode=require`) |
| `JWT_SECRET` | sim | Segredo longo e aleatório para assinar a sessão |
| `APP_URL` | sim em produção | URL pública (links dos e-mails), ex. `https://svgmunicipal.vercel.app` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | não | E-mail real. Sem SMTP, os e-mails são registrados como `ignorado` |
| `CRON_SECRET` | não | Protege `/api/cron/retencao` (a Vercel envia no header Authorization) |
| `SEED_DEMO` | não | `1` para carregar usuários e dados de demonstração no `db:seed` |

## Local
```
npm install
cp .env.example .env     # preencher DATABASE_URL e JWT_SECRET
npm run db:migrate       # cria tabelas (db/schema.sql) e catálogos iniciais
npm run db:seed          # dados de demonstração (usuários abaixo)
npm run start:dev        # http://localhost:3000
npm test                 # testes unitários + e2e (banco em memória)
```

## Neon
1. Criar projeto no Neon e copiar a connection string pooled.
2. Colocar em `DATABASE_URL` (local e na Vercel).
3. `npm run db:migrate` e `npm run db:seed` apontando para o banco do Neon.
4. **Backup (RNF03):** o Neon mantém histórico contínuo; restaurar para um ponto no tempo ou criar
   uma branch do estado de 24 h atrás pelo console do Neon.

## Vercel
1. Importar o repositório na Vercel (framework: *Other*).
2. Definir as variáveis de ambiente acima.
3. Deploy. `vercel.json` encaminha `/api/*` para a função `api/index.ts`; o resto sai de `public/`.
4. Cron diário de retenção definido em `vercel.json` (usa `CRON_SECRET`).

## Contas de demonstração (somente com `SEED_DEMO=1`)
| Perfil | E-mail | Senha |
|---|---|---|
| administrador | `admin@prefeitura.gov.br` | `Admin@123` |
| gestor | `gestor@prefeitura.gov.br` | `Gestor@123` |
| voluntário | `maria@exemplo.com` | `Voluntario@123` |
| voluntário | `joao@exemplo.com` | `Voluntario@123` |

Troque as senhas antes de uso real.
