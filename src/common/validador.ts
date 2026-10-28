import { BadRequestException } from '@nestjs/common';
import { parseHorarioBrasilia } from './datas';

export interface Faixa {
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validação de corpo de requisição com mensagens em português. */
export class Validador {
  readonly erros: string[] = [];
  private readonly corpo: Record<string, any>;

  constructor(corpo: unknown) {
    this.corpo = corpo && typeof corpo === 'object' && !Array.isArray(corpo) ? (corpo as any) : {};
  }

  erro(msg: string) {
    this.erros.push(msg);
  }

  texto(campo: string, rotulo: string, op: { min?: number; max?: number; opcional?: boolean } = {}): string | undefined {
    const { min = 1, max = 255, opcional = false } = op;
    const v = this.corpo[campo];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      if (!opcional) this.erro(`${rotulo} é obrigatório.`);
      return undefined;
    }
    if (typeof v !== 'string') {
      this.erro(`${rotulo} é inválido.`);
      return undefined;
    }
    const t = v.trim();
    if (t.length < min) this.erro(`${rotulo} deve ter ao menos ${min} caracteres.`);
    if (t.length > max) this.erro(`${rotulo} deve ter no máximo ${max} caracteres.`);
    return t;
  }

  email(campo = 'email', rotulo = 'E-mail'): string | undefined {
    const v = this.texto(campo, rotulo, { max: 190 });
    if (v !== undefined && !EMAIL.test(v)) {
      this.erro(`${rotulo} inválido.`);
      return undefined;
    }
    return v?.toLowerCase();
  }

  senha(campo = 'senha', rotulo = 'Senha'): string | undefined {
    const v = this.corpo[campo];
    if (typeof v !== 'string' || v.length === 0) {
      this.erro(`${rotulo} é obrigatória.`);
      return undefined;
    }
    if (v.length < 8 || v.length > 72 || !/[A-Za-z]/.test(v) || !/\d/.test(v)) {
      this.erro(`${rotulo} deve ter de 8 a 72 caracteres, com letras e números.`);
      return undefined;
    }
    return v;
  }

  inteiro(campo: string, rotulo: string, op: { min?: number; max?: number; opcional?: boolean } = {}): number | undefined {
    const { min = 1, max = 2147483647, opcional = false } = op;
    const v = this.corpo[campo];
    if (v === undefined || v === null || v === '') {
      if (!opcional) this.erro(`${rotulo} é obrigatório.`);
      return undefined;
    }
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+$/.test(v) ? +v : NaN;
    if (!Number.isInteger(n) || n < min || n > max) {
      this.erro(`${rotulo} inválido.`);
      return undefined;
    }
    return n;
  }

  booleano(campo: string, opcional = true): boolean | undefined {
    const v = this.corpo[campo];
    if (v === undefined || v === null) return undefined;
    if (typeof v !== 'boolean') {
      if (!opcional) this.erro(`${campo} inválido.`);
      return undefined;
    }
    return v;
  }

  listaInteiros(campo: string, rotulo: string, min = 0): number[] {
    const v = this.corpo[campo];
    if (!Array.isArray(v) || v.some((x) => !Number.isInteger(x) || x < 1)) {
      this.erro(`${rotulo} inválido.`);
      return [];
    }
    const unicos = [...new Set<number>(v)];
    if (unicos.length < min) this.erro(`Informe ao menos ${min} em ${rotulo.toLowerCase()}.`);
    return unicos;
  }

  dataHora(campo: string, rotulo: string): Date | undefined {
    const v = this.corpo[campo];
    if (v === undefined || v === null || v === '') {
      this.erro(`${rotulo} é obrigatório.`);
      return undefined;
    }
    const d = parseHorarioBrasilia(v);
    if (!d) {
      this.erro(`${rotulo} inválido (use AAAA-MM-DDTHH:mm).`);
      return undefined;
    }
    return d;
  }

  faixas(campo: string, rotulo: string, min = 1): Faixa[] {
    const v = this.corpo[campo];
    if (!Array.isArray(v)) {
      this.erro(`${rotulo} inválida.`);
      return [];
    }
    if (v.length < min) this.erro(`Informe ao menos ${min} faixa de ${rotulo.toLowerCase()}.`);
    if (v.length > 50) {
      this.erro(`${rotulo}: muitas faixas informadas.`);
      return [];
    }
    const saida: Faixa[] = [];
    for (const f of v) {
      const dia = f?.diaSemana;
      if (!Number.isInteger(dia) || dia < 0 || dia > 6 || !HHMM.test(f?.horaInicio ?? '') || !HHMM.test(f?.horaFim ?? '')) {
        this.erro(`${rotulo}: faixa inválida.`);
        continue;
      }
      if (f.horaFim <= f.horaInicio) {
        this.erro(`${rotulo}: o horário final deve ser maior que o inicial.`);
        continue;
      }
      saida.push({ diaSemana: dia, horaInicio: f.horaInicio, horaFim: f.horaFim });
    }
    return saida;
  }

  concluir() {
    if (this.erros.length) throw new BadRequestException(this.erros.length === 1 ? this.erros[0] : this.erros);
  }
}

/** Query string 'YYYY-MM-DD' opcional. */
export function diaOpcional(v: unknown): string | undefined {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

export function inteiroOpcional(v: unknown): number | undefined {
  return typeof v === 'string' && /^\d{1,9}$/.test(v) ? +v : undefined;
}
