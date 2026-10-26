-- Dashboard Purple Friday — disparos de WhatsApp (convites e régua) a partir da tabela public.disparos,
-- o registro de todos os disparos, com data, hora, público e nome de cada um.
-- Depende das migrations anteriores (dash_pf_autorizado).
--
-- Chave de telefone: disparos.telefone_norm tem 13 dígitos (55 + DDD + 9 + 8 dígitos). As tabelas americo_pf_*
-- usam tel_chave com 12 dígitos (sem o 9). A chave abaixo converte uma na outra.
--
-- Só contagens: nenhuma função devolve telefone, nome ou texto de mensagem.

create or replace function public.dash_pf_disparos()
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
    with d as (
      select dia,
             case publico
               when 'alunos_listas_purple_friday' then 'convite_aluno'
               when 'nao_alunos_listas_purple_friday' then 'convite_nao_aluno'
               else 'regua'
             end grupo,
             disparo_codigo, disparo_nome, enviado_em,
             case when length(telefone_norm) = 13 then left(telefone_norm, 4) || right(telefone_norm, 8)
                  else telefone_norm end k
      from public.disparos
      where lancamento = 'purple_friday_2026'
        and coalesce(disparo_codigo, '') not like '%teste%'
    )
    select jsonb_build_object(
      'por_dia', (
        select coalesce(jsonb_agg(t order by t.dia, t.grupo), '[]'::jsonb)
        from (select dia, grupo, count(*) envios, count(distinct k) pessoas from d group by 1, 2) t
      ),
      'por_disparo', (
        select coalesce(jsonb_agg(t order by t.envios desc), '[]'::jsonb)
        from (
          select grupo, disparo_codigo codigo, max(left(disparo_nome, 60)) nome,
                 count(*) envios, count(distinct k) pessoas,
                 min(dia) primeiro_dia, max(dia) ultimo_dia
          from d group by 1, 2
        ) t
      ),
      -- Quem recebeu convite: quantos se cadastraram pelo convite (UTM disparo_api) e entraram no grupo.
      'funil_convite', (
        select coalesce(jsonb_agg(t order by t.grupo), '[]'::jsonb)
        from (
          with p as (
            select grupo, k, count(*) envios
            from d where grupo like 'convite%' group by 1, 2
          )
          select p.grupo,
                 count(*) pessoas,
                 sum(p.envios) envios,
                 count(*) filter (where l.tel_chave is not null) cadastrou_total,
                 count(*) filter (where l.first_utm_medium = 'disparo_api') cadastrou_pelo_convite,
                 count(*) filter (where l.first_utm_medium = 'disparo_api' and l.primeira_entrada_grupo is not null) entrou_no_grupo
          from p
          left join public.americo_pf_leads l on l.tel_chave = p.k
          group by 1
        ) t
      )
    )
  );
end;
$$;

-- Conferência entre as fontes de disparo, dia a dia.
--   convites_disparos x convites_log : tabela disparos x log do fluxo de convite (log só existe a partir de 25/10)
--   regua_disparos    x regua_envios : tabela disparos x régua de persistência
create or replace function public.dash_pf_conferencia_disparo()
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
      select x.dia,
             (select count(*) from public.disparos d
               where d.lancamento = 'purple_friday_2026' and d.dia = x.dia
                 and d.publico in ('alunos_listas_purple_friday', 'nao_alunos_listas_purple_friday')
                 and coalesce(d.disparo_codigo, '') not like '%teste%') convites_disparos,
             (select count(*) from public.americo_pf_convite_envios_log l
               where l.resultado = 'ok' and (l.enviado_em at time zone 'America/Sao_Paulo')::date = x.dia) convites_log,
             (select count(*) from public.disparos d
               where d.lancamento = 'purple_friday_2026' and d.dia = x.dia
                 and d.publico = 'leads_purple_friday') regua_disparos,
             (select count(*) from public.americo_pf_regua_envios r
               where r.status = 'enviado' and (r.enviado_em at time zone 'America/Sao_Paulo')::date = x.dia) regua_envios
      from (
        select generate_series(
                 (select min(dia) from public.disparos where lancamento = 'purple_friday_2026'),
                 (now() at time zone 'America/Sao_Paulo')::date,
                 interval '1 day')::date dia
      ) x
    ) t
  );
end;
$$;

revoke all on function public.dash_pf_disparos() from public, anon;
revoke all on function public.dash_pf_conferencia_disparo() from public, anon;
grant execute on function public.dash_pf_disparos() to authenticated;
grant execute on function public.dash_pf_conferencia_disparo() to authenticated;
