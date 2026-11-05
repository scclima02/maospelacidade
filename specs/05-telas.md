# 05 — Telas (SPA em `public/`, rotas por hash)

Toda tela exibe o nome da organização no cabeçalho (RNF12) e é responsiva (RNF02).

## Públicas
| Rota | Tela | UC |
|---|---|---|
| `#/login` | Login | UC01 |
| `#/cadastro` | Cadastro de voluntário com termo LGPD (checkbox obrigatório + texto do termo) | UC03, UC04 |
| `#/recuperar-senha` | Informa e-mail | UC02 |
| `#/redefinir-senha?token=…` | Define nova senha | UC02 |
| `#/validar?codigo=…` | Validação pública do certificado | UC09 |

## Voluntário
| Rota | Tela | UC |
|---|---|---|
| `#/oportunidades` | Abas "Para você" (áreas de interesse, região primeiro), "Todas as oportunidades" e "Minhas inscrições"; filtros por busca, área, região e período | UC06 |
| `#/oportunidades/demanda/:idDemanda` | Detalhe + "Quero participar" / confirmar / recusar / cancelar + link da organização | UC07 |
| `#/oportunidades/:idParticipacao` | Mesmo detalhe, aberto a partir das notificações | UC07 |
| `#/notificacoes` | Notificações; abrir marca como lida e leva à oportunidade | UC06 |
| `#/historico` | Totais, lista de ações, botão "Certificado (PDF)" | UC08, UC09 |
| `#/perfil` | Edita dados, áreas, região, disponibilidade; consentimento (revogar/aceitar); excluir conta | UC05, UC04, UC10 |

## Gestor
| Rota | Tela | UC |
|---|---|---|
| `#/demandas` | Lista de demandas com filtros (área, região, período, situação, "somente minhas") | RF18 |
| `#/demandas/nova` | Formulário de demanda (inclui organização e link opcionais) — gestor e administrador | UC11 |
| `#/demandas/:id` | Detalhe: dados, editar/cancelar, tabela de voluntários compatíveis (pontuação, região, situação, taxa), resumo do voluntário (modal), selecionar, registrar presença e horas | UC14–UC18 |
| `#/demandas/:id/editar` | Edição | UC14 |

## Administrador
| Rota | Tela | UC |
|---|---|---|
| `#/admin/painel` | Indicadores + gráficos (Chart.js) com filtro de período | UC21 |
| `#/admin/relatorios` | Filtros, tabelas, exportar PDF | UC22 |
| `#/admin/usuarios` | Lista, criar gestor, perfil, ativar/inativar, redefinir acesso, excluir | UC19 |
| `#/admin/catalogos` | Áreas e regiões (incluir, editar, inativar, excluir) | UC20 |
| `#/admin/config` | Pesos da pontuação, retenção, nome da organização | RN33 |

## Navegação por perfil
- Após login: voluntário → `#/oportunidades`; gestor → `#/demandas`; administrador → `#/admin/painel`.
- Rotas fora do perfil redirecionam para a página inicial do perfil; sem sessão → `#/login`.
- O gestor e o administrador podem abrir `#/demandas` e `#/demandas/:id`. O gestor só altera as próprias demandas; o administrador altera, cancela e exclui qualquer uma.
