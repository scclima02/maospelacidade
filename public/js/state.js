import { api } from './api.js';

export const state = {
  usuario: null,
  config: {
    nomeOrganizacao: 'Prefeitura Municipal',
    termoVersao: '',
    termo: null,
  },
  naoLidas: 0,
  catalogos: null,
};

// Áreas e regiões ativas (usadas em formulários e filtros).
export async function carregarCatalogos(forcar = false) {
  if (!state.catalogos || forcar) {
    const [areas, regioes] = await Promise.all([api.get('/catalogos/areas'), api.get('/catalogos/regioes')]);
    state.catalogos = { areas, regioes };
  }
  return state.catalogos;
}
