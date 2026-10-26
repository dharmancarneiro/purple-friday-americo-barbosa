'use client';

import { ExternalLink, Image as ImagemIcone, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import DataTable, { type Coluna } from '@/components/DataTable';
import FiltroPeriodo from '@/components/FiltroPeriodo';
import { Custo, PillPublico, Taxa } from '@/components/Indicadores';
import type { AnuncioDia, AnuncioInfo } from '@/lib/data';
import { fBrl, fBrl0, fDia, fInt, fPct, pct } from '@/lib/format';
import { agrupar, juntar, metricas, somar, type Linha, type Nivel } from '@/lib/trafego';

type FiltroPublico = 'todos' | 'geral' | 'aluno';

const NIVEIS: { chave: Nivel; rotulo: string }[] = [
  { chave: 'anuncio', rotulo: 'Anúncios' },
  { chave: 'conjunto', rotulo: 'Públicos (conjuntos)' },
  { chave: 'campanha', rotulo: 'Campanhas' },
];

const seguro = (url?: string | null) => (url && url.startsWith('https://') ? url : null);

function Etapa({ n, v, taxa, rotulo, largura }: { n: string; v: number; taxa?: number | null; rotulo?: string; largura: number }) {
  return (
    <div className="funil-linha">
      <div className="topo-l">
        <span>{n}</span>
        <b>
          {fInt(v)}
          {taxa != null && (
            <>
              {' · '}
              {fPct(taxa, taxa < 10 ? 2 : 1)} <span className="suave">{rotulo}</span>
            </>
          )}
        </b>
      </div>
      <div className="barra">
        <span style={{ width: `${Math.max(2, Math.min(100, largura))}%` }} />
      </div>
    </div>
  );
}

export default function TrafegoView({ info, dias }: { info: AnuncioInfo[]; dias: AnuncioDia[] }) {
  const todas = useMemo(() => juntar(dias, info), [dias, info]);
  const datas = useMemo(() => todas.map((r) => r.dia).sort(), [todas]);
  const min = datas[0];
  const max = datas[datas.length - 1];

  const [de, setDe] = useState(min ?? '');
  const [ate, setAte] = useState(max ?? '');
  const [publico, setPublico] = useState<FiltroPublico>('todos');
  const [campanha, setCampanha] = useState('');
  const [conjunto, setConjunto] = useState('');
  const [nivel, setNivel] = useState<Nivel>('anuncio');

  const noPeriodo = useMemo(() => todas.filter((r) => r.dia >= de && r.dia <= ate), [todas, de, ate]);
  const filtradas = useMemo(
    () =>
      noPeriodo.filter(
        (r) =>
          (publico === 'todos' || r.info.publico === publico) &&
          (!campanha || r.info.campanha === campanha) &&
          (!conjunto || r.info.conjunto === conjunto),
      ),
    [noPeriodo, publico, campanha, conjunto],
  );

  if (!min || !max) return <p className="nota">Ainda não há dados de anúncios.</p>;

  const tot = somar(filtradas);
  const m = metricas(tot);

  const campanhas = [...new Set(info.filter((i) => publico === 'todos' || i.publico === publico).map((i) => i.campanha))];
  const conjuntos = [
    ...new Set(
      info
        .filter((i) => (publico === 'todos' || i.publico === publico) && (!campanha || i.campanha === campanha))
        .map((i) => i.conjunto ?? '—'),
    ),
  ];

  // ---- Geral x Alunos: respeita só o período ----
  const porPublico = (p: 'geral' | 'aluno') => {
    const s = somar(noPeriodo.filter((r) => r.info.publico === p));
    return { s, m: metricas(s) };
  };
  const geral = porPublico('geral');
  const alunos = porPublico('aluno');

  // ---- destaques entre anúncios com pelo menos R$ 100 investidos ----
  const anuncios = agrupar(filtradas, 'anuncio').filter((l) => l.s.gasto >= 100 && l.s.cadastros > 0);
  const por = (f: (l: Linha) => number | null, maior: boolean) => {
    const ok = anuncios.filter((l) => f(l) != null);
    if (ok.length < 2) return null;
    return ok.reduce((a, b) => ((f(b)! > f(a)!) === maior ? b : a));
  };
  const destaques = [
    { rotulo: 'Cadastro mais barato', cor: 'bom', l: por((l) => metricas(l.s).cplReal, false), valor: (l: Linha) => fBrl(metricas(l.s).cplReal) },
    { rotulo: 'Cadastro mais caro', cor: 'ruim', l: por((l) => metricas(l.s).cplReal, true), valor: (l: Linha) => fBrl(metricas(l.s).cplReal) },
    {
      rotulo: 'Mais gente entra no grupo',
      cor: 'bom',
      l: por((l) => (l.s.cadastros >= 30 ? metricas(l.s).cadGrupo : null), true),
      valor: (l: Linha) => fPct(metricas(l.s).cadGrupo),
    },
    { rotulo: 'Mais cadastros', cor: 'bom', l: por((l) => l.s.cadastros, true), valor: (l: Linha) => `${fInt(l.s.cadastros)} cadastros` },
  ].filter((d) => d.l);

  // ---- tabela ----
  const linhas = agrupar(filtradas, nivel);
  const comLinks = nivel === 'anuncio';

  const colunas: Coluna<Linha>[] = [
    {
      chave: 'nome',
      titulo: NIVEIS.find((n) => n.chave === nivel)!.rotulo.replace('Públicos (conjuntos)', 'Público (conjunto)').replace(/s$/, ''),
      dica: 'Nome como está no gerenciador de anúncios',
      esquerda: true,
      valor: (l) => `${l.nome} ${l.sub}`,
      render: (l) => {
        const thumb = seguro(l.info?.thumbnail_url);
        return (
          <div className="celula-nome">
            {comLinks && thumb && <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" width={40} height={40} />}
            <div>
              <strong>{l.nome}</strong> <PillPublico publico={l.publico} />
              {l.sub && <div className="suave">{l.sub}</div>}
            </div>
          </div>
        );
      },
      total: () => 'Total da seleção',
    },
    ...(comLinks
      ? ([
          {
            chave: 'links',
            titulo: 'Ver anúncio',
            dica: 'Abre o criativo no Instagram ou o vídeo no Facebook, em outra aba',
            semBusca: true,
            valor: (l) => (l.info?.instagram_url ? 1 : 0),
            render: (l) => {
              const ig = seguro(l.info?.instagram_url);
              const vid = seguro(l.info?.video_link);
              const img = seguro(l.info?.image_url);
              return (
                <span className="links">
                  {ig && (
                    <a href={ig} target="_blank" rel="noopener noreferrer" title="Abrir a publicação no Instagram">
                      <ImagemIcone size={14} aria-hidden="true" /> Post
                    </a>
                  )}
                  {vid && (
                    <a href={vid} target="_blank" rel="noopener noreferrer" title="Assistir o vídeo no Facebook">
                      <Play size={14} aria-hidden="true" /> Vídeo
                    </a>
                  )}
                  {!vid && img && (
                    <a href={img} target="_blank" rel="noopener noreferrer" title="Abrir a imagem">
                      <ExternalLink size={14} aria-hidden="true" /> Imagem
                    </a>
                  )}
                  {!ig && !vid && !img && <span className="vazio">—</span>}
                </span>
              );
            },
          },
        ] as Coluna<Linha>[])
      : []),
    {
      chave: 'gasto',
      titulo: 'Investido',
      dica: 'Quanto foi gasto em anúncio',
      valor: (l) => l.s.gasto,
      render: (l) => fBrl(l.s.gasto),
      total: () => fBrl(tot.gasto),
    },
    {
      chave: 'impressoes',
      titulo: 'Viram o anúncio',
      dica: 'Impressões: quantas vezes o anúncio apareceu na tela de alguém',
      valor: (l) => l.s.impressoes,
      render: (l) => fInt(l.s.impressoes),
      total: () => fInt(tot.impressoes),
    },
    {
      chave: 'cliques',
      titulo: 'Cliques',
      dica: 'Cliques no link do anúncio',
      valor: (l) => l.s.cliques,
      render: (l) => fInt(l.s.cliques),
      total: () => fInt(tot.cliques),
    },
    {
      chave: 'ctr',
      titulo: 'Clicam (CTR)',
      dica: 'De cada 100 pessoas que viram o anúncio, quantas clicaram',
      valor: (l) => metricas(l.s).ctr,
      render: (l) => fPct(metricas(l.s).ctr, 2),
      total: () => fPct(m.ctr, 2),
    },
    {
      chave: 'cadastros',
      titulo: 'Cadastros',
      dica: 'Pessoas que preencheram o formulário vindo deste anúncio (pelo UTM)',
      valor: (l) => l.s.cadastros,
      render: (l) => <strong>{fInt(l.s.cadastros)}</strong>,
      total: () => fInt(tot.cadastros),
    },
    {
      chave: 'cpl',
      titulo: 'Custo por cadastro',
      dica: 'Investido ÷ cadastros. Verde: bem abaixo da média da seleção. Vermelho: bem acima.',
      valor: (l) => metricas(l.s).cplReal,
      render: (l) => <Custo v={metricas(l.s).cplReal} media={m.cplReal} />,
      total: () => fBrl(m.cplReal),
    },
    {
      chave: 'cliqueCad',
      titulo: 'Clique → cadastro',
      dica: 'De cada 100 cliques, quantos viraram cadastro. Mostra se a página convence.',
      valor: (l) => metricas(l.s).cliqueCad,
      render: (l) => <Taxa v={metricas(l.s).cliqueCad} bom={15} medio={8} />,
      total: () => fPct(m.cliqueCad),
    },
    {
      chave: 'entradas',
      titulo: 'Entraram no grupo',
      dica: 'Dos cadastros deste anúncio, quantos entraram no grupo do WhatsApp',
      valor: (l) => l.s.entradas,
      render: (l) => fInt(l.s.entradas),
      total: () => fInt(tot.entradas),
    },
    {
      chave: 'cadGrupo',
      titulo: 'Cadastro → grupo',
      dica: 'De cada 100 cadastros, quantos entraram no grupo. Verde: 85% ou mais. Amarelo: 70% a 85%. Vermelho: abaixo de 70%.',
      valor: (l) => metricas(l.s).cadGrupo,
      render: (l) => <Taxa v={metricas(l.s).cadGrupo} bom={85} medio={70} />,
      total: () => fPct(m.cadGrupo),
    },
    {
      chave: 'noGrupo',
      titulo: 'Ainda no grupo',
      dica: 'Dos que entraram, quantos continuam no grupo agora',
      valor: (l) => l.s.no_grupo_agora,
      render: (l) => fInt(l.s.no_grupo_agora),
      total: () => fInt(tot.no_grupo_agora),
    },
    {
      chave: 'custoEntrada',
      titulo: 'Custo por entrada',
      dica: 'Investido ÷ pessoas que entraram no grupo',
      valor: (l) => metricas(l.s).custoEntrada,
      render: (l) => <Custo v={metricas(l.s).custoEntrada} media={m.custoEntrada} />,
      total: () => fBrl(m.custoEntrada),
    },
    {
      chave: 'leadsMeta',
      titulo: 'Leads (Meta)',
      dica: 'Leads que o próprio Meta contou. Costuma ser maior que os cadastros reais.',
      valor: (l) => l.s.leads_meta,
      render: (l) => fInt(l.s.leads_meta),
      total: () => fInt(tot.leads_meta),
    },
    {
      chave: 'cplMeta',
      titulo: 'CPL do Meta',
      dica: 'Investido ÷ leads que o Meta contou',
      valor: (l) => metricas(l.s).cplMeta,
      render: (l) => fBrl(metricas(l.s).cplMeta),
      total: () => fBrl(m.cplMeta),
    },
  ];

  const mudarPublico = (p: FiltroPublico) => {
    setPublico(p);
    setCampanha('');
    setConjunto('');
  };

  const linhaComp = (rotulo: string, a: string, b: string, dica?: string) => (
    <tr key={rotulo} title={dica}>
      <td className="esq">{rotulo}</td>
      <td>{a}</td>
      <td>{b}</td>
    </tr>
  );

  return (
    <>
      <details className="ajuda" open>
        <summary>Como ler esta tela</summary>
        <ul>
          <li>
            O caminho de quem vê o anúncio: <b>vê → clica → se cadastra → entra no grupo → continua no grupo</b>. Cada
            etapa mostra quantas pessoas sobraram em relação à etapa anterior.
          </li>
          <li>
            <b>Custo por cadastro</b> é o que cada pessoa cadastrada custou. Quanto menor, melhor. Verde é bem abaixo da
            média da seleção, vermelho é bem acima.
          </li>
          <li>
            <b>Cadastro → grupo</b> mostra se quem se cadastra chega ao grupo. Verde: 85% ou mais. Amarelo: de 70% a 85%.
            Vermelho: abaixo de 70%.
          </li>
          <li>
            Os cadastros são ligados ao anúncio pelo UTM. Cadastro sem UTM não aparece aqui, então os custos são o pior
            caso. Passe o mouse sobre o título de uma coluna para ver o que ela significa.
          </li>
        </ul>
      </details>

      <div className="filtros-barra">
        <FiltroPeriodo
          min={min}
          max={max}
          de={de}
          ate={ate}
          onChange={(a, b) => {
            setDe(a);
            setAte(b);
          }}
        />
        <div className="filtro">
          <span className="filtro-rotulo">Público</span>
          <div className="segmento" role="group" aria-label="Público">
            {(
              [
                ['todos', 'Todos'],
                ['geral', 'Página geral'],
                ['aluno', 'Página de alunos'],
              ] as [FiltroPublico, string][]
            ).map(([k, r]) => (
              <button key={k} type="button" className={publico === k ? 'on' : undefined} aria-pressed={publico === k} onClick={() => mudarPublico(k)}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <label className="dt-filtro">
          <span>Campanha</span>
          <select
            value={campanha}
            onChange={(e) => {
              setCampanha(e.target.value);
              setConjunto('');
            }}
          >
            <option value="">Todas</option>
            {campanhas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="dt-filtro">
          <span>Público (conjunto)</span>
          <select value={conjunto} onChange={(e) => setConjunto(e.target.value)}>
            <option value="">Todos</option>
            {conjuntos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="nota" style={{ marginTop: 8 }}>
        Mostrando {fDia(de)} a {fDia(ate)} · {fInt(filtradas.length)} linhas de anúncio por dia
      </p>

      <section className="secao">
        <p className="rotulo">Resumo da seleção</p>
        <div className="grade k6">
          {[
            { r: 'Investido', v: fBrl0(tot.gasto), d: `${fInt(tot.impressoes)} viram o anúncio`, destaque: true },
            { r: 'Cadastros', v: fInt(tot.cadastros), d: `${fPct(m.cliqueCad)} dos cliques viram cadastro`, destaque: true },
            { r: 'Custo por cadastro', v: fBrl(m.cplReal), d: `Meta informa ${fBrl(m.cplMeta)}`, destaque: true },
            { r: 'Entraram no grupo', v: fInt(tot.entradas), d: `${fPct(m.cadGrupo)} dos cadastros` },
            { r: 'Custo por entrada', v: fBrl(m.custoEntrada), d: 'cada pessoa que entrou no grupo' },
            { r: 'Ainda no grupo', v: fInt(tot.no_grupo_agora), d: `${fPct(m.retencao)} de quem entrou` },
          ].map((k) => (
            <div key={k.r} className={`card kpi${k.destaque ? ' destaque' : ''}`}>
              <div className="topo-k">
                <div className="rot">{k.r}</div>
              </div>
              <div className="val">{k.v}</div>
              <div className="det">{k.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">Funil da seleção</p>
        <div className="grade c2">
          <div className="card">
            <h2>Do anúncio até o grupo</h2>
            <p className="nota" style={{ marginTop: 0, marginBottom: 18 }}>
              Cada barra mostra quantos continuaram em relação à etapa de cima.
            </p>
            <Etapa n="Viram o anúncio" v={tot.impressoes} largura={100} />
            <Etapa n="Clicaram no link" v={tot.cliques} taxa={m.ctr} rotulo="das impressões" largura={m.ctr ?? 0} />
            <Etapa n="Se cadastraram" v={tot.cadastros} taxa={m.cliqueCad} rotulo="dos cliques" largura={m.cliqueCad ?? 0} />
            <Etapa n="Entraram no grupo" v={tot.entradas} taxa={m.cadGrupo} rotulo="dos cadastros" largura={m.cadGrupo ?? 0} />
            <Etapa n="Continuam no grupo" v={tot.no_grupo_agora} taxa={m.retencao} rotulo="de quem entrou" largura={m.retencao ?? 0} />
            {tot.cliques > 0 && (
              <p className="leitura">
                A cada 100 cliques, <b>{Math.round(pct(tot.cadastros, tot.cliques) ?? 0)}</b> viram cadastro e{' '}
                <b>{Math.round(pct(tot.entradas, tot.cliques) ?? 0)}</b> entram no grupo.
              </p>
            )}
          </div>

          <div className="card">
            <h2>Quanto custa cada etapa</h2>
            <p className="nota" style={{ marginTop: 0, marginBottom: 10 }}>
              Valores da seleção atual.
            </p>
            <table className="mini">
              <tbody>
                <tr>
                  <td className="esq">1.000 pessoas verem o anúncio</td>
                  <td>{fBrl(m.cpm)}</td>
                </tr>
                <tr>
                  <td className="esq">1 clique no link</td>
                  <td>{fBrl(m.cpc)}</td>
                </tr>
                <tr>
                  <td className="esq">1 cadastro</td>
                  <td>
                    <strong>{fBrl(m.cplReal)}</strong>
                  </td>
                </tr>
                <tr>
                  <td className="esq">1 pessoa entrar no grupo</td>
                  <td>
                    <strong>{fBrl(m.custoEntrada)}</strong>
                  </td>
                </tr>
                <tr>
                  <td className="esq">1 pessoa continuar no grupo</td>
                  <td>{fBrl(m.custoNoGrupo)}</td>
                </tr>
                <tr>
                  <td className="esq suave">1 lead segundo o Meta</td>
                  <td className="suave">{fBrl(m.cplMeta)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">Página geral x página de alunos</p>
        <div className="card tabela">
          <table className="comparar">
            <thead>
              <tr>
                <th className="esq">No período escolhido</th>
                <th>
                  Página geral <PillPublico publico="geral" />
                </th>
                <th>
                  Página de alunos <PillPublico publico="aluno" />
                </th>
              </tr>
            </thead>
            <tbody>
              {linhaComp('Investido', fBrl(geral.s.gasto), fBrl(alunos.s.gasto))}
              {linhaComp('Cliques', fInt(geral.s.cliques), fInt(alunos.s.cliques))}
              {linhaComp('Cadastros', fInt(geral.s.cadastros), fInt(alunos.s.cadastros))}
              {linhaComp('Custo por cadastro', fBrl(geral.m.cplReal), fBrl(alunos.m.cplReal), 'Menor é melhor')}
              {linhaComp('Clique → cadastro', fPct(geral.m.cliqueCad), fPct(alunos.m.cliqueCad))}
              {linhaComp('Entraram no grupo', fInt(geral.s.entradas), fInt(alunos.s.entradas))}
              {linhaComp('Cadastro → grupo', fPct(geral.m.cadGrupo), fPct(alunos.m.cadGrupo))}
              {linhaComp('Custo por entrada', fBrl(geral.m.custoEntrada), fBrl(alunos.m.custoEntrada), 'Menor é melhor')}
              {linhaComp('Ainda no grupo', fPct(geral.m.retencao), fPct(alunos.m.retencao))}
            </tbody>
          </table>
        </div>
        <p className="nota">Esta comparação ignora os filtros de público, campanha e conjunto. Só o período vale.</p>
      </section>

      {destaques.length > 0 && (
        <section className="secao">
          <p className="rotulo">Destaques entre os anúncios</p>
          <div className="grade k4">
            {destaques.map((d) => {
              const l = d.l!;
              const ig = seguro(l.info?.instagram_url);
              return (
                <div key={d.rotulo} className={`card dest ${d.cor}`}>
                  <div className="rot">{d.rotulo}</div>
                  <div className="val">{d.valor(l)}</div>
                  <div className="nome">
                    <strong>{l.nome}</strong> <PillPublico publico={l.publico} />
                  </div>
                  <div className="det">{l.sub}</div>
                  {ig && (
                    <a className="ver" href={ig} target="_blank" rel="noopener noreferrer">
                      Ver anúncio <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          <p className="nota">Só entram anúncios com pelo menos R$ 100 investidos na seleção.</p>
        </section>
      )}

      <section className="secao">
        <p className="rotulo">Detalhe</p>
        <div className="segmento grande" role="group" aria-label="Nível de detalhe" style={{ marginBottom: 12 }}>
          {NIVEIS.map((n) => (
            <button key={n.chave} type="button" className={nivel === n.chave ? 'on' : undefined} aria-pressed={nivel === n.chave} onClick={() => setNivel(n.chave)}>
              {n.rotulo}
            </button>
          ))}
        </div>
        <div className="card">
          <DataTable
            key={nivel}
            linhas={linhas}
            colunas={colunas}
            id={(l) => l.id}
            ordemInicial={{ chave: 'gasto', dir: 'desc' }}
            busca="Buscar pelo nome"
            filtros={[
              {
                rotulo: 'Resultado',
                opcoes: [
                  { valor: 'com', rotulo: 'Com cadastros' },
                  { valor: 'sem', rotulo: 'Sem cadastros' },
                ],
                testa: (l, v) => (v === 'com' ? l.s.cadastros > 0 : l.s.cadastros === 0),
              },
            ]}
          />
        </div>
        <p className="nota">
          Clique no título de uma coluna para ordenar. Cadastros e entradas são contados no dia do cadastro.
        </p>
      </section>
    </>
  );
}
