# 02 — Regras de negócio por caso de uso

Descrição completa dos UC no PDF "Projeto Tecnológico – etapa 03". Aqui ficam as regras
verificáveis que o código e os testes devem cumprir.

## Autenticação (UC01, UC02)
- RN01 Login falho devolve sempre "E-mail ou senha inválidos" (não revela qual está errado). Conta com `situacao <> 'ativo'` não entra (mesma mensagem).
- RN02 Sessão: cookie JWT de 30 min, renovado a cada requisição autenticada.
- RN03 Recuperação: resposta idêntica exista ou não o e-mail (sem enumeração). Token aleatório de 32 bytes, guardado como SHA-256, validade 1 h, uso único. Nova senha → hash bcrypt.
- RN04 Senha: mínimo 8 caracteres, com letras e números.

## Cadastro e consentimento (UC03, UC04)
- RN05 Obrigatórios: nome, e-mail, telefone, senha, região, ≥ 1 área, ≥ 1 faixa de disponibilidade (hora_fim > hora_inicio), aceite do termo.
- RN06 E-mail duplicado → 409. Sem aceite do termo → 422 e nada é gravado. Tudo em uma transação.
- RN07 Consentimento grava versão do termo, finalidade ("Mobilização para ações de voluntariado") e data/hora. Revogar preenche `data_revogacao`; sem consentimento vigente o voluntário deixa de ser sugerido (RN14).
- RN08 Voluntário pode reaceitar o termo após revogar.

## Perfil (UC05)
- RN09 Edição de dados/áreas/região/disponibilidade vale para os próximos cruzamentos; não recalcula demandas já geradas.
- RN10 Alterar e-mail exige que o novo não esteja em uso.

## Demandas (UC11, UC14)
- RN11 Obrigatórios: título, descrição, área, região, local, início, fim, vagas. `data_fim > data_inicio`, `vagas >= 1`, início no futuro (no cadastro).
- RN12 Somente gestor cria. Somente o gestor dono edita/cancela, enquanto `situacao = 'aberta'`.
- RN13 Ao criar: executa cruzamento (RN14) e notificações (RN18).
- RN13b Ao editar: se área, região, início ou fim mudarem → refaz cruzamento: novos compatíveis entram como `sugerida` (e são notificados); `sugerida` que deixaram de ser compatíveis são removidas; pontuações de quem permanece são atualizadas; participantes `confirmada`/`selecionada` são mantidos e notificados da alteração (tipo `alteracao`). Se `vagas` ficar menor que os já selecionados → 422.
- RN13c Cancelar: `situacao = 'cancelada'`; participantes ativos (sugerida, confirmada, selecionada) são notificados (tipo `cancelamento`) e passam a `cancelada`.

## Cruzamento (UC12)
- RN14 Elegíveis: usuário `ativo`, perfil voluntário, com consentimento vigente, com a área da demanda em `voluntario_area`, e disponibilidade que **cobre todo o período** da ação (cada dia do período precisa estar coberto por uma única faixa do dia da semana correspondente, em horário de Brasília). Voluntários que já têm participação `recusada` ou `cancelada` na demanda não são sugeridos novamente.
- RN15 Pontuação = `peso_base` + (`peso_regiao` se mesma região). Região não elimina.
- RN16 Desempate: maior taxa de comparecimento (`compareceu / (compareceu + faltou)`; sem histórico = 0), depois nome.
- RN17 Resultado gravado em `participacao` com situação `sugerida` e `pontuacao`; ordenação por pontuação desc, taxa desc.

## Notificações (UC13)
- RN18 Cada voluntário sugerido recebe duas linhas em `notificacao`: canal `sistema` (sempre disponível) e canal `email` (título, data, local, link para responder). Falha/ausência de SMTP não cancela o aviso do sistema.
- RN19 Abrir uma notificação marca `lida = true` e leva à demanda.

## Resposta do voluntário (UC06, UC07)
- RN20 Oportunidades = demandas `aberta` com participação do voluntário em `sugerida`/`confirmada`/`selecionada` (e filtros por área, região e período). Filtros são opcionais.
- RN21 Transições permitidas: `sugerida → confirmada | recusada`; `confirmada → cancelada`; `selecionada → cancelada`; `cancelada → confirmada` (se a demanda ainda estiver aberta e iniciar no futuro). `recusada` é final. Só vale com a demanda `aberta` e início no futuro.

## Gestor (UC15, UC16, UC17, UC18)
- RN22 UC15 mostra todos os compatíveis em ordem; e-mail e telefone aparecem **somente** para `confirmada`/`selecionada`/`compareceu`/`faltou` daquela demanda.
- RN23 UC16 mostra: nº de participações (compareceu), horas acumuladas, faltas e as últimas 5 ações do voluntário.
- RN24 UC17: transação com `SELECT … FOR UPDATE` na demanda; só seleciona quem está `confirmada`; bloqueia (409) se selecionados ≥ vagas. Selecionado recebe notificação (tipo `selecao`).
- RN25 UC18: só para `selecionada` (ou já registrada, permitindo correção enquanto a demanda estiver aberta). Marca `compareceu`/`faltou` com `horas_realizadas` (padrão = duração prevista; falta = 0 horas). Quando todos os selecionados têm presença lançada, a demanda vira `concluida`. Gestor dono apenas. Falta não bloqueia o voluntário.

## Certificado (UC08, UC09)
- RN26 Histórico: ações com participação `compareceu`/`faltou`, com totais de ações (compareceu) e horas.
- RN27 Certificado somente para `compareceu`. PDF com nome, ação, data, horas e código único (formato `VOL-XXXX-XXXX-XXXX`). Reemitir devolve o mesmo código. Existe validação pública por código.

## Exclusão (UC10)
- RN28 Exige senha atual. Aplica anonimização de `03-modelo-de-dados.md`. Rotina agendada anonimiza contas de voluntários sem acesso há mais de `retencao_meses`.

## Administração (UC19–UC22)
- RN29 Admin cria gestores (senha inicial definida pelo admin), altera perfil entre gestor/administrador/voluntário, ativa/inativa contas, redefine acesso (gera nova senha temporária exibida uma única vez; senhas existentes nunca aparecem). Não pode inativar nem rebaixar a si mesmo.
- RN30 Áreas e regiões: incluir, editar, inativar/reativar; nome único; itens inativos não aparecem em formulários mas permanecem nos históricos.
- RN31 Indicadores (período opcional): voluntários ativos, demandas abertas/concluídas, participações (compareceu), horas totais, taxa de comparecimento, + séries para gráficos (demandas por mês, voluntários por área).
- RN32 Relatório (período, área, região opcionais): voluntários por área e região, horas por ação, presenças e faltas; exportação em PDF.
- RN33 Pesos da pontuação, retenção e nome da organização editáveis pelo admin.
