import { api, qs } from './api.js';
import { state, carregarCatalogos } from './state.js';
import { renderCabecalho, renderRodape } from './cabecalho.js';
import {
  html, raw, mount, spinner, vazio, alerta, cabecalhoPagina, badge, toast, confirmar, abrirModal, modalFormulario,
  aoEnviar, ErroForm, executar, lerForm, mensagensDe, fmtData, fmtHoras, fmtNumero, fmtTaxa, PERFIS,
} from './ui.js';
import { SENHA_FORTE, DICA_SENHA } from './componentes.js';
import { ajustarGraficos } from './efeitos.js';

const PALETA = ['#ff7a45', '#2f6fed', '#22c7b8', '#ff5e62', '#8b5cf6', '#f5b83d', '#1456b8', '#94a3b8'];

const opcoes = (itens, selecionado = '') => itens.map((i) => html`<option value="${i.id}" ${String(selecionado) === String(i.id) ? raw('selected') : ''}>${i.nome}</option>`);

const indicador = (valor, rotulo, cls = '', icone = 'bi-stars') => html`<div class="col-6 col-md-4 col-xl-2"><div class="card indicador ${cls} h-100"><div class="card-body">
  <span class="ico" aria-hidden="true"><i class="bi ${icone}"></i></span><div class="valor">${valor}</div><div class="rotulo">${rotulo}</div></div></div></div>`;

const nomeMes = (aaaamm) => {
  const [a, m] = String(aaaamm).split('-');
  return m ? `${m}/${a}` : aaaamm;
};

// ---------- UC21: painel de indicadores ----------
export async function telaPainel(ctx) {
  mount(ctx.el, html`${cabecalhoPagina('Painel de indicadores')}
    <form class="card card-body shadow-sm mb-3" id="filtros" novalidate aria-label="Filtro de período">
      <div class="row g-2 align-items-end">
        <div class="col-6 col-md-3"><label class="form-label small mb-1" for="p-de">De</label><input class="form-control" type="date" id="p-de" name="de"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-1" for="p-ate">Até</label><input class="form-control" type="date" id="p-ate" name="ate"></div>
        <div class="col-12 col-md-4 d-flex gap-2">
          <button class="btn btn-primary" type="submit">Aplicar período</button>
          <button class="btn btn-outline-secondary" type="reset">Limpar</button>
        </div>
      </div>
    </form>
    <div id="conteudo-painel" aria-live="polite"></div>`);

  const form = ctx.el.querySelector('#filtros');
  const area = ctx.el.querySelector('#conteudo-painel');
  let graficos = [];
  const destruir = () => { graficos.forEach((g) => g.destroy()); graficos = []; };
  ctx.limpeza.push(destruir);
  // Gráficos acompanham o tema claro/escuro.
  const aoTrocarTema = () => carregar();
  document.addEventListener('tema', aoTrocarTema);
  ctx.limpeza.push(() => document.removeEventListener('tema', aoTrocarTema));

  async function carregar() {
    destruir();
    mount(area, spinner());
    let r;
    try {
      r = await api.get(`/admin/indicadores${qs(lerForm(form))}`);
    } catch (e) {
      mount(area, alerta('danger', mensagensDe(e).join(' ')));
      return;
    }
    mount(area, html`<div class="row g-3 mb-4">
        ${indicador(fmtNumero(r.voluntariosAtivos), 'Voluntários ativos', '', 'bi-people-fill')}
        ${indicador(fmtNumero(r.demandasAbertas), 'Demandas abertas', 'verde', 'bi-megaphone-fill')}
        ${indicador(fmtNumero(r.demandasConcluidas), 'Demandas concluídas', '', 'bi-check2-circle')}
        ${indicador(fmtNumero(r.participacoes), 'Participações', 'verde', 'bi-hand-thumbs-up-fill')}
        ${indicador(fmtHoras(r.horas), 'Horas voluntariadas', '', 'bi-clock-history')}
        ${indicador(fmtTaxa(r.taxaComparecimento), 'Taxa de comparecimento', 'verde', 'bi-graph-up-arrow')}
      </div>
      <div class="row g-3">
        <div class="col-12 col-lg-7"><div class="card shadow-sm h-100"><div class="card-body">
          <h2 class="h6">Demandas por mês</h2>
          <div class="grafico"><canvas id="g-meses" role="img" aria-label="Gráfico de barras com o número de demandas por mês"></canvas></div>
        </div></div></div>
        <div class="col-12 col-lg-5"><div class="card shadow-sm h-100"><div class="card-body">
          <h2 class="h6">Voluntários por área de interesse</h2>
          <div class="grafico"><canvas id="g-areas" role="img" aria-label="Gráfico de rosca com voluntários por área de interesse"></canvas></div>
        </div></div></div>
      </div>`);

    if (typeof Chart === 'undefined') {
      area.insertAdjacentHTML('beforeend', alerta('warning', 'Não foi possível carregar a biblioteca de gráficos. Os indicadores acima continuam válidos.').s);
      return;
    }
    ajustarGraficos();
    const meses = r.demandasPorMes || [];
    const areas = r.voluntariosPorArea || [];
    if (meses.length) {
      graficos.push(new Chart(area.querySelector('#g-meses'), {
        type: 'bar',
        data: { labels: meses.map((m) => nomeMes(m.mes)), datasets: [{ label: 'Demandas', data: meses.map((m) => m.total), backgroundColor: PALETA[0], borderRadius: 10, borderSkipped: false, maxBarThickness: 46 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } },
      }));
    } else {
      mount(area.querySelector('#g-meses').parentElement, vazio('Sem demandas no período.', 'bi-bar-chart'));
    }
    if (areas.length) {
      graficos.push(new Chart(area.querySelector('#g-areas'), {
        type: 'doughnut',
        data: { labels: areas.map((a) => a.area), datasets: [{ data: areas.map((a) => a.total), backgroundColor: areas.map((_, i) => PALETA[i % PALETA.length]), borderWidth: 0, hoverOffset: 8 }] },
        options: { maintainAspectRatio: false, cutout: '66%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } } },
      }));
    } else {
      mount(area.querySelector('#g-areas').parentElement, vazio('Sem voluntários cadastrados.', 'bi-pie-chart'));
    }
  }

  form.addEventListener('submit', (ev) => { ev.preventDefault(); carregar(); });
  form.addEventListener('reset', () => setTimeout(carregar));
  await carregar();
}

// ---------- UC22: relatórios de engajamento ----------
export async function telaRelatorios(ctx) {
  const { areas, regioes } = await carregarCatalogos();
  mount(ctx.el, html`${cabecalhoPagina('Relatório de engajamento', html`<a class="btn btn-outline-primary" id="exportar" href="/api/admin/relatorios/engajamento.pdf" target="_blank" rel="noopener"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i> Exportar PDF</a>`)}
    <form class="card card-body shadow-sm mb-3" id="filtros" novalidate aria-label="Filtros do relatório">
      <div class="row g-2 align-items-end">
        <div class="col-6 col-lg-2"><label class="form-label small mb-1" for="r-de">De</label><input class="form-control" type="date" id="r-de" name="de"></div>
        <div class="col-6 col-lg-2"><label class="form-label small mb-1" for="r-ate">Até</label><input class="form-control" type="date" id="r-ate" name="ate"></div>
        <div class="col-6 col-lg-3"><label class="form-label small mb-1" for="r-area">Área</label><select class="form-select" id="r-area" name="idArea"><option value="">Todas</option>${opcoes(areas)}</select></div>
        <div class="col-6 col-lg-3"><label class="form-label small mb-1" for="r-regiao">Região</label><select class="form-select" id="r-regiao" name="idRegiao"><option value="">Todas</option>${opcoes(regioes)}</select></div>
        <div class="col-12 col-lg-2 d-flex gap-2">
          <button class="btn btn-primary flex-grow-1" type="submit">Gerar</button>
          <button class="btn btn-outline-secondary" type="reset" aria-label="Limpar filtros"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        </div>
      </div>
    </form>
    <div id="resultado" aria-live="polite"></div>`);

  const form = ctx.el.querySelector('#filtros');
  const saida = ctx.el.querySelector('#resultado');
  const exportar = ctx.el.querySelector('#exportar');

  async function gerar() {
    const filtros = lerForm(form);
    exportar.href = `/api/admin/relatorios/engajamento.pdf${qs(filtros)}`;
    mount(saida, spinner('Gerando relatório…'));
    try {
      const r = await api.get(`/admin/relatorios/engajamento${qs(filtros)}`);
      const t = r.totais || {};
      mount(saida, html`<div class="row g-3 mb-4">
          ${indicador(fmtNumero(t.demandas), 'Demandas no período', '', 'bi-clipboard2-heart-fill')}
          ${indicador(fmtNumero(t.presencas), 'Presenças', 'verde', 'bi-person-check-fill')}
          ${indicador(fmtNumero(t.faltas), 'Faltas', '', 'bi-person-x-fill')}
          ${indicador(fmtHoras(t.horas), 'Horas voluntariadas', 'verde', 'bi-clock-history')}
        </div>
        <h2 class="h5">Voluntários por área e região</h2>
        ${r.porAreaRegiao.length ? html`<div class="card shadow-sm mb-4"><div class="table-responsive"><table class="table table-sm table-hover tabela-compacta mb-0">
          <thead class="table-light"><tr><th scope="col">Área</th><th scope="col">Região</th><th scope="col" class="num">Voluntários</th></tr></thead>
          <tbody>${r.porAreaRegiao.map((l) => html`<tr><td>${l.area}</td><td>${l.regiao}</td><td class="num">${fmtNumero(l.voluntarios)}</td></tr>`)}</tbody>
        </table></div></div>` : html`<p class="text-muted">Nenhum voluntário para os filtros informados.</p>`}
        <h2 class="h5">Horas, presenças e faltas por ação</h2>
        ${r.acoes.length ? html`<div class="card shadow-sm"><div class="table-responsive"><table class="table table-sm table-hover tabela-compacta mb-0">
          <thead class="table-light"><tr><th scope="col">Ação</th><th scope="col">Data</th><th scope="col">Área</th><th scope="col">Região</th><th scope="col" class="num">Horas</th><th scope="col" class="num">Presenças</th><th scope="col" class="num">Faltas</th></tr></thead>
          <tbody>${r.acoes.map((a) => html`<tr><td>${a.titulo}</td><td>${fmtData(a.data)}</td><td>${a.area}</td><td>${a.regiao}</td>
            <td class="num">${fmtHoras(a.horas)}</td><td class="num">${fmtNumero(a.presencas)}</td><td class="num">${fmtNumero(a.faltas)}</td></tr>`)}</tbody>
        </table></div></div>` : vazio('Nenhuma ação encontrada para os filtros informados.', 'bi-clipboard-data')}`);
    } catch (e) {
      mount(saida, alerta('danger', mensagensDe(e).join(' ')));
    }
  }

  form.addEventListener('submit', (ev) => { ev.preventDefault(); gerar(); });
  form.addEventListener('reset', () => setTimeout(gerar));
  await gerar();
}

// ---------- UC19: usuários e perfis ----------
function camposUsuario(u = {}, criar = false) {
  return html`
    <div class="row g-3">
      <div class="col-12"><label class="form-label" for="u-nome">Nome</label>
        <input class="form-control" id="u-nome" name="nome" required maxlength="120" value="${u.nome || ''}"><div class="invalid-feedback">Informe o nome.</div></div>
      ${criar ? html`<div class="col-12 col-md-7"><label class="form-label" for="u-email">E-mail</label>
          <input class="form-control" type="email" id="u-email" name="email" required maxlength="160" autocomplete="off"><div class="invalid-feedback">Informe um e-mail válido.</div></div>
        <div class="col-12 col-md-5"><label class="form-label" for="u-tel">Telefone <span class="text-muted">(opcional)</span></label>
          <input class="form-control" type="tel" id="u-tel" name="telefone" maxlength="20"></div>
        <div class="col-12"><label class="form-label" for="u-senha">Senha inicial</label>
          <input class="form-control" type="password" id="u-senha" name="senha" required minlength="8" autocomplete="new-password" aria-describedby="u-dica">
          <div class="form-text" id="u-dica">${DICA_SENHA}</div><div class="invalid-feedback">Informe uma senha com ao menos 8 caracteres.</div></div>` : ''}
      <div class="col-12 col-md-6"><label class="form-label" for="u-perfil">Perfil de acesso</label>
        <select class="form-select" id="u-perfil" name="perfil" required>
          ${(criar ? ['gestor', 'administrador'] : ['voluntario', 'gestor', 'administrador']).map((p) => html`<option value="${p}" ${u.perfil === p ? raw('selected') : ''}>${PERFIS[p]}</option>`)}
        </select></div>
      ${criar ? '' : html`<div class="col-12 col-md-6"><label class="form-label" for="u-situacao">Situação da conta</label>
        <select class="form-select" id="u-situacao" name="situacao" ${u.situacao === 'excluido' ? raw('disabled') : ''}>
          <option value="ativo" ${u.situacao === 'ativo' ? raw('selected') : ''}>Ativo</option>
          <option value="inativo" ${u.situacao === 'inativo' ? raw('selected') : ''}>Inativo</option>
          ${u.situacao === 'excluido' ? html`<option value="excluido" selected>Excluído</option>` : ''}
        </select></div>`}
      <div class="col-12 col-md-6" data-gestor><label class="form-label" for="u-org">Organização</label>
        <input class="form-control" id="u-org" name="organizacao" maxlength="120" value="${u.organizacao || ''}"></div>
      <div class="col-12 col-md-6" data-gestor><label class="form-label" for="u-cargo">Cargo</label>
        <input class="form-control" id="u-cargo" name="cargo" maxlength="120" value="${u.cargo || ''}"></div>
    </div>`;
}

// Mostra organização/cargo somente quando o perfil é gestor.
function alternarCamposGestor(form) {
  const sel = form.elements.perfil;
  const aplicar = () => form.querySelectorAll('[data-gestor]').forEach((c) => c.classList.toggle('d-none', sel.value !== 'gestor'));
  sel.addEventListener('change', aplicar);
  aplicar();
}

export async function telaUsuarios(ctx) {
  mount(ctx.el, html`${cabecalhoPagina('Usuários e perfis', html`<button type="button" class="btn btn-primary" id="novo"><i class="bi bi-person-plus" aria-hidden="true"></i> Novo gestor / administrador</button>`)}
    <form class="card card-body shadow-sm mb-3" id="filtros" novalidate aria-label="Filtros de usuários">
      <div class="row g-2 align-items-end">
        <div class="col-12 col-md-4"><label class="form-label small mb-1" for="u-busca">Buscar</label><input class="form-control" id="u-busca" name="busca" placeholder="Nome ou e-mail"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-1" for="u-fperfil">Perfil</label>
          <select class="form-select" id="u-fperfil" name="perfil"><option value="">Todos</option><option value="voluntario">Voluntário</option><option value="gestor">Gestor</option><option value="administrador">Administrador</option></select></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-1" for="u-fsit">Situação</label>
          <select class="form-select" id="u-fsit" name="situacao"><option value="">Todas</option><option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="excluido">Excluído</option></select></div>
        <div class="col-12 col-md-2 d-flex gap-2"><button class="btn btn-primary flex-grow-1" type="submit">Filtrar</button>
          <button class="btn btn-outline-secondary" type="reset" aria-label="Limpar filtros"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>
      </div>
    </form>
    <div id="lista" aria-live="polite"></div>`);

  const form = ctx.el.querySelector('#filtros');
  const lista = ctx.el.querySelector('#lista');
  let usuarios = [];

  async function carregar() {
    mount(lista, spinner());
    try {
      usuarios = await api.get(`/admin/usuarios${qs(lerForm(form))}`);
    } catch (e) {
      mount(lista, alerta('danger', mensagensDe(e).join(' ')));
      return;
    }
    if (!usuarios.length) {
      mount(lista, vazio('Nenhum usuário encontrado.', 'bi-people'));
      return;
    }
    mount(lista, html`<div class="card shadow-sm"><div class="table-responsive"><table class="table table-hover tabela-compacta mb-0">
      <caption class="visually-hidden">Usuários cadastrados</caption>
      <thead class="table-light"><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Perfil</th><th scope="col">Situação</th><th scope="col">Cadastro</th><th scope="col"><span class="visually-hidden">Ações</span></th></tr></thead>
      <tbody>${usuarios.map((u) => {
        const proprio = u.id === state.usuario.id;
        const bloqueado = u.situacao === 'excluido';
        return html`<tr>
          <td><strong>${u.nome}</strong>${u.organizacao ? html`<div class="small text-muted">${u.organizacao}${u.cargo ? ` · ${u.cargo}` : ''}</div>` : ''}</td>
          <td>${u.email}</td><td>${PERFIS[u.perfil] || u.perfil}</td><td>${badge(u.situacao)}</td><td>${fmtData(u.dataCadastro)}</td>
          <td class="text-end text-nowrap">
            <button type="button" class="btn btn-outline-primary btn-sm" data-editar="${u.id}" ${bloqueado ? raw('disabled') : ''}>Editar</button>
            <button type="button" class="btn btn-outline-secondary btn-sm" data-redefinir="${u.id}" ${bloqueado || proprio ? raw('disabled') : ''} title="${proprio ? 'Você não pode redefinir o próprio acesso aqui' : 'Gerar senha temporária'}">Redefinir acesso</button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-excluir="${u.id}" ${proprio ? raw('disabled') : ''} aria-label="Excluir ${u.nome}" title="${proprio ? 'Você não pode excluir a própria conta' : 'Excluir usuário'}"><i class="bi bi-trash" aria-hidden="true"></i></button>
          </td></tr>`;
      })}</tbody></table></div></div>`);
  }

  lista.addEventListener('click', async (ev) => {
    const bEditar = ev.target.closest('[data-editar]');
    const bRedef = ev.target.closest('[data-redefinir]');
    if (bEditar) editar(usuarios.find((u) => String(u.id) === bEditar.dataset.editar));
    if (bRedef) redefinir(bRedef, usuarios.find((u) => String(u.id) === bRedef.dataset.redefinir));
    const bExc = ev.target.closest('[data-excluir]');
    if (bExc) excluir(bExc, usuarios.find((u) => String(u.id) === bExc.dataset.excluir));
  });

  async function excluir(botao, u) {
    if (!(await confirmar({
      titulo: 'Excluir usuário', ok: 'Excluir definitivamente', perigo: true,
      mensagem: `${u.nome} (${u.email}) será apagado(a) com inscrições, histórico, certificados e avisos. As demandas que essa pessoa cadastrou passam para você. Esta ação não pode ser desfeita.`,
    }))) return;
    await executar(botao, async () => {
      await api.del(`/admin/usuarios/${u.id}`);
      toast('Usuário excluído.', 'warning');
      await carregar();
    });
  }

  function editar(u) {
    const proprio = u.id === state.usuario.id;
    const m = modalFormulario({
      titulo: `Editar ${u.nome}`,
      corpo: html`${proprio ? alerta('info', 'Você não pode alterar o próprio perfil nem inativar a própria conta.') : ''}${camposUsuario(u)}`,
      aoSalvar: async (f) => {
        const corpo = {
          nome: f.elements.nome.value.trim(),
          perfil: f.elements.perfil.value,
          situacao: f.elements.situacao.value,
          organizacao: f.elements.organizacao.value.trim() || undefined,
          cargo: f.elements.cargo.value.trim() || undefined,
        };
        if (proprio) { delete corpo.perfil; delete corpo.situacao; }
        await api.put(`/admin/usuarios/${u.id}`, corpo);
        toast('Usuário atualizado.');
        await carregar();
      },
    });
    const f = m.el.querySelector('form');
    if (proprio) { f.elements.perfil.disabled = true; f.elements.situacao.disabled = true; }
    alternarCamposGestor(f);
  }

  async function redefinir(botao, u) {
    if (!(await confirmar({
      titulo: 'Redefinir acesso', ok: 'Gerar senha temporária',
      mensagem: `Será gerada uma nova senha temporária para ${u.nome}. A senha atual deixará de funcionar.`,
    }))) return;
    await executar(botao, async () => {
      const r = await api.post(`/admin/usuarios/${u.id}/redefinir-acesso`);
      const m = abrirModal({
        titulo: 'Senha temporária gerada',
        corpo: html`${alerta('warning', 'Esta senha é exibida uma única vez. Repasse-a ao usuário por um canal seguro.')}
          <div class="input-group">
            <input class="form-control font-monospace" id="senha-temp" readonly value="${r.senhaTemporaria}" aria-label="Senha temporária">
            <button class="btn btn-outline-primary" type="button" id="copiar">Copiar</button>
          </div>`,
        rodape: html`<button type="button" class="btn btn-primary" data-bs-dismiss="modal">Concluir</button>`,
      });
      m.el.querySelector('#copiar').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(r.senhaTemporaria);
          toast('Senha copiada.');
        } catch {
          m.el.querySelector('#senha-temp').select();
        }
      });
    });
  }

  ctx.el.querySelector('#novo').addEventListener('click', () => {
    const m = modalFormulario({
      titulo: 'Novo gestor / administrador',
      ok: 'Criar usuário',
      corpo: camposUsuario({ perfil: 'gestor' }, true),
      aoSalvar: async (f) => {
        const e = f.elements;
        if (!SENHA_FORTE.test(e.senha.value)) throw new ErroForm(`Senha fraca. ${DICA_SENHA}`);
        await api.post('/admin/usuarios', {
          nome: e.nome.value.trim(),
          email: e.email.value.trim(),
          telefone: e.telefone.value.trim() || undefined,
          senha: e.senha.value,
          perfil: e.perfil.value,
          organizacao: e.perfil.value === 'gestor' ? e.organizacao.value.trim() || undefined : undefined,
          cargo: e.perfil.value === 'gestor' ? e.cargo.value.trim() || undefined : undefined,
        });
        toast('Usuário criado.');
        await carregar();
      },
    });
    alternarCamposGestor(m.el.querySelector('form'));
  });

  form.addEventListener('submit', (ev) => { ev.preventDefault(); carregar(); });
  form.addEventListener('reset', () => setTimeout(carregar));
  await carregar();
}

// ---------- UC20: áreas e regiões ----------
function cartaoCatalogo(ctx, tipo, titulo, singular) {
  const caminho = `/admin/${tipo}`;
  const raiz = document.createElement('div');
  raiz.className = 'col-12 col-lg-6';
  mount(raiz, html`<div class="card shadow-sm h-100"><div class="card-body">
    <h2 class="h5">${titulo}</h2>
    <form class="input-group mb-3" novalidate>
      <input class="form-control" name="nome" required maxlength="80" placeholder="Nova ${singular}" aria-label="Nome da nova ${singular}">
      <button class="btn btn-primary" type="submit">Incluir</button>
      <div data-erros class="w-100 mt-2"></div>
    </form>
    <div data-lista aria-live="polite"></div>
  </div></div>`);

  const lista = raiz.querySelector('[data-lista]');
  let itens = [];

  async function carregar() {
    mount(lista, spinner());
    try {
      itens = await api.get(caminho);
    } catch (e) {
      mount(lista, alerta('danger', mensagensDe(e).join(' ')));
      return;
    }
    mount(lista, itens.length ? html`<ul class="list-group">${itens.map((i) => html`<li class="list-group-item item-catalogo">
      <span class="${i.ativo ? '' : 'text-muted text-decoration-line-through'}">${i.nome} ${i.ativo ? '' : badge('inativo')}</span>
      <span class="item-catalogo-acoes">
        <button type="button" class="btn btn-outline-primary btn-sm" data-editar="${i.id}">Renomear</button>
        <button type="button" class="btn btn-sm ${i.ativo ? 'btn-outline-warning' : 'btn-outline-success'}" data-alternar="${i.id}">${i.ativo ? 'Inativar' : 'Reativar'}</button>
        <button type="button" class="btn btn-outline-danger btn-sm" data-excluir="${i.id}" aria-label="Excluir ${i.nome}" title="Excluir"><i class="bi bi-trash" aria-hidden="true"></i></button>
      </span></li>`)}</ul>` : vazio(`Nenhuma ${singular} cadastrada.`, 'bi-list-ul'));
  }

  aoEnviar(raiz.querySelector('form'), async (form) => {
    await api.post(caminho, { nome: form.elements.nome.value.trim() });
    toast(`${singular[0].toUpperCase()}${singular.slice(1)} incluída.`);
    form.reset();
    form.classList.remove('was-validated');
    state.catalogos = null;
    await carregar();
  });

  lista.addEventListener('click', async (ev) => {
    const bEd = ev.target.closest('[data-editar]');
    const bAlt = ev.target.closest('[data-alternar]');
    const bExc = ev.target.closest('[data-excluir]');
    if (bExc) {
      const item = itens.find((i) => String(i.id) === bExc.dataset.excluir);
      if (!(await confirmar({
        titulo: `Excluir ${singular}`, ok: 'Excluir', perigo: true,
        mensagem: `"${item.nome}" será apagada e removida do perfil dos voluntários. Se houver demandas usando este item, a exclusão será recusada.`,
      }))) return;
      await executar(bExc, async () => {
        await api.del(`${caminho}/${item.id}`);
        toast('Excluída.', 'warning');
        state.catalogos = null;
        await carregar();
      });
      return;
    }
    if (bEd) {
      const item = itens.find((i) => String(i.id) === bEd.dataset.editar);
      modalFormulario({
        titulo: `Renomear ${singular}`,
        corpo: html`<label class="form-label" for="c-nome">Nome</label>
          <input class="form-control" id="c-nome" name="nome" required maxlength="80" value="${item.nome}">
          <div class="invalid-feedback">Informe o nome.</div>`,
        aoSalvar: async (f) => {
          await api.put(`${caminho}/${item.id}`, { nome: f.elements.nome.value.trim() });
          toast('Nome atualizado.');
          state.catalogos = null;
          await carregar();
        },
      });
    }
    if (bAlt) {
      const item = itens.find((i) => String(i.id) === bAlt.dataset.alternar);
      if (item.ativo && !(await confirmar({
        titulo: `Inativar ${singular}`, ok: 'Inativar', perigo: true,
        mensagem: `"${item.nome}" deixará de aparecer em novos cadastros e demandas, mas continuará nos históricos.`,
      }))) return;
      await executar(bAlt, async () => {
        await api.put(`${caminho}/${item.id}`, { ativo: !item.ativo });
        toast(item.ativo ? 'Inativada.' : 'Reativada.');
        state.catalogos = null;
        await carregar();
      });
    }
  });

  carregar();
  return raiz;
}

export async function telaCatalogos(ctx) {
  mount(ctx.el, html`${cabecalhoPagina('Áreas e regiões')}
    <div class="row g-4" id="cartoes"></div>`);
  const alvo = ctx.el.querySelector('#cartoes');
  alvo.append(cartaoCatalogo(ctx, 'areas', 'Áreas de atuação', 'área'));
  alvo.append(cartaoCatalogo(ctx, 'regioes', 'Regiões da cidade', 'região'));
}

// ---------- RN33: configurações ----------
export async function telaConfig(ctx) {
  const c = await api.get('/admin/config');
  mount(ctx.el, html`${cabecalhoPagina('Configurações')}
    <div class="row"><div class="col-12 col-lg-8"><div class="card shadow-sm"><div class="card-body">
      <form novalidate>
        <div data-erros></div>
        <div class="mb-4"><label class="form-label" for="c-nome">Nome da organização</label>
          <input class="form-control" id="c-nome" name="nomeOrganizacao" required maxlength="120" value="${c.nomeOrganizacao}" aria-describedby="c-nome-dica">
          <div class="form-text" id="c-nome-dica">Aparece no cabeçalho e no rodapé de todas as telas.</div>
          <div class="invalid-feedback">Informe o nome da organização.</div></div>
        <fieldset class="mb-4">
          <legend class="h6">Pontuação do cruzamento</legend>
          <p class="small text-muted">Pontuação = peso base + peso da região (somado quando voluntário e demanda estão na mesma região). A taxa de comparecimento desempata.</p>
          <div class="row g-3">
            <div class="col-6"><label class="form-label" for="c-base">Peso base</label>
              <input class="form-control" type="number" id="c-base" name="pesoBase" min="0" step="1" required value="${c.pesoBase}"><div class="invalid-feedback">Informe um número maior ou igual a zero.</div></div>
            <div class="col-6"><label class="form-label" for="c-reg">Peso da região</label>
              <input class="form-control" type="number" id="c-reg" name="pesoRegiao" min="0" step="1" required value="${c.pesoRegiao}"><div class="invalid-feedback">Informe um número maior ou igual a zero.</div></div>
          </div>
        </fieldset>
        <div class="mb-4"><label class="form-label" for="c-ret">Prazo de retenção de contas inativas (meses)</label>
          <input class="form-control" type="number" id="c-ret" name="retencaoMeses" min="1" step="1" required value="${c.retencaoMeses}" aria-describedby="c-ret-dica">
          <div class="form-text" id="c-ret-dica">Voluntários sem acesso por mais tempo que isso têm os dados anonimizados (LGPD).</div>
          <div class="invalid-feedback">Informe ao menos 1 mês.</div></div>
        <button class="btn btn-primary" type="submit">Salvar configurações</button>
      </form>
    </div></div></div></div>`);

  aoEnviar(ctx.el.querySelector('form'), async (form) => {
    const e = form.elements;
    const corpo = {
      nomeOrganizacao: e.nomeOrganizacao.value.trim(),
      pesoBase: Number(e.pesoBase.value),
      pesoRegiao: Number(e.pesoRegiao.value),
      retencaoMeses: Number(e.retencaoMeses.value),
    };
    await api.put('/admin/config', corpo);
    state.config.nomeOrganizacao = corpo.nomeOrganizacao;
    renderCabecalho('/admin/config');
    renderRodape();
    toast('Configurações salvas.');
  });
}
