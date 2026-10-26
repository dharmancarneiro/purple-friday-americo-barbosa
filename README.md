# Dashboard Purple Friday — Américo Barbosa

Painel de acompanhamento do lançamento: tráfego (Meta Ads), cadastros, entradas nos grupos, disparos de WhatsApp e régua.
Feito para quem não é técnico tomar decisões no dia a dia: alertas em linguagem simples, filtros por período e por público
(alunos / não alunos) e tabelas que ordenam, filtram e exportam.

Next.js 15 (App Router) + Supabase. Pronto para a Vercel.

## Telas

| Tela | Para que serve |
|---|---|
| Visão geral | O que olhar agora (alertas), custo por lead (Meta, real e geral), cadastros por fonte, conversão e gráficos por dia |
| Dia a dia | Cada dia: investimento, cadastros por fonte, entrada no grupo |
| Tráfego | Funil, custo de cada etapa, anúncios, conjuntos e campanhas, com links dos criativos |
| Público | Alunos x não alunos, origem dos cadastros, tempo até entrar no grupo |
| Disparo e régua | Convites e mensagens da régua por dia, funil do convite ao grupo e conferência entre as fontes de envio |

## Como a segurança funciona

- O navegador **nunca** fala com o banco. As tabelas `americo_pf_*` têm RLS ligado e nenhuma policy.
- Login por e-mail e senha (Supabase Auth). O middleware barra qualquer rota sem sessão válida (`getUser()` valida o token).
- Logado não basta: o e-mail precisa estar ativo em `americo_pf_dash_acesso`. A checagem é feita **dentro do banco**, nas
  funções `dash_pf_*` (`SECURITY DEFINER`), que só o papel `authenticated` executa. Visitante anônimo não executa nenhuma.
- As funções devolvem só contagens. Nenhuma devolve telefone, nome, e-mail ou texto de mensagem.
- Nenhuma chave secreta no projeto: só a chave publicável do Supabase, que é pública por desenho.
- Cabeçalhos de segurança e CSP em `next.config.mjs`. `X-Robots-Tag: noindex`.
- `DASH_PREVIEW` (dados locais sem login) **só funciona fora de produção**: com `NODE_ENV=production` é ignorado.

## Publicar na Vercel

### 1. Banco (Supabase)

Aplicar, em ordem, os arquivos de `supabase/migrations/` (SQL Editor do Supabase, um de cada vez):

1. `20261025000000_dash_pf.sql` — acesso, resumo, diário, anúncios, público e disparo
2. `20261025000100_dash_pf_fontes.sql` — cadastros por fonte e por página
3. `20261026000000_dash_pf_coorte_disparo.sql` — dados por dia, público e fonte; régua por dia
4. `20261026000100_dash_pf_disparos.sql` — disparos e conferência (tabela `public.disparos`)

Depois, em **Authentication**:

- Criar o usuário (e-mail + senha) de cada pessoa que vai acessar.
- Em *Sign In / Providers*, **desligar "Allow new users to sign up"**. Ninguém se cadastra sozinho.

E liberar cada e-mail na tabela de acesso:

```sql
insert into public.americo_pf_dash_acesso (email, ativo) values ('pessoa@exemplo.com', true);
-- para bloquear depois: update public.americo_pf_dash_acesso set ativo = false where email = 'pessoa@exemplo.com';
```

### 2. Vercel

1. *Add New → Project* e importar este repositório.
2. Framework Preset: **Next.js** (detectado sozinho). Build Command, Output e Install: deixar o padrão. Node: 20 ou mais.
3. Em *Settings → Environment Variables* (Production e Preview):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://danphlemsaeszoekfbel.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publicável do projeto (Supabase → Project Settings → API Keys → *Publishable key*, começa com `sb_publishable_`) |

   **Não definir `DASH_PREVIEW`** e não usar nenhuma chave `service_role` / `sb_secret_`.
4. *Deploy*. Cada `git push` na `main` publica de novo.
5. Se usar domínio próprio, nada mais precisa mudar (as chamadas ao Supabase são feitas pelo servidor).

## Rodar na máquina

```bash
npm install
cp .env.example .env.local   # preencha NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Com login de verdade o app usa o banco. Para ver só o visual sem login, crie `.data/snapshot.json` (ignorado pelo git) e
defina `DASH_PREVIEW=1` no `.env.local`.

```bash
npm run typecheck   # tipos
npm run build       # build de produção
```

## Regras de negócio

- **Filtro do lançamento:** campanhas Meta cujo nome começa com `BF_LEADS`.
- **Fonte do cadastro:** vem do UTM de primeiro toque (`trafego_pf.leads`): tráfego pago (`BF_LEADS` ou origem meta/FB),
  API oficial (`disparo_api`), link do grupo (`grupo`), orgânico (Instagram) e sem UTM. Quem entrou no grupo sem formulário
  não é cadastro.
- **Cadastro → anúncio:** `first_utm_content` chega como `NOME_DO_ANUNCIO|ad_id`; a campanha vem em `first_utm_campaign`.
- **CPL do Meta** = investimento ÷ leads que o Meta contou. **CPL real** = investimento ÷ cadastros atribuídos ao pago.
  **CPL geral** = investimento ÷ todos os cadastros.
- **Disparos:** vêm de `public.disparos` (lançamento `purple_friday_2026`). A chave de telefone converte 13 dígitos
  (55 + DDD + 9 + 8) para os 12 dígitos de `tel_chave`.
