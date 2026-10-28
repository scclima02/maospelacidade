import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

export interface DadosCertificado {
  organizacao: string;
  nome: string;
  acao: string;
  data: string;
  horas: number;
  codigo: string;
  urlValidacao: string;
}

export interface LinhaTabela {
  colunas: string[];
}

export interface TabelaPdf {
  titulo: string;
  cabecalho: string[];
  larguras: number[]; // proporções
  linhas: string[][];
}

const AZUL = rgb(0.1, 0.27, 0.5);
const CINZA = rgb(0.35, 0.35, 0.35);

@Injectable()
export class PdfService {
  /** Remove caracteres que a fonte padrão não codifica (evita exceção do pdf-lib). */
  private limpar(font: PDFFont, texto: string): string {
    let saida = '';
    for (const ch of texto.replace(/\s+/g, ' ')) {
      try {
        font.encodeText(ch);
        saida += ch;
      } catch {
        saida += '?';
      }
    }
    return saida;
  }

  private centralizar(page: PDFPage, font: PDFFont, texto: string, y: number, tamanho: number, cor = rgb(0, 0, 0)) {
    const t = this.limpar(font, texto);
    const largura = font.widthOfTextAtSize(t, tamanho);
    page.drawText(t, { x: (page.getWidth() - largura) / 2, y, size: tamanho, font, color: cor });
  }

  private quebrar(font: PDFFont, texto: string, tamanho: number, larguraMax: number): string[] {
    const palavras = this.limpar(font, texto).split(' ');
    const linhas: string[] = [];
    let atual = '';
    for (const p of palavras) {
      const tentativa = atual ? `${atual} ${p}` : p;
      if (font.widthOfTextAtSize(tentativa, tamanho) <= larguraMax || !atual) atual = tentativa;
      else {
        linhas.push(atual);
        atual = p;
      }
    }
    if (atual) linhas.push(atual);
    return linhas;
  }

  async certificado(d: DadosCertificado): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([842, 595]);
    const normal = await doc.embedFont(StandardFonts.Helvetica);
    const negrito = await doc.embedFont(StandardFonts.HelveticaBold);

    page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: AZUL, borderWidth: 3 });
    page.drawRectangle({ x: 34, y: 34, width: 774, height: 527, borderColor: AZUL, borderWidth: 1 });

    this.centralizar(page, negrito, d.organizacao.toUpperCase(), 505, 16, AZUL);
    this.centralizar(page, negrito, 'CERTIFICADO DE PARTICIPAÇÃO', 450, 30, AZUL);
    this.centralizar(page, normal, 'Programa de Voluntariado Municipal', 425, 12, CINZA);

    this.centralizar(page, normal, 'Certificamos que', 370, 14);
    this.centralizar(page, negrito, d.nome, 335, 26);

    const horas = String(d.horas).replace('.', ',');
    const corpo = `participou como voluntário(a) da ação "${d.acao}", realizada em ${d.data}, com carga horária de ${horas} hora(s) de trabalho voluntário.`;
    const linhas = this.quebrar(normal, corpo, 14, 640);
    let y = 285;
    for (const l of linhas) {
      this.centralizar(page, normal, l, y, 14);
      y -= 22;
    }

    this.centralizar(page, normal, 'Agradecemos a sua dedicação à comunidade.', y - 20, 13, CINZA);

    this.centralizar(page, negrito, `Código de validação: ${d.codigo}`, 100, 13, AZUL);
    this.centralizar(page, normal, `Valide em: ${d.urlValidacao}`, 80, 10, CINZA);

    return doc.save();
  }

  /** Relatório simples em A4 com resumo e tabelas paginadas. */
  async relatorio(titulo: string, subtitulo: string, resumo: string[], tabelas: TabelaPdf[]): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const normal = await doc.embedFont(StandardFonts.Helvetica);
    const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
    const L = 595;
    const A = 842;
    const margem = 40;
    const util = L - margem * 2;

    let page = doc.addPage([L, A]);
    let y = A - margem;

    const novaPagina = () => {
      page = doc.addPage([L, A]);
      y = A - margem;
    };
    const garantir = (altura: number) => {
      if (y - altura < margem) novaPagina();
    };

    page.drawText(this.limpar(negrito, titulo), { x: margem, y: y - 16, size: 18, font: negrito, color: AZUL });
    y -= 36;
    for (const l of this.quebrar(normal, subtitulo, 10, util)) {
      page.drawText(l, { x: margem, y, size: 10, font: normal, color: CINZA });
      y -= 14;
    }
    y -= 6;
    for (const r of resumo) {
      garantir(16);
      page.drawText(this.limpar(normal, r), { x: margem, y, size: 11, font: normal });
      y -= 16;
    }
    y -= 8;

    for (const t of tabelas) {
      garantir(60);
      page.drawText(this.limpar(negrito, t.titulo), { x: margem, y, size: 13, font: negrito, color: AZUL });
      y -= 20;
      const soma = t.larguras.reduce((a, b) => a + b, 0);
      const larg = t.larguras.map((p) => (p / soma) * util);

      const desenharLinha = (celulas: string[], fonte: PDFFont, fundo?: ReturnType<typeof rgb>) => {
        const quebras = celulas.map((c, i) => this.quebrar(fonte, c, 9, larg[i] - 6));
        const linhasMax = Math.max(...quebras.map((q) => Math.max(q.length, 1)));
        const altura = linhasMax * 11 + 6;
        garantir(altura);
        if (fundo) page.drawRectangle({ x: margem, y: y - altura + 4, width: util, height: altura, color: fundo });
        let x = margem;
        quebras.forEach((q, i) => {
          q.forEach((txt, k) => page.drawText(txt, { x: x + 3, y: y - 8 - k * 11, size: 9, font: fonte }));
          x += larg[i];
        });
        y -= altura;
      };

      desenharLinha(t.cabecalho, negrito, rgb(0.88, 0.92, 0.97));
      if (t.linhas.length === 0) desenharLinha(['Nenhum registro no filtro selecionado.'], normal);
      for (const linha of t.linhas) desenharLinha(linha, normal);
      y -= 14;
    }

    return doc.save();
  }
}
