import { Injectable } from '@nestjs/common';
import { DatabaseService, Db } from './database.service';

export interface Configuracao {
  pesoBase: number;
  pesoRegiao: number;
  retencaoMeses: number;
  nomeOrganizacao: string;
  termoVersao: string;
}

const MAPA: Record<keyof Configuracao, string> = {
  pesoBase: 'peso_base',
  pesoRegiao: 'peso_regiao',
  retencaoMeses: 'retencao_meses',
  nomeOrganizacao: 'nome_organizacao',
  termoVersao: 'termo_versao',
};

@Injectable()
export class ConfiguracaoService {
  constructor(private readonly db: DatabaseService) {}

  async obter(db: Pick<Db, 'query'> = this.db): Promise<Configuracao> {
    const linhas = await db.query<{ chave: string; valor: string }>('SELECT chave, valor FROM configuracao');
    const v = Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
    return {
      pesoBase: Number(v.peso_base ?? 50),
      pesoRegiao: Number(v.peso_regiao ?? 50),
      retencaoMeses: Number(v.retencao_meses ?? 24),
      nomeOrganizacao: v.nome_organizacao ?? 'Prefeitura Municipal',
      termoVersao: v.termo_versao ?? '1.0',
    };
  }

  async atualizar(parcial: Partial<Configuracao>): Promise<Configuracao> {
    for (const [campo, valor] of Object.entries(parcial)) {
      if (valor === undefined || !(campo in MAPA)) continue;
      await this.db.query(
        `INSERT INTO configuracao (chave, valor) VALUES ($1, $2)
         ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
        [MAPA[campo as keyof Configuracao], String(valor)],
      );
    }
    return this.obter();
  }
}
