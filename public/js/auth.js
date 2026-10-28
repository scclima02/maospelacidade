import { api } from './api.js';
import { state, carregarCatalogos } from './state.js';
import { homePara, navegar } from './router.js';
import {
  html, mount, aoEnviar, ErroForm, toast, alerta, fmtData, fmtHoras, executar, mensagensDe,
} from './ui.js';
import {
  blocoTermo, camposVoluntario, iniciarDisponibilidades, coletarVoluntario, SENHA_FORTE, DICA_SENHA,
} from './componentes.js';
import { NOME_PRODUTO, TAGLINE } from './cabecalho.js';
import { coracoesFlutuantes } from './landing.js';

// Painel de marca (aurora escura, corações flutuando) ao lado do formulário em vidro.
const painelMarca = (frase) => html`<aside class="auth-marca" aria-label="${NOME_PRODUTO}">
  <div class="auth-hearts" aria-hidden="true">${coracoesFlutuantes}</div>
  <div class="marca-topo">
    <img src="img/logo.svg" alt="" width="62" height="62">
    <div><span class="sub">${TAGLINE}</span><h2>${NOME_PRODUTO}</h2></div>
  </div>
  <p class="frase">${frase}</p>
  <p class="assina"><i class="bi bi-building-fill" aria-hidden="true"></i> Uma iniciativa da ${state.config.nomeOrganizacao}</p>
</aside>`;

const FRASE = 'Juntos, mudamos a cidade com as próprias mãos.';

const layoutAuth = (conteudo, { modo = '', frase = FRASE } = {}) => html`<div class="auth ${modo}">
  ${painelMarca(frase)}
  <div class="auth-form"><div class="card"><div class="card-body">${conteudo}</div></div></div>
</div>`;

const cartaoSimples = (conteudo) => html`<div class="auth estreito">
  <div class="auth-form"><div class="card"><div class="card-body">${conteudo}</div></div></div>
</div>`;

export function telaLogin({ el }) {
  mount(el, layoutAuth(html`
    <h1 tabindex="-1">Que bom ter você de volta</h1>
    <p class="intro">Entre com seu e-mail e senha para ver as ações da sua cidade.</p>
    <form novalidate>
      <div data-erros></div>
      <div class="mb-3">
        <label class="form-label" for="l-email">E-mail</label>
        <div class="campo"><i class="bi bi-envelope" aria-hidden="true"></i>
          <input class="form-control" type="email" id="l-email" name="email" required autocomplete="username" placeholder="voce@exemplo.com">
          <div class="invalid-feedback">Informe seu e-mail.</div></div>
      </div>
      <div class="mb-4">
        <label class="form-label" for="l-senha">Senha</label>
        <div class="campo"><i class="bi bi-lock" aria-hidden="true"></i>
          <input class="form-control" type="password" id="l-senha" name="senha" required autocomplete="current-password" placeholder="Sua senha">
          <div class="invalid-feedback">Informe sua senha.</div></div>
      </div>
      <button class="btn btn-primary w-100" type="submit">Entrar <i class="bi bi-arrow-right" aria-hidden="true"></i></button>
    </form>
    <div class="auth-links">
      <a href="#/recuperar-senha">Esqueci minha senha</a>
      <a href="#/cadastro">Quero ser voluntário</a>
    </div>`));

  aoEnviar(el.querySelector('form'), async (form) => {
    const r = await api.post('/auth/login', {
      email: form.elements.email.value.trim(),
      senha: form.elements.senha.value,
    }, { semRedirecionar: true });
    state.usuario = r.usuario;
    navegar(homePara(r.usuario.perfil));
  });
}

export async function telaCadastro({ el }) {
  const { areas, regioes } = await carregarCatalogos(true);
  const termo = state.config.termo;

  mount(el, layoutAuth(html`
    <h1 tabindex="-1">Cadastro de voluntário</h1>
    <p class="intro">Informe seus dados e sua disponibilidade para receber oportunidades compatíveis.</p>
    <form novalidate>
      <div data-erros></div>
      ${camposVoluntario({ areas, regioes })}

      <div class="row g-3 mt-1">
        <div class="col-12 col-md-6">
          <label class="form-label" for="v-senha">Senha</label>
          <input class="form-control" type="password" id="v-senha" name="senha" required minlength="8" autocomplete="new-password" aria-describedby="v-senha-dica">
          <div class="form-text" id="v-senha-dica">${DICA_SENHA}</div>
          <div class="invalid-feedback">Informe uma senha com ao menos 8 caracteres.</div>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label" for="v-senha2">Confirmar senha</label>
          <input class="form-control" type="password" id="v-senha2" name="senha2" required autocomplete="new-password">
          <div class="invalid-feedback">Repita a senha.</div>
        </div>
      </div>

      <section class="mt-4" aria-labelledby="t-termo">
        <h2 class="h6" id="t-termo">Termo de uso e política de privacidade (LGPD)</h2>
        ${blocoTermo(termo)}
        <div class="form-check mt-3">
          <input class="form-check-input" type="checkbox" id="v-aceite" name="aceite" required>
          <label class="form-check-label" for="v-aceite">Li e aceito o termo de uso e a política de privacidade${state.config.termoVersao ? ` (versão ${state.config.termoVersao})` : ''}.</label>
          <div class="invalid-feedback">É necessário aceitar o termo para concluir o cadastro.</div>
        </div>
      </section>

      <button class="btn btn-primary mt-4" type="submit">Concluir cadastro</button>
      <a class="btn btn-link mt-4" href="#/login">Já tenho conta</a>
    </form>`, { modo: 'amplo', frase: 'Cadastre-se e receba ações que combinam com você.' }));

  aoEnviar(el.querySelector('form'), async (form) => {
    const { dados, erros } = coletarVoluntario(form);
    const senha = form.elements.senha.value;
    if (!SENHA_FORTE.test(senha)) erros.push(`Senha fraca. ${DICA_SENHA}`);
    if (senha !== form.elements.senha2.value) erros.push('A confirmação de senha não confere.');
    if (erros.length) throw new ErroForm(erros);

    const r = await api.post('/voluntarios/cadastro', { ...dados, senha, aceiteTermo: true }, { semRedirecionar: true });
    state.usuario = r.usuario;
    toast('Cadastro concluído! Bem-vindo(a) ao voluntariado.');
    navegar(homePara('voluntario'));
  });
  iniciarDisponibilidades(el.querySelector('form'));
}

export function telaRecuperarSenha({ el }) {
  mount(el, layoutAuth(html`
    <h1 tabindex="-1">Recuperar senha</h1>
    <p class="intro">Informe o e-mail cadastrado. Enviaremos um link para você criar uma nova senha.</p>
    <div id="resultado"></div>
    <form novalidate>
      <div data-erros></div>
      <div class="mb-3">
        <label class="form-label" for="r-email">E-mail</label>
        <div class="campo"><i class="bi bi-envelope" aria-hidden="true"></i>
          <input class="form-control" type="email" id="r-email" name="email" required autocomplete="email" placeholder="voce@exemplo.com">
          <div class="invalid-feedback">Informe um e-mail válido.</div></div>
      </div>
      <button class="btn btn-primary w-100" type="submit">Enviar link de redefinição</button>
    </form>
    <div class="auth-links"><a href="#/login"><i class="bi bi-arrow-left" aria-hidden="true"></i> Voltar ao login</a></div>`));

  const form = el.querySelector('form');
  aoEnviar(form, async () => {
    const r = await api.post('/auth/recuperar-senha', { email: form.elements.email.value.trim() }, { semRedirecionar: true });
    mount(el.querySelector('#resultado'), alerta('success', r.mensagem || 'Se o e-mail estiver cadastrado, você receberá as instruções em instantes.'));
    form.reset();
    form.classList.remove('was-validated');
  });
}

export function telaRedefinirSenha({ el, query }) {
  const token = query.token;
  if (!token) {
    mount(el, layoutAuth(html`
      <h1 tabindex="-1">Redefinir senha</h1>
      ${alerta('danger', 'Link inválido: o código de redefinição não foi informado.')}
      <a href="#/recuperar-senha">Solicitar um novo link</a>`));
    return;
  }
  mount(el, layoutAuth(html`
    <h1 tabindex="-1">Definir nova senha</h1>
    <p class="intro">Escolha uma nova senha para sua conta.</p>
    <div id="resultado"></div>
    <form novalidate>
      <div data-erros></div>
      <div class="mb-3">
        <label class="form-label" for="n-senha">Nova senha</label>
        <input class="form-control" type="password" id="n-senha" name="senha" required minlength="8" autocomplete="new-password" aria-describedby="n-dica">
        <div class="form-text" id="n-dica">${DICA_SENHA}</div>
        <div class="invalid-feedback">Informe uma senha com ao menos 8 caracteres.</div>
      </div>
      <div class="mb-3">
        <label class="form-label" for="n-senha2">Confirmar nova senha</label>
        <input class="form-control" type="password" id="n-senha2" name="senha2" required autocomplete="new-password">
        <div class="invalid-feedback">Repita a senha.</div>
      </div>
      <button class="btn btn-primary w-100" type="submit">Salvar nova senha</button>
    </form>`));

  const form = el.querySelector('form');
  aoEnviar(form, async () => {
    const senha = form.elements.senha.value;
    const erros = [];
    if (!SENHA_FORTE.test(senha)) erros.push(`Senha fraca. ${DICA_SENHA}`);
    if (senha !== form.elements.senha2.value) erros.push('A confirmação de senha não confere.');
    if (erros.length) throw new ErroForm(erros);
    const r = await api.post('/auth/redefinir-senha', { token, senha }, { semRedirecionar: true });
    form.remove();
    mount(el.querySelector('#resultado'), html`${alerta('success', r.mensagem || 'Senha alterada com sucesso.')}
      <a class="btn btn-primary" href="#/login">Ir para o login</a>`);
  });
}

export async function telaValidarCertificado({ el, query }) {
  mount(el, cartaoSimples(html`
    <h1 tabindex="-1">Validar certificado</h1>
    <p class="intro">Digite o código de validação impresso no certificado de participação.</p>
    <form novalidate class="mb-3">
      <div class="input-group">
        <input class="form-control" id="c-codigo" name="codigo" required placeholder="VOL-XXXX-XXXX-XXXX" aria-label="Código de validação" autocomplete="off" value="${query.codigo || ''}">
        <button class="btn btn-primary" type="submit">Validar</button>
      </div>
      <div class="invalid-feedback">Informe o código.</div>
    </form>
    <div id="resultado" aria-live="polite"></div>`));

  const form = el.querySelector('form');
  const saida = el.querySelector('#resultado');

  async function validar(codigo) {
    mount(saida, html`<div class="text-center text-muted py-2"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Verificando…</div>`);
    try {
      const r = await api.get(`/certificados/validar/${encodeURIComponent(codigo)}`, { semRedirecionar: true });
      mount(saida, html`<div class="alert alert-success" role="status">
        <h2 class="h6"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> Certificado válido</h2>
        <dl class="row mb-0">
          <dt class="col-sm-4">Voluntário(a)</dt><dd class="col-sm-8">${r.nome}</dd>
          <dt class="col-sm-4">Ação</dt><dd class="col-sm-8">${r.acao}</dd>
          <dt class="col-sm-4">Data</dt><dd class="col-sm-8">${fmtData(r.data)}</dd>
          <dt class="col-sm-4">Horas</dt><dd class="col-sm-8">${fmtHoras(r.horas)}</dd>
        </dl></div>`);
    } catch (e) {
      mount(saida, alerta(e.status === 404 ? 'warning' : 'danger',
        e.status === 404 ? 'Código não encontrado. Confira os caracteres e tente novamente.' : mensagensDe(e).join(' ')));
    }
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    form.classList.add('was-validated');
    const codigo = form.elements.codigo.value.trim().toUpperCase();
    if (codigo) validar(codigo);
  });
  if (query.codigo) await executar(null, () => validar(query.codigo.trim().toUpperCase()));
}
