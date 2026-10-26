-- Dashboard Purple Friday — dados diários por público e fonte, e disparo/régua por dia.
-- Depende das duas migrations anteriores (dash_pf_autorizado e dash_pf_fonte).

-- Um cadastro por linha agrupada: dia do CADASTRO x público x fonte.
-- Com isso o front calcula, para qualquer período e para cada público (aluno / geral),
-- os cadastros por fonte, a taxa de entrada no grupo e quantos continuam no grupo.
-- publico: 'aluno' ou 'geral' (todo o resto), igual à classificação dos anúncios.
create or replace function public.dash_pf_coorte_dia()
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
    select coalesce(jsonb_agg(t order by t.dia, t.publico, t.fonte), '[]'::jsonb)
    from (
      select primeiro_cadastro::date dia,
             case when publico = 'aluno' then 'aluno' else 'geral' end publico,
             public.dash_pf_fonte(first_utm_source, first_utm_medium, first_utm_campaign) fonte,
             count(*) cadastros,
             count(*) filter (where entrou_grupo) entradas,
             count(*) filter (where no_grupo_agora) no_grupo_agora,
             count(*) filter (where saiu_alguma_vez) sairam
      from trafego_pf.leads
      where primeiro_cadastro is not null
      group by 1, 2, 3
    ) t
  );
end;
$$;

-- Régua de mensagens por dia e quem entrou no grupo depois de receber mensagem.
-- Não traz telefone nem nome: só contagens.
create or replace function public.dash_pf_disparo_dia()
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
    'regua_dia', (
      select coalesce(jsonb_agg(t order by t.dia, t.publico), '[]'::jsonb)
      from (
        select (enviado_em at time zone 'America/Sao_Paulo')::date dia,
               case when payload ->> 'publico' = 'aluno' then 'aluno' else 'geral' end publico,
               count(*) filter (where status = 'enviado') mensagens,
               count(distinct tel_chave) filter (where status = 'enviado') pessoas,
               count(*) filter (where status = 'erro') erros
        from public.americo_pf_regua_envios
        where enviado_em is not null
        group by 1, 2
      ) t
    ),
    'recuperados_dia', (
      select coalesce(jsonb_agg(t order by t.dia, t.publico), '[]'::jsonb)
      from (
        select primeira_entrada_grupo::date dia,
               case when publico = 'aluno' then 'aluno' else 'geral' end publico,
               count(*) pessoas
        from trafego_pf.leads
        where entrou_depois_da_regua and primeira_entrada_grupo is not null
        group by 1, 2
      ) t
    )
  );
end;
$$;

revoke all on function public.dash_pf_coorte_dia() from public, anon;
revoke all on function public.dash_pf_disparo_dia() from public, anon;
grant execute on function public.dash_pf_coorte_dia() to authenticated;
grant execute on function public.dash_pf_disparo_dia() to authenticated;
