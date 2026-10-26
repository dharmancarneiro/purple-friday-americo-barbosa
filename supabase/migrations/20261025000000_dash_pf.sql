-- Dashboard Purple Friday (Américo Barbosa) — funções de leitura para o dashboard.
--
-- Segurança:
--   * As tabelas americo_pf_* têm RLS ligado e nenhuma policy: o navegador não lê nada direto.
--   * Estas funções são SECURITY DEFINER e só respondem para quem está logado (Supabase Auth)
--     com e-mail ativo em public.americo_pf_dash_acesso. Qualquer outro caso levanta exceção.
--   * EXECUTE é revogado de PUBLIC/anon e concedido só a authenticated.
--
-- Filtro do lançamento: campanhas Meta cujo nome começa com 'BF_LEADS' (BF_LEADS_TC_OUT_001,
-- BF_LEADS_ALUNOS_TC_OUT_001...). O flag eh_purple da view trafego_pf.meta_ads procura 'purple'
-- no nome da campanha e hoje não casa com nenhuma linha, por isso o filtro é feito aqui.

create or replace function public.dash_pf_autorizado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.americo_pf_dash_acesso a
    where a.ativo
      and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.dash_pf_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.dash_pf_autorizado() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return (
    with m as (
      select coalesce(sum(spend), 0) gasto,
             coalesce(sum(impressions), 0) impressoes,
             coalesce(sum(link_clicks), 0) cliques,
             coalesce(sum(leads), 0) leads_meta,
             min(data) primeiro_dia,
             max(data) ultimo_dia
      from trafego_pf.meta_ads
      where campaign_name ilike 'BF\_LEADS%'
    ),
    l as (
      select count(*) filter (where primeiro_cadastro is not null) cadastros,
             count(*) filter (where primeiro_cadastro is not null and first_utm_campaign ilike 'BF\_LEADS%') cadastros_pagos,
             count(*) filter (where publico = 'aluno' and primeiro_cadastro is not null) cad_aluno,
             count(*) filter (where publico = 'nao_aluno' and primeiro_cadastro is not null) cad_nao_aluno,
             count(*) filter (where entrou_grupo) entradas,
             count(*) filter (where entrou_grupo and first_utm_campaign ilike 'BF\_LEADS%') entradas_pagos,
             count(*) filter (where no_grupo_agora) no_grupo_agora,
             count(*) filter (where saiu_alguma_vez) sairam,
             count(*) filter (where origem = 'grupo') entrou_sem_formulario,
             count(*) filter (where entrou_depois_da_regua) recuperados_regua,
             percentile_cont(0.5) within group (order by minutos_ate_grupo) filter (where minutos_ate_grupo >= 0) mediana_min_ate_grupo
      from trafego_pf.leads
    )
    select jsonb_build_object(
      'gasto', m.gasto, 'impressoes', m.impressoes, 'cliques', m.cliques, 'leads_meta', m.leads_meta,
      'primeiro_dia', m.primeiro_dia, 'ultimo_dia', m.ultimo_dia,
      'cadastros', l.cadastros, 'cadastros_pagos', l.cadastros_pagos,
      'cad_aluno', l.cad_aluno, 'cad_nao_aluno', l.cad_nao_aluno,
      'entradas', l.entradas, 'entradas_pagos', l.entradas_pagos,
      'no_grupo_agora', l.no_grupo_agora, 'sairam', l.sairam,
      'entrou_sem_formulario', l.entrou_sem_formulario,
      'recuperados_regua', l.recuperados_regua,
      'mediana_min_ate_grupo', l.mediana_min_ate_grupo,
      'atualizado_em', now()
    )
    from m, l
  );
end;
$$;

create or replace function public.dash_pf_diario()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.dash_pf_autorizado() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(t order by t.dia), '[]'::jsonb)
    from (
      with g as (
        select data dia, sum(spend) gasto, sum(impressions) impressoes,
               sum(link_clicks) cliques, sum(leads) leads_meta
        from trafego_pf.meta_ads
        where campaign_name ilike 'BF\_LEADS%'
        group by 1
      ),
      c as (
        select primeiro_cadastro::date dia,
               count(*) cadastros,
               count(*) filter (where publico = 'aluno') cad_aluno,
               count(*) filter (where publico = 'nao_aluno') cad_nao_aluno,
               count(*) filter (where first_utm_campaign ilike 'BF\_LEADS%') cad_pagos
        from trafego_pf.leads
        where primeiro_cadastro is not null
        group by 1
      ),
      e as (
        select primeira_entrada_grupo::date dia,
               count(*) entradas,
               count(*) filter (where publico = 'aluno') ent_aluno,
               count(*) filter (where publico = 'nao_aluno') ent_nao_aluno,
               count(*) filter (where first_utm_campaign ilike 'BF\_LEADS%') ent_pagos
        from trafego_pf.leads
        where primeira_entrada_grupo is not null
        group by 1
      ),
      dias as (
        select dia from g union select dia from c union select dia from e
      )
      select d.dia,
             coalesce(g.gasto, 0) gasto,
             coalesce(g.impressoes, 0) impressoes,
             coalesce(g.cliques, 0) cliques,
             coalesce(g.leads_meta, 0) leads_meta,
             coalesce(c.cadastros, 0) cadastros,
             coalesce(c.cad_aluno, 0) cad_aluno,
             coalesce(c.cad_nao_aluno, 0) cad_nao_aluno,
             coalesce(c.cad_pagos, 0) cad_pagos,
             coalesce(e.entradas, 0) entradas,
             coalesce(e.ent_aluno, 0) ent_aluno,
             coalesce(e.ent_nao_aluno, 0) ent_nao_aluno,
             coalesce(e.ent_pagos, 0) ent_pagos
      from dias d
      left join g on g.dia = d.dia
      left join c on c.dia = d.dia
      left join e on e.dia = d.dia
    ) t
  );
end;
$$;

-- Um anúncio por linha, com os dados do criativo e os links para abrir o anúncio.
-- Campanhas e conjuntos são montados no front a partir destas linhas.
create or replace function public.dash_pf_anuncios_info()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.dash_pf_autorizado() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(t order by t.gasto desc), '[]'::jsonb)
    from (
      select ad_id,
             max(ad_name) anuncio,
             max(campaign_id) campaign_id,
             max(campaign_name) campanha,
             max(adset_name) conjunto,
             -- a campanha BF_LEADS_ALUNOS leva para a página de alunos; as demais, para a página geral
             case when max(campaign_name) ilike 'BF\_LEADS\_ALUNOS%' then 'aluno' else 'geral' end publico,
             max(thumbnail_url) thumbnail_url,
             max(image_url) image_url,
             max(video_link) video_link,
             max(instagram_permalink_url) instagram_url,
             round(sum(spend)::numeric, 2) gasto
      from trafego_pf.meta_ads
      where campaign_name ilike 'BF\_LEADS%'
      group by ad_id
    ) t
  );
end;
$$;

-- Um anúncio por dia: o que o Meta gastou e entregou, e o que virou cadastro e entrada no grupo.
-- Cadastros e entradas são atribuídos ao dia do CADASTRO (coorte): entradas = quem se cadastrou
-- naquele dia e entrou no grupo, não importa quando.
-- O front soma por período, anúncio, conjunto, campanha e público.
create or replace function public.dash_pf_anuncios_dia()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.dash_pf_autorizado() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(t order by t.dia, t.ad_id), '[]'::jsonb)
    from (
      with m as (
        select ad_id, data dia,
               sum(spend) gasto, sum(impressions) impressoes,
               sum(link_clicks) cliques, sum(leads) leads_meta
        from trafego_pf.meta_ads
        where campaign_name ilike 'BF\_LEADS%'
        group by 1, 2
      ),
      l as (
        -- utm_content chega como "NOME_DO_ANUNCIO|ad_id"
        select split_part(first_utm_content, '|', 2) ad_id,
               primeiro_cadastro::date dia,
               count(*) cadastros,
               count(*) filter (where entrou_grupo) entradas,
               count(*) filter (where no_grupo_agora) no_grupo_agora
        from trafego_pf.leads
        where first_utm_campaign ilike 'BF\_LEADS%'
          and primeiro_cadastro is not null
        group by 1, 2
      )
      select coalesce(m.ad_id, l.ad_id) ad_id,
             coalesce(m.dia, l.dia) dia,
             round(coalesce(m.gasto, 0)::numeric, 2) gasto,
             coalesce(m.impressoes, 0) impressoes,
             coalesce(m.cliques, 0) cliques,
             coalesce(m.leads_meta, 0) leads_meta,
             coalesce(l.cadastros, 0) cadastros,
             coalesce(l.entradas, 0) entradas,
             coalesce(l.no_grupo_agora, 0) no_grupo_agora
      from m
      full join l on l.ad_id = m.ad_id and l.dia = m.dia
      where coalesce(m.ad_id, l.ad_id) in (
        select ad_id from trafego_pf.meta_ads where campaign_name ilike 'BF\_LEADS%'
      )
    ) t
  );
end;
$$;

create or replace function public.dash_pf_publico()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.dash_pf_autorizado() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'por_publico', (
      select coalesce(jsonb_agg(t order by t.publico), '[]'::jsonb)
      from (
        select publico,
               count(*) cadastros,
               count(*) filter (where entrou_grupo) entradas,
               count(*) filter (where no_grupo_agora) no_grupo_agora,
               count(*) filter (where saiu_alguma_vez) sairam,
               count(*) filter (where entrou_depois_da_regua) recuperados_regua,
               count(*) filter (where first_utm_campaign ilike 'BF\_LEADS%') cadastros_pagos,
               percentile_cont(0.5) within group (order by minutos_ate_grupo)
                 filter (where minutos_ate_grupo >= 0) mediana_min_ate_grupo
        from trafego_pf.leads
        where primeiro_cadastro is not null
        group by 1
      ) t
    ),
    'estados', (
      select coalesce(jsonb_agg(t order by t.cadastros desc), '[]'::jsonb)
      from (
        select coalesce(geo_estado, 'Não informado') estado,
               count(*) cadastros,
               count(*) filter (where entrou_grupo) entradas
        from trafego_pf.leads
        where primeiro_cadastro is not null
        group by 1
        order by 2 desc
        limit 10
      ) t
    ),
    'aparelhos', (
      select coalesce(jsonb_agg(t order by t.cadastros desc), '[]'::jsonb)
      from (
        select coalesce(aparelho, 'Não informado') aparelho,
               count(*) cadastros,
               count(*) filter (where entrou_grupo) entradas
        from trafego_pf.leads
        where primeiro_cadastro is not null
        group by 1
      ) t
    ),
    'tempo_ate_grupo', (
      select coalesce(jsonb_agg(t order by t.ordem), '[]'::jsonb)
      from (
        select case when minutos_ate_grupo < 5 then 1
                    when minutos_ate_grupo < 30 then 2
                    when minutos_ate_grupo < 120 then 3
                    when minutos_ate_grupo < 1440 then 4
                    else 5 end ordem,
               case when minutos_ate_grupo < 5 then 'Até 5 min'
                    when minutos_ate_grupo < 30 then '5 a 30 min'
                    when minutos_ate_grupo < 120 then '30 min a 2 h'
                    when minutos_ate_grupo < 1440 then '2 a 24 h'
                    else 'Mais de 24 h' end faixa,
               count(*) pessoas
        from trafego_pf.leads
        where entrou_grupo and minutos_ate_grupo >= 0
        group by 1, 2
      ) t
    ),
    'utm', (
      select coalesce(jsonb_agg(t order by t.cadastros desc), '[]'::jsonb)
      from (
        select coalesce(first_utm_source, '(sem origem)') origem,
               coalesce(first_utm_medium, '(sem mídia)') midia,
               count(*) cadastros,
               count(*) filter (where entrou_grupo) entradas
        from trafego_pf.leads
        where primeiro_cadastro is not null
        group by 1, 2
        order by 3 desc
        limit 12
      ) t
    )
  );
end;
$$;

create or replace function public.dash_pf_disparo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.dash_pf_autorizado() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'listas', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v.publico, v.prioridade), '[]'::jsonb)
      from public.vw_americo_pf_convite_listas v
      where v.ativa
    ),
    'regua', (
      select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb)
      from public.vw_americo_pf_regua_etapas v
    ),
    'envios_dia', (
      select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb)
      from public.vw_americo_pf_convite_envios_dia v
    )
  );
end;
$$;

-- Só usuário logado chama; anon e PUBLIC não.
revoke all on function public.dash_pf_autorizado() from public, anon;
revoke all on function public.dash_pf_resumo() from public, anon;
revoke all on function public.dash_pf_diario() from public, anon;
revoke all on function public.dash_pf_anuncios_info() from public, anon;
revoke all on function public.dash_pf_anuncios_dia() from public, anon;
revoke all on function public.dash_pf_publico() from public, anon;
revoke all on function public.dash_pf_disparo() from public, anon;

grant execute on function public.dash_pf_autorizado() to authenticated;
grant execute on function public.dash_pf_resumo() to authenticated;
grant execute on function public.dash_pf_diario() to authenticated;
grant execute on function public.dash_pf_anuncios_info() to authenticated;
grant execute on function public.dash_pf_anuncios_dia() to authenticated;
grant execute on function public.dash_pf_publico() to authenticated;
grant execute on function public.dash_pf_disparo() to authenticated;
