// Datas de ação são sempre horário de Brasília (UTC-3, sem horário de verão desde 2019).
const FUSO = 'America/Sao_Paulo';
const OFFSET = '-03:00';

/** Converte 'YYYY-MM-DDTHH:mm' (horário de Brasília) em Date. Devolve null se inválido. */
export function parseHorarioBrasilia(valor: unknown): Date | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}:00${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Limites de um intervalo 'YYYY-MM-DD' (inclusivo) em horário de Brasília. */
export function inicioDoDia(dia: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const d = new Date(`${dia}T00:00:00${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fimDoDia(dia: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const d = new Date(`${dia}T23:59:59.999${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export interface PartesLocais {
  ano: number;
  mes: number;
  dia: number;
  minutos: number; // minutos desde 00:00
}

export function partesLocais(d: Date): PartesLocais {
  const p: Record<string, string> = {};
  for (const parte of fmt.formatToParts(d)) p[parte.type] = parte.value;
  return {
    ano: +p.year,
    mes: +p.month,
    dia: +p.day,
    minutos: +p.hour * 60 + +p.minute,
  };
}

export function hhmmParaMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return +h * 60 + +m;
}

export function formatarDataHora(d: Date | string): string {
  return new Date(d).toLocaleString('pt-BR', {
    timeZone: FUSO,
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function formatarData(d: Date | string): string {
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: FUSO });
}
