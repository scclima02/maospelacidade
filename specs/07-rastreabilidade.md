# 07 — Rastreabilidade e andamento

Status: ☐ pendente · ◐ em andamento · ☑ concluído

| UC | Descrição | Endpoint(s) | Tela | Status |
|---|---|---|---|---|
| UC01 | Realizar login | POST /auth/login | #/login | ☐ |
| UC02 | Recuperar senha | POST /auth/recuperar-senha, /auth/redefinir-senha | #/recuperar-senha | ☐ |
| UC03 | Cadastrar-se como voluntário | POST /voluntarios/cadastro | #/cadastro | ☐ |
| UC04 | Registrar consentimento | (incluído no UC03), POST/DELETE /voluntarios/me/consentimento | #/cadastro, #/perfil | ☐ |
| UC05 | Editar perfil e disponibilidade | GET/PUT /voluntarios/me | #/perfil | ☐ |
| UC06 | Consultar oportunidades e notificações | GET /oportunidades, /notificacoes | #/oportunidades, #/notificacoes | ☐ |
| UC07 | Confirmar ou recusar participação | POST /participacoes/:id/{confirmar,recusar,cancelar} | #/oportunidades/:id | ☐ |
| UC08 | Consultar histórico e horas | GET /voluntarios/me/historico | #/historico | ☐ |
| UC09 | Emitir certificado | GET /participacoes/:id/certificado | #/historico | ☐ |
| UC10 | Excluir conta e dados | POST /voluntarios/me/excluir, GET /cron/retencao | #/perfil | ☐ |
| UC11 | Cadastrar demanda | POST /demandas | #/demandas/nova | ☐ |
| UC12 | Cruzar perfis e demandas | (interno ao UC11/UC14) | — | ☐ |
| UC13 | Notificar compatíveis | (interno ao UC11/UC14) | — | ☐ |
| UC14 | Editar ou cancelar demanda | PUT /demandas/:id, POST /demandas/:id/cancelar | #/demandas/:id/editar | ☐ |
| UC15 | Consultar voluntários compatíveis | GET /demandas/:id/voluntarios | #/demandas/:id | ☐ |
| UC16 | Consultar histórico do voluntário | GET /voluntarios/:id/resumo | #/demandas/:id (modal) | ☐ |
| UC17 | Selecionar voluntários | POST /demandas/:id/selecionar | #/demandas/:id | ☐ |
| UC18 | Registrar presença e horas | POST /demandas/:id/presencas | #/demandas/:id | ☐ |
| UC19 | Gerenciar usuários e perfis | /admin/usuarios | #/admin/usuarios | ☐ |
| UC20 | Gerenciar áreas e regiões | /admin/areas, /admin/regioes | #/admin/catalogos | ☐ |
| UC21 | Painel de indicadores | GET /admin/indicadores | #/admin/painel | ☐ |
| UC22 | Relatórios de engajamento | GET /admin/relatorios/engajamento(.pdf) | #/admin/relatorios | ☐ |

Requisitos não funcionais: ver tabela em `01-requisitos.md`.
