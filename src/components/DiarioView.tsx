'use client';

import { Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import Chart from '@/components/Chart';
import DataTable, { type Coluna } from '@/components/DataTable';
import FiltroPeriodo from '@/components/FiltroPeriodo';
import { Custo, Taxa } from '@/components/Indicadores';
import PublicoTabs from '@/components/PublicoTabs';
import {
  adsDoPublico,
  coorteDoPublico,
  faixa,
  listarDias,
  noIntervalo,
  porFonte,
  ROTULO_FONTE,
  somarCoorte,
  type FiltroPublico,
} from '@/lib/coorte';
import type { AnuncioDia, AnuncioInfo, CoorteDia, Dia } from '@/lib/data';
import { div, fBrl, fDia, fInt, pct } from '@/lib/format';
import { juntar, somar } from '@/lib/trafego';

type Linha = {
  dia: string;
  gasto: number;
  cliques: number;
  cadastros: number;
  trafego: number;
  api_oficial: number;
  link_grupo: number;
  organico: number;
  sem_utm: number;
  entraram: number;
  entradasDia: number;
};

type Props = { diario: Dia[]; info: AnuncioInfo[]; dias: AnuncioDia[]; coorte: CoorteDia[]; semDadosNovos: boolean };

export default function DiarioView({ diario, info, dias, coorte, semDadosNovos }: Props) {
  const ads = useMemo(() => juntar(dias, info), [dias, info]);
  const { min, max } = useMemo(() => faixa(dias, coorte, diario), [dias, coorte, diario]);

  const [de, setDe] = useState(min);
  const [ate, setAte] = useState(max);
  const [publico, setPublico] = useState<FiltroPublico>('todos');

  const linhas = useMemo<Linha[]>(() => {
    if (!min) return [];
    const a = noIntervalo(adsDoPublico(ads, publico), de, ate);
    const c = noIntervalo(coorteDoPublico(coorte, publico), de, ate);
    return listarDias(de, ate).map((d) => {
      const g = somar(a.filter((r) => r.dia === d));
      const f = porFonte(c.filter((r) => r.dia === d));
      const tot = somarCoorte(Object.values(f));
      const e = diario.find((x) => x.dia === d);
      return {
        dia: d,
        gasto: g.gasto,
        cliques: g.cliques,
        cadastros: tot.cadastros,
        trafego: f.trafego.cadastros,
        api_oficial: f.api_oficial.cadastros,
        link_grupo: f.link_grupo.cadastros,
        organico: f.organico.cadastros,
        sem_utm: f.sem_utm.cadastros,
        entraram: tot.entradas,
        entradasDia: e ? (publico === 'todos' ? e.entradas : publico === 'aluno' ? e.ent_aluno : e.ent_nao_aluno) : 0,
      };
    });
  }, [ads, coorte, diario, de, ate, publico, min]);

  if (!min) return <p className="nota">Ainda não há dados.</p>;

  const soma = (k: keyof Linha) => linhas.reduce((s, l) => s + (l[k] as number), 0);
  const tot = {
    gasto: soma('gasto'),
    cliques: soma('cliques'),
    cadastros: soma('cadastros'),
    trafego: soma('trafego'),
    api_oficial: soma('api_oficial'),
    link_grupo: soma('link_grupo'),
    organico: soma('organico'),
    sem_utm: soma('sem_utm'),
    entraram: soma('entraram'),
    entradasDia: soma('entradasDia'),
  };
  const cplMedio = div(tot.gasto, tot.trafego);

  const serie = linhas.map((l) => ({
    dia: fDia(l.dia),
    trafego: l.trafego,
    api_oficial: l.api_oficial,
    link_grupo: l.link_grupo,
    organico: l.organico,
    sem_utm: l.sem_utm,
    entradasDia: l.entradasDia,
    real: l.gasto > 0 ? div(l.gasto, l.trafego) : null,
    geral: l.gasto > 0 ? div(l.gasto, l.cadastros) : null,
    taxa: pct(l.entraram, l.cadastros),
  }));

  const colunas: Coluna<Linha>[] = [
    { chave: 'dia', titulo: 'Dia', esquerda: true, valor: (l) => l.dia, render: (l) => fDia(l.dia), total: () => 'Total' },
    { chave: 'gasto', titulo: 'Investido', dica: 'Gasto em anúncios no dia', valor: (l) => l.gasto, render: (l) => fBrl(l.gasto), total: () => fBrl(tot.gasto) },
    {
      chave: 'cadastros',
      titulo: 'Cadastros',
      dica: 'Todas as fontes juntas',
      valor: (l) => l.cadastros,
      render: (l) => <strong>{fInt(l.cadastros)}</strong>,
      total: () => fInt(tot.cadastros),
    },
    { chave: 'trafego', titulo: ROTULO_FONTE.trafego, dica: 'Cadastros que vieram de anúncios', valor: (l) => l.trafego, render: (l) => fInt(l.trafego), total: () => fInt(tot.trafego) },
    { chave: 'api', titulo: 'API oficial', dica: 'Cadastros de quem recebeu o convite por WhatsApp', valor: (l) => l.api_oficial, render: (l) => fInt(l.api_oficial), total: () => fInt(tot.api_oficial) },
    { chave: 'link', titulo: 'Link do grupo', dica: 'Cadastros pelo link que circula nos grupos', valor: (l) => l.link_grupo, render: (l) => fInt(l.link_grupo), total: () => fInt(tot.link_grupo) },
    { chave: 'organico', titulo: 'Orgânico', dica: 'Instagram sem anúncio', valor: (l) => l.organico, render: (l) => fInt(l.organico), total: () => fInt(tot.organico) },
    { chave: 'sem', titulo: 'Sem UTM', dica: 'Sem origem registrada. Parte pode ser tráfego pago sem rastreio.', valor: (l) => l.sem_utm, render: (l) => fInt(l.sem_utm), total: () => fInt(tot.sem_utm) },
    {
      chave: 'cpl',
      titulo: 'Custo por cadastro (pago)',
      dica: 'Investido ÷ cadastros do tráfego. Verde: bem abaixo da média do período. Vermelho: bem acima.',
      valor: (l) => (l.gasto > 0 ? div(l.gasto, l.trafego) : null),
      render: (l) => <Custo v={l.gasto > 0 ? div(l.gasto, l.trafego) : null} media={cplMedio} />,
      total: () => fBrl(cplMedio),
    },
    {
      chave: 'entraram',
      titulo: 'Entraram no grupo',
      dica: 'Dos cadastros deste dia, quantos entraram no grupo (em qualquer data)',
      valor: (l) => l.entraram,
      render: (l) => fInt(l.entraram),
      total: () => fInt(tot.entraram),
    },
    {
      chave: 'taxa',
      titulo: 'Cadastro → grupo',
      dica: 'Dos cadastros do dia, quantos entraram no grupo. Nos dias mais recentes ainda está subindo, porque a pessoa pode entrar depois.',
      valor: (l) => pct(l.entraram, l.cadastros),
      render: (l) => <Taxa v={pct(l.entraram, l.cadastros)} bom={85} medio={70} />,
      total: () => <Taxa v={pct(tot.entraram, tot.cadastros)} bom={85} medio={70} />,
    },
    {
      chave: 'entradasDia',
      titulo: 'Entradas no dia',
      dica: 'Pessoas que entraram no grupo neste dia, mesmo que tenham se cadastrado antes',
      valor: (l) => l.entradasDia,
      render: (l) => fInt(l.entradasDia),
      total: () => fInt(tot.entradasDia),
    },
  ];

  return (
    <>
      {semDadosNovos && (
        <div className="alerta atencao" role="status" style={{ marginBottom: 16 }}>
          <Info />
          <div>
            <strong>Falta atualizar o banco</strong>
            <p>
              A migration <code>20261026000000_dash_pf_coorte_disparo.sql</code> ainda não foi aplicada. Sem ela, os
              cadastros por fonte aparecem zerados.
            </p>
          </div>
        </div>
      )}

      <div className="filtros-barra">
        <PublicoTabs valor={publico} onChange={setPublico} />
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
      </div>

      <div className="grade c2" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>Cadastros por dia, por fonte</h2>
          <Chart
            titulo="Cadastros por dia, divididos por fonte"
            tipo="empilhada"
            dados={serie}
            x="dia"
            series={[
              { key: 'trafego', nome: 'Tráfego pago', cor: 'var(--series-1)' },
              { key: 'api_oficial', nome: 'API oficial', cor: 'var(--series-2)' },
              { key: 'link_grupo', nome: 'Link do grupo', cor: 'var(--series-3)' },
              { key: 'organico', nome: 'Orgânico', cor: 'var(--series-4)' },
              { key: 'sem_utm', nome: 'Sem UTM', cor: 'var(--series-5)' },
            ]}
          />
        </div>
        <div className="card">
          <h2>Entradas no grupo por dia</h2>
          <Chart
            titulo="Pessoas que entraram no grupo em cada dia"
            tipo="barra"
            dados={serie}
            x="dia"
            series={[{ key: 'entradasDia', nome: 'Entradas no grupo', cor: 'var(--accent)' }]}
          />
        </div>
        <div className="card">
          <h2>Custo por cadastro</h2>
          <Chart
            titulo="Custo por cadastro por dia, do tráfego e geral"
            tipo="linha"
            dados={serie}
            x="dia"
            formato="brl"
            series={[
              { key: 'real', nome: 'Real do tráfego', cor: 'var(--series-2)' },
              { key: 'geral', nome: 'Geral (todas as fontes)', cor: 'var(--series-3)' },
            ]}
          />
        </div>
        <div className="card">
          <h2>Cadastro → grupo</h2>
          <Chart
            titulo="Percentual dos cadastros do dia que entraram no grupo"
            tipo="linha"
            dados={serie}
            x="dia"
            formato="pct"
            series={[{ key: 'taxa', nome: 'Entraram no grupo', cor: 'var(--accent-2)' }]}
          />
          <p className="nota">Nos últimos dias o número ainda sobe, porque a pessoa pode entrar no grupo depois.</p>
        </div>
      </div>

      <section className="secao">
        <p className="rotulo">Tabela</p>
        <div className="card">
          <DataTable
            linhas={linhas}
            colunas={colunas}
            id={(l) => l.dia}
            ordemInicial={{ chave: 'dia', dir: 'desc' }}
            filtros={[
              {
                rotulo: 'Investimento',
                opcoes: [
                  { valor: 'com', rotulo: 'Dias com investimento' },
                  { valor: 'sem', rotulo: 'Dias sem investimento' },
                ],
                testa: (l, v) => (v === 'com' ? l.gasto > 0 : l.gasto === 0),
              },
            ]}
          />
        </div>
        <p className="nota">
          Cadastros e “entraram no grupo” são contados no dia do cadastro. “Entradas no dia” conta o dia em que a pessoa
          entrou no grupo, inclusive quem entrou direto, sem formulário.
        </p>
      </section>
    </>
  );
}
