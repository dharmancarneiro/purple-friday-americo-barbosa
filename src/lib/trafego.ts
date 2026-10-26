import type { AnuncioDia, AnuncioInfo } from './data';
import { div, pct } from './format';

export type Soma = {
  gasto: number;
  impressoes: number;
  cliques: number;
  leads_meta: number;
  cadastros: number;
  entradas: number;
  no_grupo_agora: number;
};

export const zero = (): Soma => ({
  gasto: 0,
  impressoes: 0,
  cliques: 0,
  leads_meta: 0,
  cadastros: 0,
  entradas: 0,
  no_grupo_agora: 0,
});

export function acumular(total: Soma, r: Soma): Soma {
  total.gasto += r.gasto;
  total.impressoes += r.impressoes;
  total.cliques += r.cliques;
  total.leads_meta += r.leads_meta;
  total.cadastros += r.cadastros;
  total.entradas += r.entradas;
  total.no_grupo_agora += r.no_grupo_agora;
  return total;
}

export const somar = (rows: Soma[]) => rows.reduce(acumular, zero());

/** Todas as taxas e custos derivados de uma soma. null quando não dá para calcular. */
export function metricas(s: Soma) {
  return {
    ctr: pct(s.cliques, s.impressoes),
    cpm: s.impressoes > 0 ? (s.gasto / s.impressoes) * 1000 : null,
    cpc: div(s.gasto, s.cliques),
    cplMeta: div(s.gasto, s.leads_meta),
    cplReal: div(s.gasto, s.cadastros),
    cliqueCad: pct(s.cadastros, s.cliques),
    cadGrupo: pct(s.entradas, s.cadastros),
    retencao: pct(s.no_grupo_agora, s.entradas),
    custoEntrada: div(s.gasto, s.entradas),
    custoNoGrupo: div(s.gasto, s.no_grupo_agora),
  };
}

export type LinhaDia = AnuncioDia & { info: AnuncioInfo };

/** Junta cada linha diária com os dados do anúncio. Linhas de anúncio desconhecido são descartadas. */
export function juntar(dias: AnuncioDia[], infos: AnuncioInfo[]): LinhaDia[] {
  const mapa = new Map(infos.map((i) => [i.ad_id, i]));
  const saida: LinhaDia[] = [];
  for (const d of dias) {
    const info = mapa.get(d.ad_id);
    if (info) saida.push({ ...d, info });
  }
  return saida;
}

export type Nivel = 'anuncio' | 'conjunto' | 'campanha';

export type Linha = {
  id: string;
  nome: string;
  sub: string;
  publico: 'geral' | 'aluno';
  info?: AnuncioInfo;
  s: Soma;
};

export function agrupar(rows: LinhaDia[], nivel: Nivel): Linha[] {
  const mapa = new Map<string, Linha>();
  for (const r of rows) {
    const i = r.info;
    const id = nivel === 'anuncio' ? i.ad_id : nivel === 'conjunto' ? `${i.campaign_id}|${i.conjunto}` : i.campaign_id;
    let l = mapa.get(id);
    if (!l) {
      l = {
        id,
        nome: nivel === 'anuncio' ? i.anuncio : nivel === 'conjunto' ? (i.conjunto ?? '—') : i.campanha,
        sub: nivel === 'anuncio' ? `${i.conjunto ?? '—'} · ${i.campanha}` : nivel === 'conjunto' ? i.campanha : '',
        publico: i.publico,
        info: nivel === 'anuncio' ? i : undefined,
        s: zero(),
      };
      mapa.set(id, l);
    }
    acumular(l.s, r);
  }
  return [...mapa.values()];
}

// ---------- datas (sempre texto AAAA-MM-DD, sem fuso) ----------

export const addDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export type Preset = { chave: string; rotulo: string; de: string; ate: string };

/** Atalhos de período, sempre contados a partir do último dia com dados. */
export function presets(min: string, max: string): Preset[] {
  const ate = max;
  const cortar = (de: string) => (de < min ? min : de);
  return [
    { chave: 'tudo', rotulo: 'Todo o período', de: min, ate },
    { chave: 'hoje', rotulo: 'Último dia', de: max, ate },
    { chave: 'ontem', rotulo: 'Dia anterior', de: cortar(addDias(max, -1)), ate: cortar(addDias(max, -1)) },
    { chave: '3d', rotulo: '3 dias', de: cortar(addDias(max, -2)), ate },
    { chave: '7d', rotulo: '7 dias', de: cortar(addDias(max, -6)), ate },
  ];
}
