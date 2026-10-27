-- Dashboard Purple Friday — convites do ManyChat contam como convite + comparação por provedor de disparo.
-- Substitui dash_pf_disparos e dash_pf_conferencia_disparo (mesmo formato de retorno, com um campo novo).
--
-- 1) Classificação. Antes só os públicos alunos_listas_purple_friday / nao_alunos_listas_purple_friday eram convite;
--    os 13,8 mil envios do ManyChat de 26/10 (código pf_convite_alunos_manychat, 7 públicos alunos_*) caíam em "régua".
--    Agora é convite quem tem esses públicos OU código pf_convite_alunos% / pf_convite_nao_alunos%.
--    Público de teste de webinário conta; só ficam de fora os códigos de teste interno (nao_alunos_teste_10, teste_dharman).
-- 2) Provedor, pela conexão do envio: 3070 = DataCrazy, manychat = ManyChat.
-- 3) por_provedor (um registro por dia do disparo x grupo x provedor):
--      envios, pessoas        direto da tabela disparos
--      confirmaram            contatos que confirmaram, ligados ao ÚLTIMO convite recebido nas 72 h antes da resposta
--      cadastros / entraram   cadastros com primeiro toque disparo_api, ligados ao ÚLTIMO convite recebido nas 72 h antes
--                             do cadastro, e quantos desses entraram no grupo
--    É estimativa: quem recebe por dois provedores conta só no último. Cadastro sem convite nas 72 h anteriores fica de fora.
--    americo_pf_cadastros.raw->>'origem_disparo' NÃO serve como provedor do convite: dos cadastros com http_datacrazy,
--    164 de 169 receberam o último convite pelo ManyChat (o valor indica o passo do fluxo que registra, não quem convidou).
--
-- Só contagens: nenhuma função devolve telefone, nome, e-mail ou texto de mensagem.

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

-- Conferência entre as fontes de disparo, dia a dia (mesma regra de convite da função acima).
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
                 and (d.publico in ('alunos_listas_purple_friday', 'nao_alunos_listas_purple_friday')
                      or d.disparo_codigo like 'pf_convite_alunos%' or d.disparo_codigo like 'pf_convite_nao_alunos%')
                 and (coalesce(d.disparo_codigo, '') not like '%teste%' or d.disparo_codigo = 'pf_convite_alunos_teste_webinario')) convites_disparos,
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
