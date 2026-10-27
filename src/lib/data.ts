import { cache } from 'react';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Com DASH_PREVIEW=1 (só fora de produção) lê .data/snapshot.json em vez do Supabase.
export const PREVIEW = process.env.NODE_ENV !== 'production' && process.env.DASH_PREVIEW === '1';

export type Resumo = {
  gasto: number;
  impressoes: number;
  cliques: number;
  leads_meta: number;
  primeiro_dia: string;
  ultimo_dia: string;
  cadastros: number;
  cadastros_pagos: number;
  cad_aluno: number;
  cad_nao_aluno: number;
  entradas: number;
  entradas_pagos: number;
  no_grupo_agora: number;
  sairam: number;
  entrou_sem_formulario: number;
  recuperados_regua: number;
  mediana_min_ate_grupo: number | null;
  atualizado_em: string;
};

export type Dia = {
  dia: string;
  gasto: number;
  impressoes: number;
  cliques: number;
  leads_meta: number;
  cadastros: number;
  cad_aluno: number;
  cad_nao_aluno: number;
  cad_pagos: number;
  entradas: number;
  ent_aluno: number;
  ent_nao_aluno: number;
  ent_pagos: number;
};

export type AnuncioInfo = {
  ad_id: string;
  anuncio: string;
  campaign_id: string;
  campanha: string;
  conjunto: string | null;
  publico: 'geral' | 'aluno';
  thumbnail_url?: string | null;
  image_url?: string | null;
  video_link?: string | null;
  instagram_url?: string | null;
  gasto: number;
};

export type AnuncioDia = {
  ad_id: string;
  dia: string;
  gasto: number;
  impressoes: number;
  cliques: number;
  leads_meta: number;
  cadastros: number;
  entradas: number;
  no_grupo_agora: number;
};

export type Publico = {
  por_publico: {
    publico: string;
    cadastros: number;
    entradas: number;
    no_grupo_agora: number;
    sairam: number;
    recuperados_regua: number;
    cadastros_pagos: number;
    mediana_min_ate_grupo: number | null;
  }[];
  estados: { estado: string; cadastros: number; entradas: number }[];
  aparelhos: { aparelho: string; cadastros: number; entradas: number }[];
  tempo_ate_grupo: { faixa: string; ordem: number; pessoas: number }[];
  utm: { origem: string; midia: string; cadastros: number; entradas: number }[];
};

export type Disparo = {
  listas: {
    lista: string;
    publico: string;
    prioridade: number;
    contatos: number;
    pendentes: number;
    pulados: number;
    enviados: number;
    erros: number;
    confirmaram: number;
    pct_confirmou: string | null;
    cancelaram: number;
    entraram_grupo: number;
  }[];
  regua: {
    codigo: string;
    injetados: number;
    enviados: number;
    erros: number;
    entraram_depois: number;
    pct_recuperado: string | null;
  }[];
  envios_dia: { dia: string; publico: string; resultado: string; n: number }[];
};

export type Fonte = 'trafego' | 'api_oficial' | 'link_grupo' | 'organico' | 'sem_utm' | 'outros';

export type Fontes = {
  por_fonte: { fonte: Fonte; cadastros: number; entradas: number; alunos: number }[];
  por_fonte_dia: {
    dia: string;
    trafego: number;
    api_oficial: number;
    link_grupo: number;
    organico: number;
    sem_utm: number;
  }[];
  por_pagina: { publico: string; cadastros: number; entradas: number; cadastros_pagos: number; gasto: number }[];
  lives: { data_live?: string; horario_live?: string; data_live_aluno?: string; horario_live_aluno?: string };
};

export type CoorteDia = {
  dia: string;
  publico: 'aluno' | 'geral';
  fonte: Fonte;
  cadastros: number;
  entradas: number;
  no_grupo_agora: number;
  sairam: number;
};

export type DisparoDia = {
  regua_dia: { dia: string; publico: 'aluno' | 'geral'; mensagens: number; pessoas: number; erros: number }[];
  recuperados_dia: { dia: string; publico: 'aluno' | 'geral'; pessoas: number }[];
};

export type Disparos = {
  por_dia: { dia: string; grupo: 'convite_aluno' | 'convite_nao_aluno' | 'regua'; envios: number; pessoas: number }[];
  por_disparo: {
    grupo: 'convite_aluno' | 'convite_nao_aluno' | 'regua';
    codigo: string;
    nome: string;
    envios: number;
    pessoas: number;
    primeiro_dia: string;
    ultimo_dia: string;
  }[];
  funil_convite: {
    grupo: 'convite_aluno' | 'convite_nao_aluno';
    pessoas: number;
    envios: number;
    cadastrou_total: number;
    cadastrou_pelo_convite: number;
    entrou_no_grupo: number;
  }[];
  /** Por dia do disparo, grupo e provedor (conexão do envio). Ausente em snapshots antigos. */
  por_provedor?: {
    dia: string;
    grupo: 'convite_aluno' | 'convite_nao_aluno';
    provedor: 'datacrazy' | 'manychat' | 'outro';
    envios: number;
    pessoas: number;
    confirmaram: number;
    cadastros: number;
    entraram: number;
  }[];
};

export type ConferenciaDia = {
  dia: string;
  convites_disparos: number;
  convites_log: number;
  regua_disparos: number;
  regua_envios: number;
};

export type Dash = {
  disparos: Disparos;
  conferencia: ConferenciaDia[];
  /** true quando as funções de disparo ainda não existem no banco (migration 20261026000100). */
  faltando_disparos: boolean;
  coorte_dia: CoorteDia[];
  disparo_dia: DisparoDia;
  /** true quando alguma função nova ainda não existe no banco (migration não aplicada). */
  faltando_migration: boolean;
  fontes: Fontes;
  resumo: Resumo;
  diario: Dia[];
  anuncios_info: AnuncioInfo[];
  anuncios_dia: AnuncioDia[];
  publico: Publico;
  disparo: Disparo;
};

export const getDash = cache(async (): Promise<Dash> => {
  if (PREVIEW) {
    const file = path.join(process.cwd(), '.data', 'snapshot.json');
    return JSON.parse(await readFile(file, 'utf8')) as Dash;
  }

  const supabase = await createClient();
  const [resumo, diario, anunciosInfo, anunciosDia, publico, disparo, fontes, coorteDia, disparoDia, disparosFn, conferenciaFn] = await Promise.all([
    supabase.rpc('dash_pf_resumo'),
    supabase.rpc('dash_pf_diario'),
    supabase.rpc('dash_pf_anuncios_info'),
    supabase.rpc('dash_pf_anuncios_dia'),
    supabase.rpc('dash_pf_publico'),
    supabase.rpc('dash_pf_disparo'),
    supabase.rpc('dash_pf_fontes'),
    supabase.rpc('dash_pf_coorte_dia'),
    supabase.rpc('dash_pf_disparo_dia'),
    supabase.rpc('dash_pf_disparos'),
    supabase.rpc('dash_pf_conferencia_disparo'),
  ]);

  // Função ainda não criada (migration 20261026 pendente): a tela avisa em vez de quebrar.
  const naoExiste = (e: { code?: string } | null) => e?.code === 'PGRST202' || e?.code === '42883';

  const falha = [resumo, diario, anunciosInfo, anunciosDia, publico, disparo, fontes, ...[coorteDia, disparoDia, disparosFn, conferenciaFn].filter((r) => !naoExiste(r.error))].find((r) => r.error);
  if (falha?.error) {
    // 42501 = o e-mail não está liberado em americo_pf_dash_acesso
    if (falha.error.code === '42501') redirect('/login?erro=acesso');
    throw new Error('Falha ao carregar os dados do dashboard.');
  }

  return {
    resumo: resumo.data,
    diario: diario.data,
    anuncios_info: anunciosInfo.data,
    anuncios_dia: anunciosDia.data,
    publico: publico.data,
    disparo: disparo.data,
    fontes: fontes.data,
    coorte_dia: coorteDia.error ? [] : coorteDia.data,
    disparo_dia: disparoDia.error ? { regua_dia: [], recuperados_dia: [] } : disparoDia.data,
    faltando_migration: naoExiste(coorteDia.error) || naoExiste(disparoDia.error),
    disparos: disparosFn.error ? { por_dia: [], por_disparo: [], funil_convite: [], por_provedor: [] } : disparosFn.data,
    conferencia: conferenciaFn.error ? [] : conferenciaFn.data,
    faltando_disparos: naoExiste(disparosFn.error) || naoExiste(conferenciaFn.error),
  };
});
