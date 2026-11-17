import { Injectable, Logger } from '@nestjs/common';

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

/** Cidade usada para completar o endereço a partir do nome da região (ex.: "Porto Alegre – Zona Sul"). */
export function cidadeDaRegiao(regiao: string): string | null {
  if (/online|remot/i.test(regiao)) return null;
  const cidade = regiao.split(/\s[–-]\s/)[0].trim();
  return cidade || null;
}

/**
 * Converte endereço em coordenadas pelo Nominatim (OpenStreetMap).
 * Nunca lança: sem resposta, a demanda é salva sem coordenadas e só não aparece no mapa.
 */
@Injectable()
export class GeocodificacaoService {
  private readonly log = new Logger(GeocodificacaoService.name);

  get habilitado(): boolean {
    return process.env.NODE_ENV !== 'test' && process.env.GEOCODIFICACAO !== '0';
  }

  async localizar(local: string, regiao: string): Promise<Coordenadas | null> {
    const cidade = cidadeDaRegiao(regiao);
    if (!this.habilitado || !cidade) return null;
    // Sem cair para o centro da cidade: um ponto errado no mapa engana mais do que a ausência dele.
    const tentativas = [`${local}, ${cidade}, RS, Brasil`];
    for (const q of tentativas) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
        const r = await fetch(url, {
          headers: { 'User-Agent': 'MaosPelaCidade/1.0 (+https://svgmunicipal-teal.vercel.app)', 'Accept-Language': 'pt-BR' },
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) continue;
        const [achado] = (await r.json()) as { lat: string; lon: string }[];
        if (achado) return { latitude: Number(achado.lat), longitude: Number(achado.lon) };
      } catch (e: any) {
        this.log.warn(`Falha ao localizar "${q}": ${e?.message ?? e}`);
      }
    }
    return null;
  }
}
