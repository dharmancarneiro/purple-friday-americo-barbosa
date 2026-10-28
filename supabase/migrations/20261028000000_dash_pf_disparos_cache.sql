-- Dashboard Purple Friday — dash_pf_disparos passa a ler um resultado pronto (cache) em vez de recalcular a cada visita.
--
-- Por quê: a função leva ~2,3 s sozinha, mas o projeto é compartilhado com outros sistemas e, sob carga, ela passa do
-- statement_timeout de 8 s do papel authenticated. Aí a chamada devolve 500 (visto em 27-28/10/2026).
--
-- Como:
--   dash_pf_disparos_calc()      cálculo de sempre (corpo da migration 20261027000100), SEM checagem de login.
--                                Fechada para PUBLIC/anon/authenticated; só o dono (postgres) e as funções abaixo a chamam.
--   dash_pf_disparos_atualizar() recalcula e grava em dash_pf_cache. Chamada pelo pg_cron a cada 5 minutos,
--                                que roda como postgres e não tem o limite de 8 s.
--   dash_pf_disparos()           mesma assinatura e mesma checagem de acesso; devolve a linha do cache
--                                (com o campo extra atualizado_em). Se o cache ainda estiver vazio, calcula na hora.
--
-- Só contagens: nenhuma função devolve telefone, nome, e-mail ou texto de mensagem.
-- dash_pf_conferencia_disparo não muda.

create extension if not exists pg_cron;

create table if not exists public.dash_pf_cache (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- Sem policy: ninguém lê direto pela API; o acesso é só pelas funções security definer.
alter table public.dash_pf_cache enable row level security;
revoke all on public.dash_pf_cache from public, anon, authenticated;

create or replace function public.dash_pf_disparos_calc()
returns jsonb
language plpgsql
stable
set search_path = public
as $$
begin
  return (
    with d as (
      select dia,
             case
               when publico = 'alunos_listas_purple_friday' or disparo_codigo like 'pf_convite_alunos%' then 'convite_aluno'
               when publico = 'nao_alunos_listas_purple_friday' or disparo_codigo like 'pf_convite_nao_alunos%' then 'convite_nao_aluno'
               else 'regua'
             end grupo,
             disparo_codigo, disparo_nome, enviado_em,
             case conexao when '3070' then 'datacrazy' when 'manychat' then 'manychat' else 'outro' end provedor,
             case when length(telefone_norm) = 13 then left(telefone_norm, 4) || right(telefone_norm, 8)
                  else telefone_norm end k
      from public.disparos
      where lancamento = 'purple_friday_2026'
        and (coalesce(disparo_codigo, '') not like '%teste%' or disparo_codigo = 'pf_convite_alunos_teste_webinario')
    ),
    conv as (select * from d where grupo like 'convite%'),
    alc as (
      select dia, grupo, provedor, count(*) envios, count(distinct k) pessoas
      from conv group by 1, 2, 3
    ),
    cad as (
      select dia, grupo, provedor, count(*) cadastros, count(*) filter (where entrou) entraram
      from (
        select distinct on (l.tel_chave) c.dia, c.grupo, c.provedor, (l.primeira_entrada_grupo is not null) entrou
        from public.americo_pf_leads l
        join conv c on c.k = l.tel_chave
                   and c.enviado_em <= l.primeiro_cadastro
                   and c.enviado_em > l.primeiro_cadastro - interval '72 hours'
        where l.first_utm_medium = 'disparo_api' and l.primeiro_cadastro is not null
        order by l.tel_chave, c.enviado_em desc
      ) t
      group by 1, 2, 3
    ),
    conf as (
      select dia, grupo, provedor, count(*) confirmaram
      from (
        select distinct on (lc.id) c.dia, c.grupo, c.provedor
        from public.americo_pf_lista_contatos lc
        join conv c on c.k = lc.tel_chave
                   and c.enviado_em <= lc.respondido_em
                   and c.enviado_em > lc.respondido_em - interval '72 hours'
        where lc.status = 'confirmou' and lc.respondido_em is not null
        order by lc.id, c.enviado_em desc
      ) t
      group by 1, 2, 3
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
      ),
      'por_provedor', (
        select coalesce(jsonb_agg(t order by t.dia, t.grupo, t.provedor), '[]'::jsonb)
        from (
          select a.dia, a.grupo, a.provedor, a.envios, a.pessoas,
                 coalesce(f.confirmaram, 0) confirmaram,
                 coalesce(c.cadastros, 0) cadastros,
                 coalesce(c.entraram, 0) entraram
          from alc a
          left join cad c using (dia, grupo, provedor)
          left join conf f using (dia, grupo, provedor)
        ) t
      )
    )
  );
end;
$$;

create or replace function public.dash_pf_disparos_atualizar()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  insert into public.dash_pf_cache (chave, valor, atualizado_em)
  values ('disparos', public.dash_pf_disparos_calc(), now())
  on conflict (chave) do update
    set valor = excluded.valor, atualizado_em = excluded.atualizado_em;
end;
$$;

create or replace function public.dash_pf_disparos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.dash_pf_autorizado() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  select c.valor || jsonb_build_object('atualizado_em', c.atualizado_em)
    into v
    from public.dash_pf_cache c
   where c.chave = 'disparos';

  -- Cache ainda vazio (antes da primeira atualização): calcula na hora, como antes.
  return coalesce(v, public.dash_pf_disparos_calc());
end;
$$;

revoke all on function public.dash_pf_disparos_calc() from public, anon, authenticated;
revoke all on function public.dash_pf_disparos_atualizar() from public, anon, authenticated;
revoke all on function public.dash_pf_disparos() from public, anon;
grant execute on function public.dash_pf_disparos() to authenticated;

-- A cada 5 minutos. Mesmo nome = atualiza o agendamento em vez de duplicar.
select cron.schedule('dash_pf_disparos_cache', '*/5 * * * *', $job$select public.dash_pf_disparos_atualizar()$job$);
