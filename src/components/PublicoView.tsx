'use client';

import { DoorOpen, Info, LogOut, Percent, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import Chart from '@/components/Chart';
import DataTable, { type Coluna } from '@/components/DataTable';
import FiltroPeriodo from '@/components/FiltroPeriodo';
import { Taxa } from '@/components/Indicadores';
import Kpi from '@/components/Kpi';
import PublicoTabs from '@/components/PublicoTabs';
import {
  coorteDoPublico,
  DICA_FONTE,
  faixa,
  FONTES,
  noIntervalo,
  porFonte,
  ROTULO_FONTE,
  somarCoorte,
  type FiltroPublico,
  type FonteChave,
  type SomaCoorte,
} from '@/lib/coorte';
import UtmQuadro from '@/components/UtmQuadro';
import type { CoorteDia, Publico, UtmDia } from '@/lib/data';
import { fInt, fPct, pct } from '@/lib/format';

type LinhaFonte = SomaCoorte & { fonte: FonteChave; total: number };
type Par = { cadastros: number; entradas: number };

const colunasPar = <T extends Par>(chave: string, titulo: string, nome: (l: T) => string): Coluna<T>[] => [
  { chave, titulo, esquerda: true, valor: nome, render: (l) => nome(l) },
  { chave: 'cadastros', titulo: 'Cadastros', valor: (l) => l.cadastros, render: (l) => fInt(l.cadastros) },
  { chave: 'entradas', titulo: 'Entraram no grupo', valor: (l) => l.entradas, render: (l) => fInt(l.entradas) },
  {
    chave: 'taxa',
    titulo: 'Cadastro → grupo',
    dica: 'De cada 100 cadastros, quantos entraram no grupo',
    valor: (l) => pct(l.entradas, l.cadastros),
    render: (l) => <Taxa v={pct(l.entradas, l.cadastros)} bom={85} medio={70} />,
  },
];

export default function PublicoView({
  p,
  coorte,
  utms,
  semUtms,
  semDadosNovos,
}: {
  p: Publico;
  coorte: CoorteDia[];
  utms: UtmDia[];
  semUtms: boolean;
  semDadosNovos: boolean;
}) {
  const { min, max } = useMemo(() => faixa(coorte), [coorte]);
  const [de, setDe] = useState(min);
  const [ate, setAte] = useState(max);
  const [publico, setPublico] = useState<FiltroPublico>('todos');

  const coo = useMemo(() => noIntervalo(coorteDoPublico(coorte, publico), de, ate), [coorte, publico, de, ate]);
  const f = useMemo(() => porFonte(coo), [coo]);
  const tot = somarCoorte(coo);

  const linhas: LinhaFonte[] = FONTES.map((k) => ({ ...f[k], fonte: k, total: tot.cadastros }));

  // comparação Alunos x Não alunos: só o período vale
  const comp = (pub: 'aluno' | 'geral') => somarCoorte(noIntervalo(coorte, de, ate).filter((r) => r.publico === pub));
  const al = comp('aluno');
  const ge = comp('geral');

  const colunasFonte: Coluna<LinhaFonte>[] = [
    { chave: 'fonte', titulo: 'Fonte', esquerda: true, dica: 'De onde veio o cadastro, segundo o UTM', valor: (l) => ROTULO_FONTE[l.fonte], render: (l) => <span title={DICA_FONTE[l.fonte]}>{ROTULO_FONTE[l.fonte]}</span>, total: () => 'Total' },
    { chave: 'cadastros', titulo: 'Cadastros', valor: (l) => l.cadastros, render: (l) => <strong>{fInt(l.cadastros)}</strong>, total: () => fInt(tot.cadastros) },
    { chave: 'parte', titulo: '% do total', valor: (l) => pct(l.cadastros, l.total), render: (l) => fPct(pct(l.cadastros, l.total)), total: () => '100%' },
    { chave: 'entradas', titulo: 'Entraram no grupo', valor: (l) => l.entradas, render: (l) => fInt(l.entradas), total: () => fInt(tot.entradas) },
    {
      chave: 'taxa',
      titulo: 'Cadastro → grupo',
      dica: 'De cada 100 cadastros desta fonte, quantos entraram no grupo. Verde: 85% ou mais. Amarelo: 70% a 85%. Vermelho: abaixo de 70%.',
      valor: (l) => pct(l.entradas, l.cadastros),
      render: (l) => <Taxa v={pct(l.entradas, l.cadastros)} bom={85} medio={70} />,
      total: () => <Taxa v={pct(tot.entradas, tot.cadastros)} bom={85} medio={70} />,
    },
    { chave: 'no_grupo', titulo: 'Continuam no grupo', valor: (l) => l.no_grupo_agora, render: (l) => fInt(l.no_grupo_agora), total: () => fInt(tot.no_grupo_agora) },
    { chave: 'sairam', titulo: 'Já saíram', dica: 'Entraram e saíram ao menos uma vez', valor: (l) => l.sairam, render: (l) => fInt(l.sairam), total: () => fInt(tot.sairam) },
  ];

  if (!min) return <p className="nota">Ainda não há dados.</p>;

  const linhaComp = (rotulo: string, a: string, b: string) => (
    <tr key={rotulo}>
      <td className="esq">{rotulo}</td>
      <td>{a}</td>
      <td>{b}</td>
    </tr>
  );

  return (
    <>
      {semDadosNovos && (
        <div className="alerta atencao" role="status" style={{ marginBottom: 16 }}>
          <Info />
          <div>
            <strong>Falta atualizar o banco</strong>
            <p>
              A migration <code>20261026000000_dash_pf_coorte_disparo.sql</code> ainda não foi aplicada. Sem ela, os números
              por fonte e por público aparecem zerados.
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

      <section className="secao">
        <p className="rotulo">Resumo</p>
        <div className="grade k4">
          <Kpi destaque icone={UserPlus} rotulo="Cadastros" valor={fInt(tot.cadastros)} detalhe={`${fInt(f.trafego.cadastros)} vieram do tráfego pago`} />
          <Kpi icone={DoorOpen} rotulo="Entraram no grupo" valor={fInt(tot.entradas)} detalhe={`${fPct(pct(tot.entradas, tot.cadastros))} dos cadastros`} />
          <Kpi icone={Percent} rotulo="Continuam no grupo" valor={fInt(tot.no_grupo_agora)} detalhe={`${fPct(pct(tot.no_grupo_agora, tot.entradas))} de quem entrou`} />
          <Kpi icone={LogOut} rotulo="Já saíram do grupo" valor={fInt(tot.sairam)} detalhe="saíram ao menos uma vez" />
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">De onde vieram os cadastros</p>
        <div className="card">
          <DataTable linhas={linhas} colunas={colunasFonte} id={(l) => l.fonte} ordemInicial={{ chave: 'cadastros', dir: 'desc' }} />
        </div>
        <p className="nota">Passe o mouse sobre o nome da fonte para ver o que ela significa.</p>
      </section>

      <section className="secao">
        <p className="rotulo">UTMs dos cadastros</p>
        {semUtms ? (
          <div className="alerta atencao" role="status">
            <Info />
            <div>
              <strong>Falta atualizar o banco</strong>
              <p>
                A migration <code>20261027000200_dash_pf_utms.sql</code> ainda não foi aplicada. Sem ela, o quadro de UTMs fica
                vazio.
              </p>
            </div>
          </div>
        ) : (
          <>
            <UtmQuadro utms={utms} publico={publico} de={de} ate={ate} />
            <p className="nota">
              Vale o período e o público escolhidos acima, pelo dia do cadastro. Conta a UTM do primeiro toque de cada pessoa.
              Nos cadastros pelo convite de WhatsApp, o conteúdo é o nome da lista que recebeu o convite.
            </p>
          </>
        )}
      </section>

      <section className="secao">
        <p className="rotulo">Alunos x não alunos</p>
        <div className="card tabela">
          <table className="comparar">
            <thead>
              <tr>
                <th className="esq">No período escolhido</th>
                <th>Alunos</th>
                <th>Não alunos</th>
              </tr>
            </thead>
            <tbody>
              {linhaComp('Cadastros', fInt(al.cadastros), fInt(ge.cadastros))}
              {linhaComp('Entraram no grupo', fInt(al.entradas), fInt(ge.entradas))}
              {linhaComp('Cadastro → grupo', fPct(pct(al.entradas, al.cadastros)), fPct(pct(ge.entradas, ge.cadastros)))}
              {linhaComp('Continuam no grupo', fInt(al.no_grupo_agora), fInt(ge.no_grupo_agora))}
              {linhaComp('Continuam, entre os que entraram', fPct(pct(al.no_grupo_agora, al.entradas)), fPct(pct(ge.no_grupo_agora, ge.entradas)))}
              {linhaComp('Já saíram', fInt(al.sairam), fInt(ge.sairam))}
            </tbody>
          </table>
        </div>
        <p className="nota">Esta comparação ignora a aba de público e usa só o período.</p>
      </section>

      <section className="secao">
        <p className="rotulo">Tempo até entrar no grupo</p>
        <div className="card">
          <h2>Pessoas por faixa de tempo</h2>
          <Chart
            titulo="Pessoas por faixa de tempo entre cadastro e entrada no grupo"
            tipo="barra"
            dados={p.tempo_ate_grupo.map((t) => ({ faixa: t.faixa, pessoas: t.pessoas }))}
            x="faixa"
            series={[{ key: 'pessoas', nome: 'Pessoas', cor: 'var(--accent)' }]}
          />
          <p className="nota">
            Todo o lançamento, todos os públicos. Quem demora mais para entrar é quem foi alcançado pela régua de mensagens.
          </p>
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">Localização e aparelho (todo o lançamento)</p>
        <div className="grade c2">
          <div className="card">
            <h2>Estados</h2>
            <DataTable
              linhas={p.estados}
              colunas={colunasPar<Publico['estados'][number]>('estado', 'Estado', (l) => l.estado)}
              id={(l) => l.estado}
              ordemInicial={{ chave: 'cadastros', dir: 'desc' }}
              busca="Buscar estado"
            />
            <p className="nota">A maior parte dos cadastros ainda não tem estado informado.</p>
          </div>
          <div className="card">
            <h2>Aparelho</h2>
            <DataTable
              linhas={p.aparelhos}
              colunas={colunasPar<Publico['aparelhos'][number]>('aparelho', 'Aparelho', (l) => l.aparelho)}
              id={(l) => l.aparelho}
              ordemInicial={{ chave: 'cadastros', dir: 'desc' }}
            />
          </div>
        </div>
      </section>
    </>
  );
}
