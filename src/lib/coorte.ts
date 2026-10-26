import type { CoorteDia, Fonte } from './data';
import { addDias, type LinhaDia } from './trafego';

export type FiltroPublico = 'todos' | 'aluno' | 'geral';

export const ROTULO_PUBLICO: Record<FiltroPublico, string> = {
  todos: 'Todos',
  aluno: 'Alunos',
  geral: 'Não alunos',
};

export const passaPublico = (p: string, f: FiltroPublico) => f === 'todos' || p === f;

/** Fontes mostradas ao usuário. "outros" é somado em "sem UTM": são cadastros sem origem identificável. */
export type FonteChave = 'trafego' | 'api_oficial' | 'link_grupo' | 'organico' | 'sem_utm';
export const FONTES: FonteChave[] = ['trafego', 'api_oficial', 'link_grupo', 'organico', 'sem_utm'];

export const ROTULO_FONTE: Record<FonteChave, string> = {
  trafego: 'Tráfego pago',
  api_oficial: 'API oficial (disparo)',
  link_grupo: 'Link do grupo',
  organico: 'Orgânico',
  sem_utm: 'Sem UTM',
};

export const DICA_FONTE: Record<FonteChave, string> = {
  trafego: 'Cadastro que veio de um anúncio do Meta (campanha BF_LEADS)',
  api_oficial: 'Cadastro de quem recebeu o convite por WhatsApp (disparo pela API oficial)',
  link_grupo: 'Cadastro feito pelo link que circula dentro dos grupos de WhatsApp',
  organico: 'Cadastro vindo do Instagram (bio e posts), sem anúncio',
  sem_utm: 'Cadastro que chegou sem nenhuma origem registrada. Parte pode ser tráfego pago sem rastreio.',
};

export const chaveFonte = (f: Fonte): FonteChave => (f === 'outros' ? 'sem_utm' : f);

export type SomaCoorte = { cadastros: number; entradas: number; no_grupo_agora: number; sairam: number };
export const zeroCoorte = (): SomaCoorte => ({ cadastros: 0, entradas: 0, no_grupo_agora: 0, sairam: 0 });

export function acumularCoorte(t: SomaCoorte, r: SomaCoorte): SomaCoorte {
  t.cadastros += r.cadastros;
  t.entradas += r.entradas;
  t.no_grupo_agora += r.no_grupo_agora;
  t.sairam += r.sairam;
  return t;
}

export const somarCoorte = (rows: SomaCoorte[]) => rows.reduce(acumularCoorte, zeroCoorte());

export function noIntervalo<T extends { dia: string }>(rows: T[], de: string, ate: string) {
  return rows.filter((r) => r.dia >= de && r.dia <= ate);
}

export function porFonte(rows: CoorteDia[]): Record<FonteChave, SomaCoorte> {
  const m = Object.fromEntries(FONTES.map((f) => [f, zeroCoorte()])) as Record<FonteChave, SomaCoorte>;
  for (const r of rows) acumularCoorte(m[chaveFonte(r.fonte)], r);
  return m;
}

/** Menor e maior data entre várias listas com campo `dia`. */
export function faixa(...listas: { dia: string }[][]) {
  let min = '';
  let max = '';
  for (const l of listas)
    for (const r of l) {
      if (!min || r.dia < min) min = r.dia;
      if (!max || r.dia > max) max = r.dia;
    }
  return { min, max };
}

/** Todos os dias de `de` a `ate`, inclusive. */
export function listarDias(de: string, ate: string) {
  const dias: string[] = [];
  for (let d = de; d <= ate && dias.length < 400; d = addDias(d, 1)) dias.push(d);
  return dias;
}

export const adsDoPublico = (ads: LinhaDia[], p: FiltroPublico) => ads.filter((a) => passaPublico(a.info.publico, p));
export const coorteDoPublico = (c: CoorteDia[], p: FiltroPublico) => c.filter((r) => passaPublico(r.publico, p));
