-- Dashboard Purple Friday — quadro de UTMs dos cadastros.
-- Uma linha por dia do CADASTRO x público x combinação de UTM de primeiro toque (origem, mídia, campanha, conteúdo, termo).
-- Com isso o front agrupa por qualquer UTM, para qualquer período e público (aluno / geral).
-- Valores vazios viram '(vazio)'. Só contagens: nenhuma função devolve telefone, nome ou e-mail.
-- Depende de dash_pf_autorizado e dash_pf_fonte.

create or replace function public.dash_pf_utms()
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
    select coalesce(jsonb_agg(t order by t.dia, t.publico), '[]'::jsonb)
    from (
      select primeiro_cadastro::date dia,
             case when publico = 'aluno' then 'aluno' else 'geral' end publico,
             public.dash_pf_fonte(first_utm_source, first_utm_medium, first_utm_campaign) fonte,
             coalesce(nullif(btrim(first_utm_source), ''), '(vazio)') origem,
             coalesce(nullif(btrim(first_utm_medium), ''), '(vazio)') midia,
             coalesce(nullif(btrim(first_utm_campaign), ''), '(vazio)') campanha,
             coalesce(nullif(btrim(first_utm_content), ''), '(vazio)') conteudo,
             coalesce(nullif(btrim(first_utm_term), ''), '(vazio)') termo,
             count(*) cadastros,
             count(*) filter (where entrou_grupo) entradas
      from trafego_pf.leads
      where primeiro_cadastro is not null
      group by 1, 2, 3, 4, 5, 6, 7, 8
    ) t
  );
end;
$$;

revoke all on function public.dash_pf_utms() from public, anon;
grant execute on function public.dash_pf_utms() to authenticated;
