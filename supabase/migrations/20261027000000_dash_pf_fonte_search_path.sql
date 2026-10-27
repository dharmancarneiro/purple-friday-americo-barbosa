-- Fixa o search_path de dash_pf_fonte (alerta "function_search_path_mutable" do Supabase).
-- A função só usa operadores nativos (case/ilike/in), então o search_path vazio não muda o resultado.

alter function public.dash_pf_fonte(text, text, text) set search_path = '';
