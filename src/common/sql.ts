/**
 * Taxa de comparecimento (0..1) de um voluntário: compareceu / (compareceu + faltou).
 * Devolve NULL quando ainda não há histórico. `coluna` é uma expressão SQL do id do voluntário.
 */
export const taxaComparecimentoSql = (coluna: string) => `(
  SELECT (COUNT(*) FILTER (WHERE x.situacao = 'compareceu'))::float8
         / NULLIF(COUNT(*) FILTER (WHERE x.situacao IN ('compareceu','faltou')), 0)
  FROM participacao x WHERE x.id_voluntario = ${coluna}
)`;

/** Escapa curingas de LIKE/ILIKE em texto digitado pelo usuário. */
export const escaparLike = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Códigos de erro do PostgreSQL usados pelo sistema. */
export const PG_VIOLACAO_UNICA = '23505';
