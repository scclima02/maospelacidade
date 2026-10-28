import { parseHorarioBrasilia } from '../common/datas';
import { Candidato, cobrePeriodo, cruzar } from './cruzamento';

const d = (s: string) => parseHorarioBrasilia(s)!;
// 2026-11-07 é sábado (diaSemana 6); 2026-11-08 é domingo (0)

describe('cobrePeriodo (UC12 / RN14)', () => {
  const sabado = [{ diaSemana: 6, horaInicio: '08:00', horaFim: '18:00' }];

  it('aceita período totalmente dentro da faixa', () => {
    expect(cobrePeriodo(sabado, d('2026-11-07T10:00'), d('2026-11-07T12:00'))).toBe(true);
  });

  it('aceita limites exatos da faixa', () => {
    expect(cobrePeriodo(sabado, d('2026-11-07T08:00'), d('2026-11-07T18:00'))).toBe(true);
  });

  it('rejeita período que ultrapassa o fim da faixa', () => {
    expect(cobrePeriodo(sabado, d('2026-11-07T17:00'), d('2026-11-07T19:00'))).toBe(false);
  });

  it('rejeita dia da semana sem disponibilidade', () => {
    expect(cobrePeriodo(sabado, d('2026-11-08T10:00'), d('2026-11-08T12:00'))).toBe(false);
  });

  it('exige que todos os dias de uma ação em vários dias estejam cobertos', () => {
    const fimDeSemana = [
      { diaSemana: 6, horaInicio: '08:00', horaFim: '23:59' },
      { diaSemana: 0, horaInicio: '00:00', horaFim: '18:00' },
    ];
    expect(cobrePeriodo(fimDeSemana, d('2026-11-07T20:00'), d('2026-11-08T10:00'))).toBe(true);
    expect(cobrePeriodo(sabado, d('2026-11-07T20:00'), d('2026-11-08T10:00'))).toBe(false);
  });

  it('usa o horário de Brasília (não UTC) para decidir o dia', () => {
    // 22:00 em Brasília do sábado = 01:00 UTC do domingo
    expect(cobrePeriodo([{ diaSemana: 6, horaInicio: '20:00', horaFim: '23:00' }], d('2026-11-07T22:00'), d('2026-11-07T23:00'))).toBe(true);
  });

  it('rejeita período inválido', () => {
    expect(cobrePeriodo(sabado, d('2026-11-07T12:00'), d('2026-11-07T10:00'))).toBe(false);
  });
});

describe('cruzar (RN14–RN17)', () => {
  const faixa = [{ diaSemana: 6, horaInicio: '08:00', horaFim: '18:00' }];
  const base = (o: Partial<Candidato>): Candidato => ({
    idVoluntario: 1,
    nome: 'Ana',
    email: 'a@x.com',
    idRegiao: 1,
    taxa: 0,
    faixas: faixa,
    ...o,
  });
  const demanda = { idRegiao: 1, inicio: d('2026-11-07T10:00'), fim: d('2026-11-07T12:00') };
  const pesos = { pesoBase: 50, pesoRegiao: 50 };

  it('região pontua, mas não elimina', () => {
    const r = cruzar([base({ idVoluntario: 1, idRegiao: 2 }), base({ idVoluntario: 2, nome: 'Bia', idRegiao: 1 })], demanda, pesos);
    expect(r.map((x) => [x.idVoluntario, x.pontuacao])).toEqual([[2, 100], [1, 50]]);
  });

  it('elimina quem não tem disponibilidade que cubra o período', () => {
    const r = cruzar([base({ faixas: [{ diaSemana: 6, horaInicio: '14:00', horaFim: '18:00' }] })], demanda, pesos);
    expect(r).toEqual([]);
  });

  it('taxa de comparecimento desempata pontuações iguais', () => {
    const r = cruzar([base({ idVoluntario: 1, nome: 'Ana', taxa: 0.5 }), base({ idVoluntario: 2, nome: 'Bia', taxa: 1 })], demanda, pesos);
    expect(r.map((x) => x.idVoluntario)).toEqual([2, 1]);
  });

  it('respeita pesos configuráveis', () => {
    const [r] = cruzar([base({})], demanda, { pesoBase: 10, pesoRegiao: 5 });
    expect(r.pontuacao).toBe(15);
  });
});
