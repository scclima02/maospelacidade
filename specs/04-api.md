# 04 — Contrato da API REST

Prefixo `/api`. JSON UTF-8. Autenticação por cookie `sessao` (httpOnly); o frontend usa
`fetch(..., { credentials: 'same-origin' })`.

## Convenções
- **Erros:** `{ "statusCode": 400, "message": "texto" | ["texto1","texto2"], "error": "Bad Request" }`.
  401 sem sessão, 403 perfil sem permissão, 404 inexistente, 409 conflito (e-mail duplicado, vagas esgotadas), 422 regra de negócio.
- **Datas de resposta:** ISO 8601 UTC (`2026-11-05T12:00:00.000Z`). Exibir em `America/Sao_Paulo`.
- **Datas de entrada de demanda:** `dataInicio`/`dataFim` no formato `YYYY-MM-DDTHH:mm` (valor de `datetime-local`), interpretadas como horário de Brasília.
- **Horas de disponibilidade:** `HH:mm`. `diaSemana`: 0=domingo … 6=sábado.
- **IDs:** inteiros. Campos em camelCase.
- **Perfis:** `voluntario`, `gestor`, `administrador`. Coluna "Acesso": `*` = qualquer autenticado, `pub` = público.

## Autenticação (UC01, UC02)
| Método e rota | Acesso | Corpo → Resposta |
|---|---|---|
| POST `/auth/login` | pub | `{email, senha}` → `{usuario}` + cookie |
| POST `/auth/logout` | * | → `{ok:true}` |
| GET `/auth/me` | * | → `usuario` = `{id, nome, email, perfil}` |
| POST `/auth/recuperar-senha` | pub | `{email}` → `{mensagem}` (sempre 200) |
| POST `/auth/redefinir-senha` | pub | `{token, senha}` → `{mensagem}`; token inválido/expirado/usado → 422 |

## Público
| Rota | Resposta |
|---|---|
| GET `/publico/config` | `{nomeOrganizacao, termoVersao, termo:{titulo, finalidade, dadosColetados:[str], quemAcessa:[str], retencao, texto}}` |
| GET `/publico/estatisticas` | `{voluntarios, acoes, horas, areas}` agregados sem identificação (página inicial) |
| GET `/catalogos/areas` | `[{id, nome}]` só ativas |
| GET `/catalogos/regioes` | `[{id, nome}]` só ativas |
| GET `/certificados/validar/:codigo` | `{valido:true, nome, acao, data, horas}` ou 404 |
| GET `/saude` | `{status:'ok', banco:'ok'}` |

## Voluntário — cadastro e perfil (UC03, UC04, UC05, UC10)
| Método e rota | Acesso | Corpo → Resposta |
|---|---|---|
| POST `/voluntarios/cadastro` | pub | `{nome,email,telefone,senha,idRegiao,areas:[idArea],disponibilidades:[{diaSemana,horaInicio,horaFim}],aceiteTermo}` → 201 `{usuario}` + cookie (login automático) |
| GET `/voluntarios/me` | voluntario | → `{id,nome,email,telefone,idRegiao,regiao,areas:[idArea],disponibilidades:[{diaSemana,horaInicio,horaFim}],consentimento:{vigente,versao,dataAceite,dataRevogacao}}` |
| PUT `/voluntarios/me` | voluntario | mesmo corpo do cadastro sem `senha` e `aceiteTermo` → perfil atualizado |
| POST `/voluntarios/me/consentimento` | voluntario | `{aceite:true}` → consentimento |
| DELETE `/voluntarios/me/consentimento` | voluntario | → consentimento (revogado) |
| POST `/voluntarios/me/excluir` | voluntario | `{senha}` → `{ok:true}` + limpa cookie |
| GET `/voluntarios/me/historico` | voluntario | → `{totais:{acoes,horas,faltas}, itens:[{idParticipacao,idDemanda,titulo,area,data,situacao,horas,codigoCertificado}]}` |
| GET `/participacoes/:id/certificado` | voluntario dono | → `application/pdf` (cria o certificado se ainda não existir; 422 se não `compareceu`) |

## Oportunidades e participação (UC06, UC07)
`Oportunidade` = `{idParticipacao,idDemanda,titulo,descricao,area,regiao,local,dataInicio,dataFim,vagas,situacao,pontuacao,situacaoDemanda}`; `situacao` é a da participação.

| Método e rota | Acesso | Notas |
|---|---|---|
| GET `/oportunidades?idArea&idRegiao&de&ate&situacao` | voluntario | `de`/`ate` = `YYYY-MM-DD`. Padrão: demandas abertas, situações sugerida/confirmada/selecionada → `[Oportunidade]` |
| GET `/oportunidades/explorar?escopo&idArea&idRegiao&de&ate&busca` | voluntario | RN20b. `escopo` = `recomendadas` (padrão) ou `todas` → `[{idDemanda,idParticipacao\|null,situacao\|null,titulo,descricao,idArea,area,idRegiao,regiao,local,dataInicio,dataFim,vagas,organizacao,link,mesmaArea,mesmaRegiao,ocupadas}]` |
| GET `/oportunidades/demanda/:idDemanda` | voluntario | → `Oportunidade` (com `idParticipacao`/`situacao` nulos se ainda não houver participação) |
| POST `/oportunidades/demanda/:idDemanda/participar` | voluntario | RN20c → `Oportunidade` com `situacao = confirmada` |
| GET `/oportunidades/:idParticipacao` | voluntario dono | → `Oportunidade` |
| POST `/participacoes/:id/confirmar` | voluntario dono | RN21 → `Oportunidade` |
| POST `/participacoes/:id/recusar` | voluntario dono | RN21 → `Oportunidade` |
| POST `/participacoes/:id/cancelar` | voluntario dono | RN21 → `Oportunidade` |

## Notificações (UC06, UC13)
| Rota | Notas |
|---|---|
| GET `/notificacoes?naoLidas=1` | só canal `sistema` do usuário → `[{id,tipo,mensagem,idDemanda,idParticipacao,dataEnvio,lida}]` (`idParticipacao` preenchido para voluntário quando existir) |
| GET `/notificacoes/contagem` | → `{naoLidas}` |
| POST `/notificacoes/:id/ler` | marca lida → `{ok, idDemanda, idParticipacao}` |
| POST `/notificacoes/ler-todas` | → `{ok}` |

## Demandas — gestor/administrador (UC11, UC14, UC15, UC16, UC17, UC18)
`Demanda` = `{id,titulo,descricao,idArea,area,idRegiao,regiao,local,dataInicio,dataFim,vagas,situacao,organizacao,link,idGestor,gestor,totais:{sugeridas,confirmadas,selecionadas,compareceram,faltaram},podeEditar,podeExcluir}`.
As rotas de escrita aceitam o gestor dono **ou** qualquer administrador (RN12).

| Método e rota | Acesso | Corpo → Resposta |
|---|---|---|
| POST `/demandas` | gestor, administrador | `{titulo,descricao,idArea,idRegiao,local,dataInicio,dataFim,vagas,organizacao?,link?}` → 201 `{demanda, compativeis}` |
| DELETE `/demandas/:id` | administrador | exclusão definitiva → `{ok:true}` |
| GET `/demandas?idArea&idRegiao&de&ate&situacao&minhas=1&busca` | gestor, administrador | → `[Demanda]` (todas; `minhas=1` filtra as do gestor logado) |
| GET `/demandas/:id` | gestor, administrador | → `Demanda` |
| PUT `/demandas/:id` | gestor dono, administrador | mesmo corpo do POST → `Demanda` (RN13b) |
| POST `/demandas/:id/cancelar` | gestor dono | → `Demanda` |
| GET `/demandas/:id/voluntarios` | gestor, administrador | → `[{idParticipacao,idVoluntario,nome,regiao,mesmaRegiao,situacao,pontuacao,taxaComparecimento,horasRealizadas,email,telefone}]` ordenado (RN17); `email`/`telefone` = `null` fora de RN22 |
| GET `/voluntarios/:id/resumo` | gestor, administrador | → `{nome,participacoes,horas,faltas,taxaComparecimento,ultimas:[{titulo,data,situacao,horas}]}` (RN23) |
| POST `/demandas/:id/selecionar` | gestor dono | `{idParticipacoes:[...]}` → lista de voluntários; 409 se exceder vagas |
| POST `/demandas/:id/desselecionar` | gestor dono | `{idParticipacao}` → volta a `confirmada` |
| POST `/demandas/:id/presencas` | gestor dono | `{registros:[{idParticipacao,compareceu,horas?}]}` → `Demanda` |

## Administração (UC19–UC22)
| Método e rota | Corpo → Resposta |
|---|---|
| GET `/admin/usuarios?perfil&situacao&busca` | → `[{id,nome,email,telefone,perfil,situacao,dataCadastro,organizacao,cargo}]` |
| POST `/admin/usuarios` | `{nome,email,telefone?,senha,perfil:'gestor'\|'administrador',organizacao?,cargo?}` → 201 usuário |
| PUT `/admin/usuarios/:id` | `{nome?,perfil?,situacao?:'ativo'\|'inativo',organizacao?,cargo?}` → usuário |
| POST `/admin/usuarios/:id/redefinir-acesso` | → `{senhaTemporaria}` (exibida uma vez) |
| DELETE `/admin/usuarios/:id` | exclusão definitiva (não a própria conta); demandas do usuário passam ao administrador → `{ok:true}` |
| GET `/admin/areas`, `/admin/regioes` | → `[{id,nome,ativo}]` (todas) |
| POST `/admin/areas`, `/admin/regioes` | `{nome}` → 201 item |
| PUT `/admin/areas/:id`, `/admin/regioes/:id` | `{nome?,ativo?}` → item |
| DELETE `/admin/areas/:id`, `/admin/regioes/:id` | exclusão definitiva; 409 se houver demandas usando o item → `{ok:true}` |
| GET `/admin/config` / PUT `/admin/config` | `{pesoBase,pesoRegiao,retencaoMeses,nomeOrganizacao}` |
| GET `/admin/indicadores?de&ate` | → `{voluntariosAtivos,demandasAbertas,demandasConcluidas,participacoes,horas,taxaComparecimento,demandasPorMes:[{mes,total}],voluntariosPorArea:[{area,total}]}` |
| GET `/admin/relatorios/engajamento?de&ate&idArea&idRegiao` | → `{filtros,porAreaRegiao:[{area,regiao,voluntarios}],acoes:[{idDemanda,titulo,data,area,regiao,horas,presencas,faltas}],totais:{demandas,presencas,faltas,horas}}` |
| GET `/admin/relatorios/engajamento.pdf?…` | → `application/pdf` |

## Rotina agendada
| Rota | Acesso | Efeito |
|---|---|---|
| GET `/cron/retencao` | header `Authorization: Bearer $CRON_SECRET` | Anonimiza voluntários inativos além de `retencao_meses` (RN28) → `{anonimizados}` |
