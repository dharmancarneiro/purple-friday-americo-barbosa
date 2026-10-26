'use client';

import {
  CalendarClock,
  DoorOpen,
  Info,
  Link2,
  Megaphone,
  MousePointerClick,
  Percent,
  Send,
  Sprout,
  Tag,
  Target,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import Chart from '@/components/Chart';
import FiltroPeriodo from '@/components/FiltroPeriodo';
import Kpi from '@/components/Kpi';
import PublicoTabs from '@/components/PublicoTabs';
import {
  adsDoPublico,
  coorteDoPublico,
  DICA_FONTE,
  FONTES,
  faixa,
  listarDias,
  noIntervalo,
  porFonte,
  ROTULO_FONTE,
  somarCoorte,
  type FiltroPublico,
  type FonteChave,
} from '@/lib/coorte';
import type { AnuncioDia, AnuncioInfo, CoorteDia, Disparo, Fontes } from '@/lib/data';
import { div, fBrl, fBrl0, fDia, fInt, fPct, pct } from '@/lib/format';
import type { Delta } from '@/components/Kpi';
import { addDias, juntar, metricas, somar } from '@/lib/trafego';

const ICONE_FONTE: Record<FonteChave, LucideIcon> = {
  trafego: Megaphone,
  api_oficial: Send,
  link_grupo: Link2,
  organico: Sprout,
  sem_utm: Tag,
};

function diasAte(iso: string | undefined, hoje: string) {
  if (!iso) return null;
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
}

function faltam(n: number | null) {
  if (n == null) return '';
  if (n > 1) return `faltam ${n} dias`;
  if (n === 1) return 'falta 1 dia';
  if (n === 0) return 'é hoje';
  return 'já aconteceu';
}

type Props = {
  info: AnuncioInfo[];
  dias: AnuncioDia[];
  coorte: CoorteDia[];
  lives: Fontes['lives'];
  listas: Disparo['listas'];
  semDadosNovos: boolean;
};

export default function VisaoView({ info, dias, coorte, lives, listas, semDadosNovos }: Props) {
  const todasAds = useMemo(() => juntar(dias, info), [dias, info]);
  const { min, max } = useMemo(() => faixa(dias, coorte), [dias, coorte]);

  const [de, setDe] = useState(min);
  const [ate, setAte] = useState(max);
  const [publico, setPublico] = useState<FiltroPublico>('todos');

  const adsPub = useMemo(() => adsDoPublico(todasAds, publico), [todasAds, publico]);
  const cooPub = useMemo(() => coorteDoPublico(coorte, publico), [coorte, publico]);


  if (!min) return <p className="nota">Ainda não há dados.</p>;

  const ads = noIntervalo(adsPub, de, ate);
  const coo = noIntervalo(cooPub, de, ate);

  const t = somar(ads);
  const m = metricas(t);
  const fontes = porFonte(coo);
  const total = somarCoorte(coo);
  const pago = fontes.trafego;

  const cplBM = div(t.gasto, t.leads_meta);
  const cplReal = div(t.gasto, pago.cadastros);
  const cplGeral = div(t.gasto, total.cadastros);

  // Período anterior, do mesmo tamanho, logo antes do escolhido (só se houver dados).
  const nDias = listarDias(de, ate).length;
  const antAte = addDias(de, -1);
  const antDe = addDias(de, -nDias);
  const temAnterior = antDe >= min;
  const tAnt = somar(noIntervalo(adsPub, antDe, antAte));
  const cooAnt = noIntervalo(cooPub, antDe, antAte);
  const fontesAnt = porFonte(cooAnt);
  const totalAnt = somarCoorte(cooAnt);

  /** menorEhMelhor: para custos. Mudança abaixo de 2% é tratada como estável. */
  const variacao = (novo: number | null, antigo: number | null, menorEhMelhor: boolean): Delta | null => {
    if (!temAnterior || novo == null || antigo == null || antigo === 0) return null;
    const p = ((novo - antigo) / antigo) * 100;
    if (Math.abs(p) < 2) return { texto: '= estável vs período anterior', tom: 'neutro' };
    const sobe = p > 0;
    return {
      texto: `${sobe ? '▲' : '▼'} ${fPct(Math.abs(p), 0)} vs período anterior`,
      tom: sobe === menorEhMelhor ? 'ruim' : 'bom',
    };
  };

  // série por dia
  const lista = listarDias(de, ate);
  const serieCpl = lista.map((d) => {
    const a = somar(ads.filter((r) => r.dia === d));
    const c = coo.filter((r) => r.dia === d);
    const cadPago = somarCoorte(c.filter((r) => r.fonte === 'trafego')).cadastros;
    const cadTodos = somarCoorte(c).cadastros;
    return {
      dia: fDia(d),
      bm: a.gasto > 0 ? div(a.gasto, a.leads_meta) : null,
      real: a.gasto > 0 ? div(a.gasto, cadPago) : null,
      geral: a.gasto > 0 ? div(a.gasto, cadTodos) : null,
      gasto: a.gasto,
    };
  });
  const serieFonte = lista.map((d) => {
    const f = porFonte(coo.filter((r) => r.dia === d));
    return {
      dia: fDia(d),
      trafego: f.trafego.cadastros,
      api_oficial: f.api_oficial.cadastros,
      link_grupo: f.link_grupo.cadastros,
      organico: f.organico.cadastros,
      sem_utm: f.sem_utm.cadastros,
    };
  });

  const hojeSP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const listaLives = [
    { nome: 'Live dos alunos', data: lives.data_live_aluno, hora: lives.horario_live_aluno },
    { nome: 'Live geral', data: lives.data_live, hora: lives.horario_live },
  ].filter((l) => l.data);

  const funil = [
    { n: 'Viram o anúncio', v: t.impressoes, de: null as number | null },
    { n: 'Clicaram no link', v: t.cliques, de: t.impressoes },
    { n: 'Se cadastraram (tráfego pago)', v: pago.cadastros, de: t.cliques },
    { n: 'Entraram no grupo', v: pago.entradas, de: pago.cadastros },
    { n: 'Continuam no grupo', v: pago.no_grupo_agora, de: pago.entradas },
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
              números por público e por fonte aparecem zerados.
            </p>
          </div>
        </div>
      )}

      <div className="chips" style={{ marginBottom: 16 }}>
        {listaLives.map((l) => (
          <span className="chip" key={l.nome}>
            <CalendarClock size={14} aria-hidden="true" />
            {l.nome} {fDia(l.data!)} às {l.hora} · {faltam(diasAte(l.data, hojeSP))}
          </span>
        ))}
      </div>

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

      <section className="secao">
        <p className="rotulo">Custo por lead</p>
        <div className="grade k4">
          <Kpi
            icone={Wallet}
            rotulo="Investimento em tráfego"
            valor={fBrl0(t.gasto)}
            delta={variacao(t.gasto, tAnt.gasto, false) && { ...variacao(t.gasto, tAnt.gasto, false)!, tom: 'neutro' }}
            detalhe={`${fInt(t.impressoes)} viram o anúncio`}
          />
          <Kpi
            icone={Target}
            rotulo="CPL do Meta"
            valor={fBrl(cplBM)}
            delta={variacao(cplBM, div(tAnt.gasto, tAnt.leads_meta), true)}
            detalhe={`${fInt(t.leads_meta)} leads contados pelo Meta`}
          />
          <Kpi
            destaque
            icone={Megaphone}
            rotulo="CPL real do tráfego"
            valor={fBrl(cplReal)}
            delta={variacao(cplReal, div(tAnt.gasto, fontesAnt.trafego.cadastros), true)}
            detalhe={`${fInt(pago.cadastros)} cadastros que vieram do pago`}
          />
          <Kpi
            destaque
            icone={UserPlus}
            rotulo="CPL geral"
            valor={fBrl(cplGeral)}
            delta={variacao(cplGeral, div(tAnt.gasto, totalAnt.cadastros), true)}
            detalhe={`${fInt(total.cadastros)} cadastros, todas as fontes`}
          />
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">Cadastros por fonte</p>
        <div className="grade k6">
          <Kpi
            destaque
            icone={Users}
            rotulo="Total de cadastros"
            valor={fInt(total.cadastros)}
            delta={variacao(total.cadastros, totalAnt.cadastros, false)}
            detalhe={`${fPct(pct(total.entradas, total.cadastros), 0)} entraram no grupo`}
          />
          {FONTES.map((f) => (
            <div key={f} title={DICA_FONTE[f]}>
              <Kpi
                icone={ICONE_FONTE[f]}
                rotulo={ROTULO_FONTE[f]}
                valor={fInt(fontes[f].cadastros)}
                detalhe={`${fPct(pct(fontes[f].cadastros, total.cadastros), 0)} do total · ${fPct(pct(fontes[f].entradas, fontes[f].cadastros), 0)} no grupo`}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">Conversão</p>
        <div className="grade k4">
          <Kpi
            icone={MousePointerClick}
            rotulo="Clique → cadastro (pago)"
            valor={fPct(pct(pago.cadastros, t.cliques))}
            detalhe={`${fInt(t.cliques)} cliques · CTR ${fPct(m.ctr, 2)}`}
          />
          <Kpi
            icone={Percent}
            rotulo="Cadastro → grupo"
            valor={fPct(pct(total.entradas, total.cadastros))}
            detalhe={`${fInt(total.entradas)} dos ${fInt(total.cadastros)} cadastros entraram`}
          />
          <Kpi
            icone={DoorOpen}
            rotulo="Continuam no grupo"
            valor={fInt(total.no_grupo_agora)}
            detalhe={`${fInt(total.sairam)} já saíram alguma vez`}
          />
          <Kpi
            icone={Wallet}
            rotulo="Custo por entrada (pago)"
            valor={fBrl(div(t.gasto, pago.entradas))}
            detalhe={`${fInt(pago.entradas)} entradas do tráfego pago`}
          />
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">Por dia</p>
        <div className="card">
          <h2>Custo por lead</h2>
          <Chart
            titulo="Custo por lead por dia: Meta, real do tráfego e geral"
            tipo="linha"
            dados={serieCpl}
            x="dia"
            formato="brl"
            series={[
              { key: 'bm', nome: 'CPL do Meta', cor: 'var(--series-1)' },
              { key: 'real', nome: 'CPL real do tráfego', cor: 'var(--series-2)' },
              { key: 'geral', nome: 'CPL geral', cor: 'var(--series-3)' },
            ]}
          />
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <h2>Cadastros por fonte</h2>
          <Chart
            titulo="Cadastros por dia, divididos por fonte"
            tipo="empilhada"
            dados={serieFonte}
            x="dia"
            altura={280}
            series={[
              { key: 'trafego', nome: 'Tráfego pago', cor: 'var(--series-1)' },
              { key: 'api_oficial', nome: 'API oficial', cor: 'var(--series-2)' },
              { key: 'link_grupo', nome: 'Link do grupo', cor: 'var(--series-3)' },
              { key: 'organico', nome: 'Orgânico', cor: 'var(--series-4)' },
              { key: 'sem_utm', nome: 'Sem UTM', cor: 'var(--series-5)' },
            ]}
          />
        </div>
        <div className="grade c2" style={{ marginTop: 14 }}>
          <div className="card">
            <h2>Investimento</h2>
            <Chart
              titulo="Investimento por dia"
              tipo="barra"
              dados={serieCpl}
              x="dia"
              formato="brl"
              series={[{ key: 'gasto', nome: 'Investimento', cor: 'var(--accent)' }]}
            />
          </div>
          <div className="card">
            <h2>Funil do tráfego pago</h2>
            {funil.map((l) => (
              <div className="funil-linha" key={l.n}>
                <div className="topo-l">
                  <span>{l.n}</span>
                  <b>
                    {fInt(l.v)}
                    {l.de != null && ` · ${fPct(pct(l.v, l.de), l.n.startsWith('Clicaram') ? 2 : 1)}`}
                  </b>
                </div>
                <div className="barra">
                  <span style={{ width: `${l.de == null ? 100 : Math.max(2, Math.min(100, pct(l.v, l.de) ?? 0))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
