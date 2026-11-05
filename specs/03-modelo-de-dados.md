# 03 — Modelo de dados (PostgreSQL / Neon)

Base: Diagrama ER do projeto (Figura 2). Script executável: `db/schema.sql`.

## Tabelas do ER original
| Tabela | Campos | Observações |
|---|---|---|
| `usuario` | id_usuario PK, nome, email UK, senha_hash, telefone, perfil, situacao, data_cadastro, data_exclusao | `perfil` ∈ voluntario, gestor, administrador. `situacao` ∈ ativo, inativo, excluido |
| `voluntario` | id_usuario PK/FK, id_regiao FK | Especialização 1:1 de `usuario` |
| `gestor` | id_usuario PK/FK, organizacao, cargo | Especialização 1:1 de `usuario` |
| `regiao` | id_regiao PK, nome | + `ativo` (UC20 "inativar") |
| `area_atuacao` | id_area PK, nome | + `ativo` (UC20 "inativar") |
| `voluntario_area` | (id_usuario, id_area) PK | N:N voluntário × áreas de interesse |
| `disponibilidade` | id_disponibilidade PK, id_usuario FK, dia_semana (0=dom…6=sáb), hora_inicio, hora_fim | Várias faixas por voluntário |
| `consentimento` | id_consentimento PK, id_usuario FK, versao_termo, finalidade, data_aceite, data_revogacao | Vigente = `data_revogacao IS NULL` |
| `demanda` | id_demanda PK, id_gestor FK, id_area FK, id_regiao FK, titulo, descricao, local_acao, data_inicio, data_fim, vagas, situacao | `situacao` ∈ aberta, concluida, cancelada |
| `participacao` | id_participacao PK, id_demanda FK, id_voluntario FK, situacao, pontuacao, horas_realizadas, data_registro | UK (id_demanda, id_voluntario). `situacao` ∈ sugerida, confirmada, recusada, selecionada, compareceu, faltou, cancelada |
| `notificacao` | id_notificacao PK, id_usuario FK, id_demanda FK (nulo permitido), tipo, mensagem, canal, data_envio, lida | `canal` ∈ sistema, email. `tipo` ∈ oportunidade, selecao, alteracao, cancelamento, outro |
| `certificado` | id_certificado PK, id_participacao FK UK, codigo_validacao UK, data_emissao | Um certificado por participação |

## Acréscimos justificados (não estavam no diagrama)
| Tabela/campo | Motivo |
|---|---|
| `redefinicao_senha` (id, id_usuario, token_hash, expira_em, usado_em) | UC02: link de uso único e validade limitada exige guardar o token (somente o hash) |
| `configuracao` (chave PK, valor) | UC12: pesos configuráveis; UC10: prazo de retenção; RNF12: nome da organização |
| `usuario.ultimo_acesso` | UC10: contas inativas além do prazo de retenção seguem a anonimização |
| `notificacao.status_envio` (enviada, falha, ignorada) | UC13: "se o e-mail falhar, o aviso dentro do sistema continua disponível" |
| `participacao.data_atualizacao` | Auditoria simples das transições de situação |

## Chaves de configuração
| Chave | Padrão | Uso |
|---|---|---|
| `peso_base` | 50 | Pontuação inicial de todo compatível |
| `peso_regiao` | 50 | Acréscimo se a região do voluntário = região da demanda |
| `retencao_meses` | 24 | Prazo de inatividade para anonimização automática |
| `nome_organizacao` | Rede Mãos pela Cidade | Identidade institucional (RNF12) |
| `termo_versao` | 1.0 | Versão vigente do termo de uso/privacidade (UC04) |

## Índices
- `usuario(email)` único; `participacao(id_voluntario, situacao)`; `participacao(id_demanda, situacao)`;
  `demanda(situacao, data_inicio)`; `disponibilidade(id_usuario, dia_semana)`;
  `notificacao(id_usuario, lida)`; `voluntario_area(id_area)`.

## Anonimização (UC10)
`usuario`: nome = "Voluntário removido", email = `removido-{id}@anonimo.invalid`, telefone = NULL,
senha_hash = hash aleatório, situacao = `excluido`, data_exclusao = now(). Remove `disponibilidade`
e `voluntario_area`; `voluntario.id_regiao` = NULL; revoga consentimentos; apaga notificações;
participações pendentes (sugerida/confirmada/selecionada) viram `cancelada`; participações
concluídas e horas permanecem sem identificação para os indicadores.
