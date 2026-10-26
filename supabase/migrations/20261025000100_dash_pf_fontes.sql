-- Dashboard Purple Friday — cadastros por fonte e por página.
--
-- A fonte é definida pelo UTM de primeiro toque do CADASTRO. Quem entrou no grupo sem passar pelo
-- formulário não tem cadastro e, por isso, não entra em nenhuma fonte (aparece à parte, como
-- "entrou sem formulário").
--
--   trafego      campanha BF_LEADS ou utm_source meta/FB
--   api_oficial  utm_medium = disparo_api (convite por WhatsApp, API oficial)
--   link_grupo   utm_medium = grupo (cadastro feito pelo link divulgado dentro dos grupos)
--   organico     Instagram (bio, social) ou utm_medium = organico
--   sem_utm      cadastro sem nenhum UTM
--   outros       qualquer outra combinação

create or replace function public.dash_pf_fonte(src text, med text, camp text)
returns text
language sql
immutable
as $$
  select case
    when camp ilike 'BF\_LEADS%' or src in ('meta', 'FB', 'fb') then 'trafego'
    when med = 'disparo_api' then 'api_oficial'
    when med = 'grupo' then 'link_grupo'
    when src in ('instagram', 'ig') or med in ('bio', 'social', 'organico') then 'organico'
    when src is null and med is null then 'sem_utm'
    else 'outros'
  end;
$$;

create or replace function public.dash_pf_fontes()
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
    with f as (
      select public.dash_pf_fonte(first_utm_source, first_utm_medium, first_utm_campaign) fonte,
             publico, entrou_grupo, primeiro_cadastro::date dia
      from trafego_pf.leads
      where primeiro_cadastro is not null
    )
    select jsonb_build_object(
      'por_fonte', (
        select coalesce(jsonb_agg(t order by t.cadastros desc), '[]'::jsonb)
        from (
          select fonte,
                 count(*) cadastros,
                 count(*) filter (where entrou_grupo) entradas,
                 count(*) filter (where publico = 'aluno') alunos
          from f group by 1
        ) t
      ),
      'por_fonte_dia', (
        select coalesce(jsonb_agg(t order by t.dia), '[]'::jsonb)
        from (
          select dia,
                 count(*) filter (where fonte = 'trafego') trafego,
                 count(*) filter (where fonte = 'api_oficial') api_oficial,
                 count(*) filter (where fonte = 'link_grupo') link_grupo,
                 count(*) filter (where fonte = 'organico') organico,
                 count(*) filter (where fonte in ('sem_utm', 'outros')) sem_utm
          from f group by 1
        ) t
      ),
      -- Página = público: a página de alunos é purple-friday-26-a, qualquer outra é a geral
      -- (regra de americo_pf_config.slugs_aluno). O gasto vem da campanha de cada público.
      'por_pagina', (
        select coalesce(jsonb_agg(t order by t.publico), '[]'::jsonb)
        from (
          select f.publico,
                 count(*) cadastros,
                 count(*) filter (where entrou_grupo) entradas,
                 count(*) filter (where fonte = 'trafego') cadastros_pagos,
                 round((
                   select coalesce(sum(m.spend), 0)
                   from trafego_pf.meta_ads m
                   where m.campaign_name ilike 'BF\_LEADS%'
                     and (m.campaign_name ilike 'BF\_LEADS\_ALUNOS%') = (f.publico = 'aluno')
                 )::numeric, 2) gasto
          from f group by f.publico
        ) t
      ),
      -- Só as chaves de data/horário da live; o restante de americo_pf_config (webhooks, tags) não sai daqui.
      'lives', (
        select coalesce(jsonb_object_agg(chave, valor), '{}'::jsonb)
        from public.americo_pf_config
        where chave in ('data_live', 'data_live_aluno', 'horario_live', 'horario_live_aluno')
      )
    )
  );
end;
$$;

revoke all on function public.dash_pf_fonte(text, text, text) from public, anon;
revoke all on function public.dash_pf_fontes() from public, anon;
grant execute on function public.dash_pf_fonte(text, text, text) to authenticated;
grant execute on function public.dash_pf_fontes() to authenticated;
