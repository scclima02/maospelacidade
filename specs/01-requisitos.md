# 01 — Requisitos

Fonte: PDF "Levantamento de Requisitos". Cada item recebe um identificador estável.

## Funcionais
| ID | Requisito | UC |
|---|---|---|
| RF01 | Login com e-mail e senha para voluntário, gestor e administrador | UC01 |
| RF02 | Cadastro próprio do voluntário (nome, e-mail, telefone, senha, região, áreas, disponibilidade) | UC03 |
| RF03 | Verificar e-mail duplicado antes de concluir o cadastro | UC03 |
| RF04 | Voluntário edita dados, áreas, disponibilidade e região a qualquer momento | UC05 |
| RF05 | Recuperação de senha por e-mail | UC02 |
| RF06 | Gestor autorizado cadastra demanda (descrição, área, período, região, nº de voluntários) | UC11 |
| RF07 | Gestor edita ou cancela demanda não concluída | UC14 |
| RF08 | Cruzamento automático perfil × demanda gerando lista de compatíveis | UC12 |
| RF09 | Notificação automática dos voluntários compatíveis | UC13 |
| RF10 | Voluntário vê oportunidades e confirma/recusa | UC06, UC07 |
| RF11 | Gestor vê compatíveis e seleciona os participantes | UC15, UC17 |
| RF12 | Verificar limite de vagas antes de confirmar seleção | UC17 |
| RF13 | Gestor consulta histórico do voluntário antes de selecionar | UC16 |
| RF14 | Gestor registra presença e horas ao final da ação | UC18 |
| RF15 | Histórico de participação com total de ações e horas | UC08 |
| RF16 | Painel administrativo de indicadores | UC21 |
| RF17 | Relatórios de engajamento filtráveis por período, área e região | UC22 |
| RF18 | Voluntário e gestor pesquisam/filtram demandas por área, região e período | UC06, UC15 |
| RF19 | Validação de campos obrigatórios nos formulários de voluntário e demanda | UC03, UC11 |
| RF20 | Certificado de participação por ação concluída com presença | UC09 |
| RF21 | Consentimento LGPD no cadastro, com revogação | UC04 |
| RF22 | Exclusão de conta/dados com anonimização | UC10 |
| RF23 | Administrador gerencia usuários/perfis e cadastros de áreas e regiões | UC19, UC20 |

## Não funcionais
| ID | Requisito | Como é atendido |
|---|---|---|
| RNF01 | Resposta ≤ 10 s, inclusive o cruzamento | Cruzamento feito em uma consulta SQL por demanda, com índices |
| RNF02 | Interface responsiva (mobile, tablet, desktop) | Bootstrap 5, layout fluido |
| RNF03 | Backup a cada 24 h | Neon PITR/branches (ver `06-deploy.md`) |
| RNF04 | Disponibilidade 24×7 | Vercel + Neon (serverless) |
| RNF05 | Senhas com hash | bcryptjs (custo 10) |
| RNF06 | Controle de perfis | Guard de papéis (`@Roles`) em cada rota |
| RNF07 | Prevenção de SQL Injection | Somente consultas parametrizadas |
| RNF08 | HTML/CSS/JS + back-end + SGBD | Adaptado: Node/NestJS + PostgreSQL (ver `00`) |
| RNF09 | Chrome e Firefox atuais | JS moderno sem dependências proprietárias |
| RNF10 | Escalabilidade | Índices nas chaves de cruzamento; serverless |
| RNF11 | Código em camadas | Controller → Service → acesso a dados |
| RNF12 | Nome/logotipo da organização em todas as telas | Cabeçalho/rodapé fixos; nome vindo de `configuracao` |
