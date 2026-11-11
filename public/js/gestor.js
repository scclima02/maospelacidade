import { api, qs } from './api.js';
import { state, carregarCatalogos } from './state.js';
import { navegar } from './router.js';
import {
  html, raw, mount, spinner, vazio, alerta, cabecalhoPagina, badge, toast, confirmar, abrirModal, modalFormulario,
  aoEnviar, ErroForm, executar, lerForm, mensagensDe, fmtPeriodo, fmtDataHora, fmtData, fmtHoras, fmtTaxa,
  paraInputLocal,
} from './ui.js';

const opcoes = (itens, selecionado = '') => itens.map((i) => html`<option value="${i.id}" ${String(selecionado) === String(i.id) ? raw('selected') : ''}>${i.nome}</option>`);

// ---------- Lista de demandas (RF18) ----------
export async function telaDemandas(ctx) {
  const { areas, regioes } = await carregarCatalogos();
  const ehGestor = state.usuario.perfil === 'gestor';

  mount(ctx.el, html`${cabecalhoPagina('Demandas',
      html`<a class="btn btn-primary" href="#/demandas/nova"><i class="bi bi-plus-lg" aria-hidden="true"></i> Nova demanda</a>`)}
    <form class="card card-body shadow-sm mb-3" id="filtros" novalidate aria-label="Filtros de demandas">
      <div class="row g-2 align-items-end">
        <div class="col-12 col-lg-3"><label class="form-label small mb-1" for="f-busca">Buscar</label>
          <input class="form-control" id="f-busca" name="busca" placeholder="Título ou descrição"></div>
        <div class="col-6 col-lg-2"><label class="form-label small mb-1" for="f-area">Área</label>
          <select class="form-select" id="f-area" name="idArea"><option value="">Todas</option>${opcoes(areas)}</select></div>
        <div class="col-6 col-lg-2"><label class="form-label small mb-1" for="f-regiao">Região</label>
          <select class="form-select" id="f-regiao" name="idRegiao"><option value="">Todas</option>${opcoes(regioes)}</select></div>
        <div class="col-6 col-lg-2"><label class="form-label small mb-1" for="f-situacao">Situação</label>
          <select class="form-select" id="f-situacao" name="situacao">
            <option value="">Todas</option><option value="aberta">Abertas</option><option value="concluida">Concluídas</option><option value="cancelada">Canceladas</option>
          </select></div>
        <div class="col-6 col-lg-1"><label class="form-label small mb-1" for="f-de">De</label>
          <input class="form-control" type="date" id="f-de" name="de"></div>
        <div class="col-6 col-lg-1"><label class="form-label small mb-1" for="f-ate">Até</label>
          <input class="form-control" type="date" id="f-ate" name="ate"></div>
        <div class="col-6 col-lg-1 d-flex gap-2">
          <button class="btn btn-primary flex-grow-1" type="submit" aria-label="Filtrar"><i class="bi bi-funnel" aria-hidden="true"></i></button>
          <button class="btn btn-outline-secondary" type="reset" aria-label="Limpar filtros"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        </div>
      </div>
      ${ehGestor ? html`<div class="form-check mt-2">
        <input class="form-check-input" type="checkbox" id="f-minhas" name="minhas" value="1">
        <label class="form-check-label" for="f-minhas">Somente minhas demandas</label></div>` : ''}
    </form>
    <div id="lista" aria-live="polite"></div>`);

  const form = ctx.el.querySelector('#filtros');
  const lista = ctx.el.querySelector('#lista');

  async function carregar() {
    mount(lista, spinner());
    try {
      const itens = await api.get(`/demandas${qs(lerForm(form))}`);
      mount(lista, itens.length ? html`<div class="card shadow-sm"><div class="table-responsive">
        <table class="table table-hover tabela-compacta mb-0">
          <caption class="visually-hidden">Demandas cadastradas</caption>
          <thead class="table-light"><tr><th scope="col">Demanda</th><th scope="col">Área / região</th><th scope="col">Período</th><th scope="col" class="num">Vagas</th><th scope="col">Situação</th><th scope="col">Voluntários</th><th scope="col"><span class="visually-hidden">Ações</span></th></tr></thead>
          <tbody>${itens.map((d) => html`<tr>
            <td><strong>${d.titulo}</strong><div class="small text-muted">${d.organizacao || d.gestor || ''}</div></td>
            <td>${d.area}<div class="small text-muted">${d.regiao}</div></td>
            <td class="small">${fmtPeriodo(d.dataInicio, d.dataFim)}</td>
            <td class="num">${d.vagas}</td>
            <td>${badge(d.situacao)}</td>
            <td class="small">
              <div class="contagens">
                <span class="contagem c-sug" title="Sugeridos"><b>${d.totais.sugeridas}</b> sug.</span>
                <span class="contagem c-conf" title="Confirmados"><b>${d.totais.confirmadas}</b> conf.</span>
                <span class="contagem c-sel" title="Selecionados"><b>${d.totais.selecionadas}</b> sel.</span>
              </div>
            </td>
            <td class="text-end"><a class="btn btn-outline-primary btn-sm" href="#/demandas/${d.id}">Abrir</a></td>
          </tr>`)}</tbody>
        </table></div></div>`
        : vazio('Nenhuma demanda encontrada com esses filtros.', 'bi-clipboard-x'));
    } catch (e) {
      mount(lista, alerta('danger', mensagensDe(e).join(' ')));
    }
  }

  form.addEventListener('submit', (ev) => { ev.preventDefault(); carregar(); });
  form.addEventListener('reset', () => setTimeout(carregar));
  await carregar();
}

// ---------- Cadastro e edição de demanda (UC11, UC14) ----------
export async function telaDemandaForm(ctx, edicao = false) {
  const catalogos = await carregarCatalogos(true);
  let d = {};
  if (edicao) {
    d = await api.get(`/demandas/${ctx.params.id}`);
    if (!d.podeEditar || d.situacao !== 'aberta') {
      toast('Esta demanda não pode mais ser editada.', 'warning');
      return navegar(`#/demandas/${d.id}`);
    }
  }
  // Garante que a área/região atual apareça mesmo se tiver sido inativada.
  const areas = [...catalogos.areas];
  const regioes = [...catalogos.regioes];
  if (edicao && !areas.some((a) => a.id === d.idArea)) areas.push({ id: d.idArea, nome: d.area });
  if (edicao && !regioes.some((r) => r.id === d.idRegiao)) regioes.push({ id: d.idRegiao, nome: d.regiao });

  const agora = paraInputLocal(new Date().toISOString());
  const titulo = edicao ? 'Editar demanda' : 'Nova demanda';

  mount(ctx.el, html`<nav aria-label="Navegação"><a class="small" href="${edicao ? `#/demandas/${d.id}` : '#/demandas'}"><i class="bi bi-arrow-left" aria-hidden="true"></i> Voltar</a></nav>
    <div class="card shadow-sm mt-2"><div class="card-body">
      <h1 class="h3" tabindex="-1">${titulo}</h1>
      ${edicao ? alerta('info', 'Se você mudar a área, a região ou o período, o cruzamento com os voluntários será refeito e quem já confirmou será avisado.') : ''}
      <form novalidate>
        <div data-erros></div>
        <div class="row g-3">
          <div class="col-12"><label class="form-label" for="d-titulo">Título</label>
            <input class="form-control" id="d-titulo" name="titulo" required maxlength="160" value="${d.titulo || ''}">
            <div class="invalid-feedback">Informe o título.</div></div>
          <div class="col-12"><label class="form-label" for="d-descricao">Descrição da ação</label>
            <textarea class="form-control" id="d-descricao" name="descricao" rows="4" required>${d.descricao || ''}</textarea>
            <div class="invalid-feedback">Descreva a ação.</div></div>
          <div class="col-12 col-md-6"><label class="form-label" for="d-area">Área de atuação</label>
            <select class="form-select" id="d-area" name="idArea" required><option value="">Selecione…</option>${opcoes(areas, d.idArea)}</select>
            <div class="invalid-feedback">Selecione a área.</div></div>
          <div class="col-12 col-md-6"><label class="form-label" for="d-regiao">Região</label>
            <select class="form-select" id="d-regiao" name="idRegiao" required><option value="">Selecione…</option>${opcoes(regioes, d.idRegiao)}</select>
            <div class="invalid-feedback">Selecione a região.</div></div>
          <div class="col-12"><label class="form-label" for="d-local">Local</label>
            <input class="form-control" id="d-local" name="local" required maxlength="200" value="${d.local || ''}" placeholder="Endereço ou ponto de encontro">
            <div class="invalid-feedback">Informe o local.</div></div>
          <div class="col-12 col-md-6"><label class="form-label" for="d-org">Organização responsável <span class="text-muted">(opcional)</span></label>
            <input class="form-control" id="d-org" name="organizacao" maxlength="150" value="${d.organizacao || ''}" placeholder="ONG, coletivo ou instituição"></div>
          <div class="col-12 col-md-6"><label class="form-label" for="d-link">Link da organização <span class="text-muted">(opcional)</span></label>
            <input class="form-control" type="url" id="d-link" name="link" maxlength="500" value="${d.link || ''}" placeholder="https://">
            <div class="invalid-feedback">Informe um link começando com https://</div></div>
          <div class="col-12 col-md-4"><label class="form-label" for="d-inicio">Início</label>
            <input class="form-control" type="datetime-local" id="d-inicio" name="dataInicio" required ${edicao ? '' : raw(`min="${agora}"`)} value="${d.dataInicio ? paraInputLocal(d.dataInicio) : ''}">
            <div class="invalid-feedback">Informe a data e o horário de início.</div></div>
          <div class="col-12 col-md-4"><label class="form-label" for="d-fim">Término</label>
            <input class="form-control" type="datetime-local" id="d-fim" name="dataFim" required value="${d.dataFim ? paraInputLocal(d.dataFim) : ''}">
            <div class="invalid-feedback">Informe a data e o horário de término.</div></div>
          <div class="col-12 col-md-4"><label class="form-label" for="d-vagas">Voluntários necessários</label>
            <input class="form-control" type="number" id="d-vagas" name="vagas" required min="1" step="1" value="${d.vagas || ''}">
            <div class="invalid-feedback">Informe ao menos 1 vaga.</div></div>
        </div>
        <div class="mt-4 d-flex gap-2">
          <button class="btn btn-primary" type="submit">${edicao ? 'Salvar alterações' : 'Cadastrar demanda'}</button>
          <a class="btn btn-outline-secondary" href="${edicao ? `#/demandas/${d.id}` : '#/demandas'}">Cancelar</a>
        </div>
      </form>
    </div></div>`);

  aoEnviar(ctx.el.querySelector('form'), async (form) => {
    const f = form.elements;
    const erros = [];
    if (f.dataFim.value <= f.dataInicio.value) erros.push('O término deve ser posterior ao início.');
    if (!edicao && f.dataInicio.value <= paraInputLocal(new Date().toISOString())) erros.push('O início deve estar no futuro.');
    if (!Number.isInteger(Number(f.vagas.value)) || Number(f.vagas.value) < 1) erros.push('Informe ao menos 1 vaga.');
    if (erros.length) throw new ErroForm(erros);

    const corpo = {
      titulo: f.titulo.value.trim(),
      descricao: f.descricao.value.trim(),
      idArea: Number(f.idArea.value),
      idRegiao: Number(f.idRegiao.value),
      local: f.local.value.trim(),
      dataInicio: f.dataInicio.value,
      dataFim: f.dataFim.value,
      vagas: Number(f.vagas.value),
      organizacao: f.organizacao.value.trim() || undefined,
      link: f.link.value.trim() || undefined,
    };
    if (edicao) {
      await api.put(`/demandas/${d.id}`, corpo);
      toast('Demanda atualizada.');
      navegar(`#/demandas/${d.id}`);
    } else {
      const r = await api.post('/demandas', corpo);
      const n = r.compativeis ?? 0;
      toast(`Demanda cadastrada. ${n} ${n === 1 ? 'voluntário compatível foi notificado' : 'voluntários compatíveis foram notificados'}.`);
      navegar(`#/demandas/${r.demanda.id}`);
    }
  });
}

// ---------- Detalhe da demanda (UC14 a UC18) ----------
async function abrirResumo(idVoluntario) {
  const r = await api.get(`/voluntarios/${idVoluntario}/resumo`);
  abrirModal({
    titulo: `Histórico de ${r.nome}`,
    grande: true,
    corpo: html`<div class="row g-2 text-center mb-3">
        <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="fs-4 fw-bold">${r.participacoes}</div><div class="small text-muted">Participações</div></div></div>
        <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="fs-4 fw-bold">${fmtHoras(r.horas)}</div><div class="small text-muted">Horas</div></div></div>
        <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="fs-4 fw-bold">${r.faltas}</div><div class="small text-muted">Faltas</div></div></div>
        <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="fs-4 fw-bold">${fmtTaxa(r.taxaComparecimento)}</div><div class="small text-muted">Comparecimento</div></div></div>
      </div>
      <h3 class="h6">Últimas ações</h3>
      ${r.ultimas && r.ultimas.length ? html`<ul class="list-group">${r.ultimas.map((u) => html`<li class="list-group-item d-flex justify-content-between align-items-center gap-2">
        <span>${u.titulo}<br><small class="text-muted">${fmtData(u.data)} · ${fmtHoras(u.horas)}</small></span>${badge(u.situacao)}</li>`)}</ul>`
        : html`<p class="text-muted">Sem ações anteriores.</p>`}`,
    rodape: html`<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Fechar</button>`,
  });
}

const OCUPAM_VAGA = ['selecionada', 'compareceu', 'faltou'];
const PODE_NAO_APROVAR = ['sugerida', 'confirmada', 'selecionada'];

// Comparecimento abaixo de 50% (com histórico) ganha alerta visual para apoiar a decisão do gestor.
function celulaTaxa(t) {
  if (t === null || t === undefined) return html`<span class="text-muted" title="Ainda sem presenças registradas">—</span>`;
  const pct = Number(t) > 1 ? Number(t) : Number(t) * 100;
  return pct < 50
    ? html`<span class="taxa-baixa" title="Falta mais do que comparece"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> ${fmtTaxa(t)}</span>`
    : fmtTaxa(t);
}

export async function telaDemandaDetalhe(ctx) {
  const id = ctx.params.id;

  async function desenhar() {
    const [d, vols] = await Promise.all([api.get(`/demandas/${id}`), api.get(`/demandas/${id}/voluntarios`)]);
    const podeAgir = d.podeEditar && d.situacao === 'aberta';
    const ocupadas = vols.filter((v) => OCUPAM_VAGA.includes(v.situacao)).length;
    const lancaveis = vols.filter((v) => OCUPAM_VAGA.includes(v.situacao));
    const duracao = Math.round(((new Date(d.dataFim) - new Date(d.dataInicio)) / 3600000) * 100) / 100;
    const pct = Math.min(100, Math.round((ocupadas / d.vagas) * 100));

    mount(ctx.el, html`<nav aria-label="Navegação"><a class="small" href="#/demandas"><i class="bi bi-arrow-left" aria-hidden="true"></i> Voltar às demandas</a></nav>
      <div class="card shadow-sm mt-2 mb-4"><div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <h1 class="h3 mb-0" tabindex="-1">${d.titulo}</h1>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${badge(d.situacao)}
            ${podeAgir ? html`<a class="btn btn-outline-primary btn-sm" href="#/demandas/${d.id}/editar"><i class="bi bi-pencil" aria-hidden="true"></i> Editar</a>
              <button type="button" class="btn btn-outline-danger btn-sm" id="cancelar-demanda"><i class="bi bi-x-circle" aria-hidden="true"></i> Cancelar demanda</button>` : ''}
            ${d.podeExcluir ? html`<button type="button" class="btn btn-danger btn-sm" id="excluir-demanda"><i class="bi bi-trash" aria-hidden="true"></i> Excluir</button>` : ''}
          </div>
        </div>
        <p style="white-space:pre-line">${d.descricao}</p>
        <dl class="row mb-3">
          ${d.organizacao || d.link ? html`<dt class="col-sm-3">Organização</dt><dd class="col-sm-9">${d.link
            ? html`<a href="${d.link}" target="_blank" rel="noopener noreferrer">${d.organizacao || d.link} <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>`
            : d.organizacao}</dd>` : ''}
          <dt class="col-sm-3">Área</dt><dd class="col-sm-9">${d.area}</dd>
          <dt class="col-sm-3">Região</dt><dd class="col-sm-9">${d.regiao}</dd>
          <dt class="col-sm-3">Local</dt><dd class="col-sm-9">${d.local}</dd>
          <dt class="col-sm-3">Período</dt><dd class="col-sm-9">${fmtPeriodo(d.dataInicio, d.dataFim)}</dd>
          <dt class="col-sm-3">Cadastrada por</dt><dd class="col-sm-9">${d.gestor || '—'}</dd>
        </dl>
        <div class="mb-1 d-flex justify-content-between small"><span>Vagas preenchidas</span><strong>${ocupadas} de ${d.vagas}</strong></div>
        <div class="progress" role="progressbar" aria-label="Vagas preenchidas" aria-valuenow="${ocupadas}" aria-valuemin="0" aria-valuemax="${d.vagas}">
          <div class="progress-bar bg-success" style="width:${pct}%"></div></div>
        ${d.situacao === 'aberta' && !d.podeEditar ? html`<p class="small text-muted mt-3 mb-0">Visualização somente leitura: apenas o gestor que cadastrou a demanda ou um administrador pode alterá-la.</p>` : ''}
        ${d.situacao === 'cancelada' ? html`<div class="mt-3">${alerta('secondary', 'Esta demanda foi cancelada.')}</div>` : ''}
        ${d.situacao === 'concluida' ? html`<div class="mt-3">${alerta('primary', 'Ação concluída: todas as presenças foram registradas.')}</div>` : ''}
      </div></div>

      <section aria-labelledby="t-vols">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <h2 class="h5 mb-0" id="t-vols">Voluntários compatíveis</h2>
          ${podeAgir ? html`<div class="d-flex align-items-center gap-2">
            <span class="small text-muted" id="resumo-selecao" aria-live="polite"></span>
            <button type="button" class="btn btn-success btn-sm" id="selecionar" disabled><i class="bi bi-check2-square" aria-hidden="true"></i> Selecionar marcados</button>
          </div>` : ''}
        </div>
        ${vols.length ? html`<div class="card shadow-sm"><div class="table-responsive">
          <table class="table table-hover tabela-compacta mb-0">
            <caption class="visually-hidden">Voluntários sugeridos, ordenados por pontuação</caption>
            <thead class="table-light"><tr>
              ${podeAgir ? html`<th scope="col"><span class="visually-hidden">Marcar</span></th>` : ''}
              <th scope="col">Voluntário</th><th scope="col">Região</th><th scope="col">Situação</th>
              <th scope="col" class="num">Pontuação</th><th scope="col" class="num">Comparecimento</th><th scope="col">Contato</th><th scope="col"><span class="visually-hidden">Ações</span></th>
            </tr></thead>
            <tbody>${vols.map((v) => html`<tr>
              ${podeAgir ? html`<td>${v.situacao === 'confirmada'
                ? html`<input class="form-check-input" type="checkbox" data-sel="${v.idParticipacao}" aria-label="Selecionar ${v.nome}">` : ''}</td>` : ''}
              <td><strong>${v.nome}</strong></td>
              <td>${v.regiao || '—'} ${v.mesmaRegiao ? html`<span class="badge text-bg-success">Mesma região</span>` : ''}</td>
              <td>${badge(v.situacao)}${OCUPAM_VAGA.slice(1).includes(v.situacao) ? html`<div class="small text-muted">${fmtHoras(v.horasRealizadas)}</div>` : ''}</td>
              <td class="num">${v.pontuacao}</td>
              <td class="num">${celulaTaxa(v.taxaComparecimento)}</td>
              <td class="small">${v.email || v.telefone
                ? html`${v.email ? html`<a href="mailto:${v.email}">${v.email}</a>` : ''}${v.telefone ? html`<div>${v.telefone}</div>` : ''}`
                : html`<span class="text-muted">Visível após a confirmação</span>`}</td>
              <td class="text-end text-nowrap">
                <button type="button" class="btn btn-outline-secondary btn-sm" data-resumo="${v.idVoluntario}">Histórico</button>
                ${podeAgir && v.situacao === 'selecionada' ? html`<button type="button" class="btn btn-outline-secondary btn-sm" data-desel="${v.idParticipacao}">Desselecionar</button>` : ''}
                ${podeAgir && PODE_NAO_APROVAR.includes(v.situacao) ? html`<button type="button" class="btn btn-outline-danger btn-sm" data-naoaprovar="${v.idParticipacao}" data-nome="${v.nome}"><i class="bi bi-x-circle" aria-hidden="true"></i> Não aprovar</button>` : ''}
                ${podeAgir && v.situacao === 'nao_aprovada' ? html`<button type="button" class="btn btn-outline-primary btn-sm" data-reconsiderar="${v.idParticipacao}"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i> Reconsiderar</button>` : ''}
              </td>
            </tr>`)}</tbody>
          </table></div></div>`
          : vazio('Nenhum voluntário compatível foi encontrado para esta demanda.', 'bi-people')}
      </section>

      ${podeAgir && lancaveis.length ? html`<section class="mt-4" aria-labelledby="t-pres">
        <h2 class="h5" id="t-pres">Registrar presença e horas</h2>
        <p class="small text-muted">Duração prevista: ${fmtHoras(duracao)}. Ao lançar a presença de todos os selecionados, a demanda é concluída.</p>
        <form id="form-presenca" class="card shadow-sm" novalidate>
          <div class="card-body">
            <div data-erros></div>
            <div class="table-responsive"><table class="table tabela-compacta mb-3">
              <thead><tr><th scope="col">Voluntário</th><th scope="col">Presença</th><th scope="col" style="width:150px">Horas realizadas</th></tr></thead>
              <tbody>${lancaveis.map((v) => html`<tr data-linha="${v.idParticipacao}">
                <td>${v.nome}</td>
                <td><div class="btn-group btn-group-sm" role="group" aria-label="Presença de ${v.nome}">
                  <input type="radio" class="btn-check" name="p${v.idParticipacao}" id="p${v.idParticipacao}c" value="compareceu" ${v.situacao === 'compareceu' ? raw('checked') : ''}>
                  <label class="btn btn-outline-success" for="p${v.idParticipacao}c">Compareceu</label>
                  <input type="radio" class="btn-check" name="p${v.idParticipacao}" id="p${v.idParticipacao}f" value="faltou" ${v.situacao === 'faltou' ? raw('checked') : ''}>
                  <label class="btn btn-outline-danger" for="p${v.idParticipacao}f">Faltou</label>
                </div></td>
                <td><input class="form-control form-control-sm" type="number" min="0" step="0.25" name="h${v.idParticipacao}" aria-label="Horas de ${v.nome}"
                  value="${v.situacao === 'compareceu' ? v.horasRealizadas : (v.situacao === 'faltou' ? 0 : duracao)}" ${v.situacao === 'faltou' ? raw('disabled') : ''}></td>
              </tr>`)}</tbody>
            </table></div>
            <button type="submit" class="btn btn-primary">Registrar presenças</button>
          </div>
        </form>
      </section>` : ''}`);

    ligarAcoes(d, vols, { podeAgir, duracao });
  }

  function ligarAcoes(d, vols, { podeAgir, duracao }) {
    ctx.el.querySelectorAll('[data-resumo]').forEach((b) => b.addEventListener('click', () => executar(b, () => abrirResumo(b.dataset.resumo))));

    const cancelar = ctx.el.querySelector('#cancelar-demanda');
    if (cancelar) {
      cancelar.addEventListener('click', async () => {
        if (!(await confirmar({
          titulo: 'Cancelar demanda', ok: 'Cancelar demanda', perigo: true,
          mensagem: 'Os voluntários envolvidos serão notificados do cancelamento. Deseja cancelar esta demanda?',
        }))) return;
        await executar(cancelar, async () => {
          await api.post(`/demandas/${d.id}/cancelar`);
          toast('Demanda cancelada.', 'warning');
          await desenhar();
        });
      });
    }

    const excluir = ctx.el.querySelector('#excluir-demanda');
    if (excluir) {
      excluir.addEventListener('click', async () => {
        if (!(await confirmar({
          titulo: 'Excluir demanda', ok: 'Excluir definitivamente', perigo: true,
          mensagem: 'A demanda será apagada junto com as inscrições, presenças, certificados e avisos ligados a ela. Esta ação não pode ser desfeita.',
        }))) return;
        await executar(excluir, async () => {
          await api.del(`/demandas/${d.id}`);
          toast('Demanda excluída.', 'warning');
          navegar('#/demandas');
        });
      });
    }

    if (!podeAgir) return;

    // Seleção (UC17)
    const botaoSel = ctx.el.querySelector('#selecionar');
    const resumoSel = ctx.el.querySelector('#resumo-selecao');
    const marcas = [...ctx.el.querySelectorAll('[data-sel]')];
    const ocupadas = vols.filter((v) => OCUPAM_VAGA.includes(v.situacao)).length;
    const livres = d.vagas - ocupadas;

    function atualizarSelecao() {
      const n = marcas.filter((m) => m.checked).length;
      botaoSel.disabled = n === 0 || n > livres;
      resumoSel.textContent = n > livres
        ? `Marcados: ${n} — só há ${Math.max(livres, 0)} vaga(s) livre(s).`
        : `Marcados: ${n} · vagas livres: ${Math.max(livres, 0)}`;
    }
    marcas.forEach((m) => m.addEventListener('change', atualizarSelecao));
    atualizarSelecao();

    botaoSel.addEventListener('click', () => executar(botaoSel, async () => {
      const idParticipacoes = marcas.filter((m) => m.checked).map((m) => Number(m.dataset.sel));
      await api.post(`/demandas/${d.id}/selecionar`, { idParticipacoes });
      toast('Voluntários selecionados e notificados.');
      await desenhar();
    }));

    ctx.el.querySelectorAll('[data-desel]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmar({
        titulo: 'Desselecionar voluntário', ok: 'Desselecionar', perigo: true,
        mensagem: 'O voluntário voltará à situação "confirmada" e a vaga será liberada.',
      }))) return;
      await executar(b, async () => {
        await api.post(`/demandas/${d.id}/desselecionar`, { idParticipacao: Number(b.dataset.desel) });
        toast('Seleção desfeita.');
        await desenhar();
      });
    }));

    // Não aprovar inscrição (vagas esgotadas, histórico de faltas...) e desfazer
    ctx.el.querySelectorAll('[data-naoaprovar]').forEach((b) => b.addEventListener('click', () => {
      const idParticipacao = Number(b.dataset.naoaprovar);
      const vol = vols.find((v) => v.idParticipacao === idParticipacao);
      const taxaBaixa = vol && vol.taxaComparecimento !== null && vol.taxaComparecimento !== undefined
        && (Number(vol.taxaComparecimento) > 1 ? Number(vol.taxaComparecimento) : Number(vol.taxaComparecimento) * 100) < 50;
      const sugerido = livres <= 0 ? 'vagas' : (taxaBaixa ? 'perfil' : '');
      const opcao = (valor, titulo, dica) => html`<label class="opcao-motivo">
        <input class="form-check-input" type="radio" name="motivo" value="${valor}" required ${sugerido === valor ? raw('checked') : ''}>
        <span><strong>${titulo}</strong><small>${dica}</small></span></label>`;
      modalFormulario({
        titulo: `Não aprovar ${b.dataset.nome}`,
        ok: 'Não aprovar',
        perigo: true,
        corpo: html`<p class="mb-3">A inscrição sai da lista de candidatos${vol?.situacao === 'selecionada' ? ' e a vaga é liberada' : ''}. O voluntário recebe um aviso; você pode reconsiderar depois.</p>
          <fieldset class="d-grid gap-2 mb-3"><legend class="form-label">Motivo</legend>
            ${opcao('vagas', 'Limite de vagas', 'As vagas já foram preenchidas por outros voluntários.')}
            ${opcao('perfil', 'Histórico de participação', `Ex.: muitas faltas em ações anteriores${vol && vol.taxaComparecimento !== null && vol.taxaComparecimento !== undefined ? ` (comparecimento: ${fmtTaxa(vol.taxaComparecimento)})` : ''}. O voluntário não vê este detalhe.`)}
            ${opcao('outro', 'Outro motivo', 'Explique na mensagem abaixo, se quiser.')}
          </fieldset>
          <label class="form-label" for="msg-nao-aprovar">Mensagem ao voluntário <span class="text-muted">(opcional)</span></label>
          <textarea class="form-control" id="msg-nao-aprovar" name="mensagem" rows="3" maxlength="500" placeholder="Ex.: Obrigado! Na próxima ação contamos com você."></textarea>`,
        aoSalvar: async (f) => {
          const motivo = f.querySelector('input[name=motivo]:checked')?.value;
          if (!motivo) throw new ErroForm('Escolha o motivo.');
          await api.post(`/demandas/${d.id}/nao-aprovar`, { idParticipacao, motivo, mensagem: f.elements.mensagem.value.trim() || undefined });
          toast('Inscrição não aprovada. O voluntário foi avisado.', 'warning');
          await desenhar();
        },
      });
    }));

    ctx.el.querySelectorAll('[data-reconsiderar]').forEach((b) => b.addEventListener('click', () => executar(b, async () => {
      await api.post(`/demandas/${d.id}/reconsiderar`, { idParticipacao: Number(b.dataset.reconsiderar) });
      toast('Inscrição reconsiderada: voltou para "confirmada".');
      await desenhar();
    })));

    // Presença (UC18)
    const formPres = ctx.el.querySelector('#form-presenca');
    if (!formPres) return;
    formPres.querySelectorAll('input[type=radio]').forEach((r) => r.addEventListener('change', () => {
      const linha = r.closest('tr');
      const horas = linha.querySelector('input[type=number]');
      if (r.value === 'faltou') {
        horas.disabled = true;
        horas.value = 0;
      } else {
        horas.disabled = false;
        if (!Number(horas.value)) horas.value = duracao;
      }
    }));
    aoEnviar(formPres, async () => {
      const registros = [];
      for (const linha of formPres.querySelectorAll('tr[data-linha]')) {
        const idPart = Number(linha.dataset.linha);
        const escolha = linha.querySelector('input[type=radio]:checked');
        if (!escolha) continue;
        const compareceu = escolha.value === 'compareceu';
        const registro = { idParticipacao: idPart, compareceu };
        if (compareceu) {
          const horas = Number(linha.querySelector('input[type=number]').value);
          if (!(horas >= 0)) throw new ErroForm('Informe horas válidas para quem compareceu.');
          registro.horas = horas;
        }
        registros.push(registro);
      }
      if (!registros.length) throw new ErroForm('Marque a presença de ao menos um voluntário.');
      const r = await api.post(`/demandas/${d.id}/presencas`, { registros });
      toast(r.situacao === 'concluida' ? 'Presenças registradas. A demanda foi concluída.' : 'Presenças registradas.');
      await desenhar();
    });
  }

  await desenhar();
}
