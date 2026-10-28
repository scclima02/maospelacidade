const BASE = '/api';

let aoNaoAutorizado = null;

export function definirAoNaoAutorizado(fn) {
  aoNaoAutorizado = fn;
}

export class ApiError extends Error {
  constructor(status, mensagens, payload) {
    super(mensagens.join(' '));
    this.status = status;
    this.mensagens = mensagens;
    this.payload = payload;
  }
}

async function requisitar(metodo, caminho, corpo, opcoes = {}) {
  const init = {
    method: metodo,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };
  if (corpo !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(corpo);
  }

  let resp;
  try {
    resp = await fetch(BASE + caminho, init);
  } catch {
    throw new ApiError(0, ['Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.']);
  }

  let dados = null;
  const tipo = resp.headers.get('content-type') || '';
  if (resp.status !== 204 && tipo.includes('application/json')) {
    dados = await resp.json().catch(() => null);
  }

  if (!resp.ok) {
    const msg = dados && dados.message;
    const mensagens = Array.isArray(msg) ? msg : [msg || `Erro ${resp.status} ao processar a solicitação.`];
    if (resp.status === 401 && !opcoes.semRedirecionar && aoNaoAutorizado) aoNaoAutorizado();
    throw new ApiError(resp.status, mensagens, dados);
  }
  return dados;
}

export const api = {
  get: (caminho, opcoes) => requisitar('GET', caminho, undefined, opcoes),
  post: (caminho, corpo, opcoes) => requisitar('POST', caminho, corpo ?? {}, opcoes),
  put: (caminho, corpo, opcoes) => requisitar('PUT', caminho, corpo ?? {}, opcoes),
  del: (caminho, opcoes) => requisitar('DELETE', caminho, undefined, opcoes),
};

// Monta a query string ignorando valores vazios.
export function qs(obj = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    p.set(k, v === true ? '1' : v);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
