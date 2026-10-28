import { hhmmParaMinutos, partesLocais } from '../common/datas';

export interface FaixaDisponivel {
  diaSemana: number; // 0 = domingo
  horaInicio: string; // HH:mm
  horaFim: string; // HH:mm
}

export interface Candidato {
  idVoluntario: number;
  nome: string;
  email: string;
  idRegiao: number | null;
  taxa: number; // 0..1 (sem histórico = 0)
  faixas: FaixaDisponivel[];
}

export interface Compativel {
  idVoluntario: number;
  nome: string;
  email: string;
  pontuacao: number;
  taxa: number;
}

/**
 * UC12 (RN14): a disponibilidade deve cobrir TODO o período da ação.
 * Cada dia do período (em horário de Brasília) precisa estar coberto por uma única faixa
 * do dia da semana correspondente.
 */
export function cobrePeriodo(faixas: FaixaDisponivel[], inicio: Date, fim: Date): boolean {
  if (fim <= inicio) return false;
  const a = partesLocais(inicio);
  const b = partesLocais(fim);
  const dia0 = Date.UTC(a.ano, a.mes - 1, a.dia);
  const diaN = Date.UTC(b.ano, b.mes - 1, b.dia);
  const MS_DIA = 86_400_000;

  for (let t = dia0; t <= diaN; t += MS_DIA) {
    const ehPrimeiro = t === dia0;
    const ehUltimo = t === diaN;
    const de = ehPrimeiro ? a.minutos : 0;
    const ate = ehUltimo ? b.minutos : 1440;
    if (ate <= de) continue; // término à meia-noite exata: nada a cobrir neste dia
    const dow = new Date(t).getUTCDay();
    const coberto = faixas.some((f) => {
      if (f.diaSemana !== dow) return false;
      const fi = hhmmParaMinutos(f.horaInicio);
      // uma faixa até 23:59 vale até a meia-noite
      const ff = hhmmParaMinutos(f.horaFim) >= 1439 ? 1440 : hhmmParaMinutos(f.horaFim);
      return fi <= de && ff >= ate;
    });
    if (!coberto) return false;
  }
  return true;
}

/**
 * UC12 (RN14-RN17): área e disponibilidade eliminam (a área já foi filtrada na consulta);
 * região só pontua; a taxa de comparecimento desempata.
 */
export function cruzar(
  candidatos: Candidato[],
  demanda: { idRegiao: number; inicio: Date; fim: Date },
  pesos: { pesoBase: number; pesoRegiao: number },
): Compativel[] {
  return candidatos
    .filter((c) => cobrePeriodo(c.faixas, demanda.inicio, demanda.fim))
    .map((c) => ({
      idVoluntario: c.idVoluntario,
      nome: c.nome,
      email: c.email,
      pontuacao: pesos.pesoBase + (c.idRegiao === demanda.idRegiao ? pesos.pesoRegiao : 0),
      taxa: c.taxa,
    }))
    .sort((x, y) => y.pontuacao - x.pontuacao || y.taxa - x.taxa || x.nome.localeCompare(y.nome, 'pt-BR'));
}
