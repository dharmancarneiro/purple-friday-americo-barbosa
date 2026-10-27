'use client';

import { Info, MailCheck, MessageSquare, Repeat, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import Chart from '@/components/Chart';
import DataTable, { type Coluna } from '@/components/DataTable';
import FiltroPeriodo from '@/components/FiltroPeriodo';
import { PillPublico, Taxa } from '@/components/Indicadores';
import Kpi from '@/components/Kpi';
import PublicoTabs from '@/components/PublicoTabs';
import { faixa, listarDias, noIntervalo, passaPublico, somarCoorte, type FiltroPublico } from '@/lib/coorte';
import type { ConferenciaDia, CoorteDia, Disparo, DisparoDia, Disparos } from '@/lib/data';
import { fDia, fInt, fPct, pct } from '@/lib/format';

type Lista = Disparo['listas'][number];
type Etapa = Disparo['regua'][number];
type PorDisparo = Disparos['por_disparo'][number];

const NOME: Record<string, string> = { aluno: 'Alunos', nao_aluno: 'Não alunos' };
const pubKey = (p: string) => (p === 'aluno' ? 'aluno' : 'geral');
const grupoPublico = (g: string): 'aluno' | 'geral' | null => (g === 'convite_aluno' ? 'aluno' : g === 'convite_nao_aluno' ? 'geral' : null);
const ROTULO_GRUPO: Record<string, string> = { convite_aluno: 'Convite · Alunos', convite_nao_aluno: 'Convite · Não alunos', regua: 'Régua de mensagens' };
const soma = <T,>(ls: T[], f: (l: T) => number) => ls.reduce((s, l) => s + f(l), 0);

const ROTULO_PROVEDOR: Record<string, string> = { datacrazy: 'DataCrazy', manychat: 'ManyChat', outro: 'Outros' };
type LinhaProvedor = { provedor: string; envios: number; pessoas: number; confirmaram: number; cadastros: number; entraram: number };
type LinhaProvedorDia = LinhaProvedor & { dia: string };

/** Colunas comuns às duas tabelas do bloco por provedor. */
function colunasProvedor<T extends LinhaProvedor>(): Coluna<T>[] {
  const somaCol = (f: (l: LinhaProvedor) => number) => (ls: T[]) => fInt(soma(ls, f));
  return [
    { chave: 'envios', titulo: 'Convites enviados', dica: 'Mensagens enviadas. A mesma pessoa pode receber mais de uma.', valor: (l) => l.envios, render: (l) => <strong>{fInt(l.envios)}</strong>, total: somaCol((l) => l.envios) },
    { chave: 'pessoas', titulo: 'Pessoas alcançadas', dica: 'Pessoas diferentes que receberam, contadas por dia de disparo.', valor: (l) => l.pessoas, render: (l) => fInt(l.pessoas), total: somaCol((l) => l.pessoas) },
    { chave: 'confirmaram', titulo: 'Confirmaram', dica: 'Responderam confirmando, ligadas ao último convite recebido nas 72 h antes da resposta.', valor: (l) => l.confirmaram, render: (l) => fInt(l.confirmaram), total: somaCol((l) => l.confirmaram) },
    {
      chave: 'pctConf',
      titulo: '% confirmou',
      dica: 'Confirmaram ÷ pessoas alcançadas',
      valor: (l) => pct(l.confirmaram, l.pessoas),
      render: (l) => fPct(pct(l.confirmaram, l.pessoas), 1),
      total: (ls) => fPct(pct(soma(ls, (l) => l.confirmaram), soma(ls, (l) => l.pessoas)), 1),
    },
    { chave: 'cadastros', titulo: 'Cadastraram', dica: 'Cadastros com origem WhatsApp (disparo_api), ligados ao último convite recebido nas 72 h antes do cadastro.', valor: (l) => l.cadastros, render: (l) => <strong>{fInt(l.cadastros)}</strong>, total: somaCol((l) => l.cadastros) },
    {
      chave: 'pctCad',
      titulo: '% cadastrou',
      dica: 'Cadastraram ÷ pessoas alcançadas',
      valor: (l) => pct(l.cadastros, l.pessoas),
      render: (l) => fPct(pct(l.cadastros, l.pessoas), 1),
      total: (ls) => fPct(pct(soma(ls, (l) => l.cadastros), soma(ls, (l) => l.pessoas)), 1),
    },
    { chave: 'entraram', titulo: 'Entraram no grupo', valor: (l) => l.entraram, render: (l) => fInt(l.entraram), total: somaCol((l) => l.entraram) },
    {
      chave: 'pctGrupo',
      titulo: 'Cadastro → grupo',
      dica: 'Dos que cadastraram, quantos entraram no grupo. Verde: 85% ou mais. Amarelo: 70% a 85%. Vermelho: abaixo de 70%.',
      valor: (l) => pct(l.entraram, l.cadastros),
      render: (l) => <Taxa v={pct(l.entraram, l.cadastros)} bom={85} medio={70} />,
      total: (ls) => fPct(pct(soma(ls, (l) => l.entraram), soma(ls, (l) => l.cadastros))),
    },
  ];
}

type Props = {
  d: Disparo;
  dia: DisparoDia;
  coorte: CoorteDia[];
  disparos: Disparos;
  conferencia: ConferenciaDia[];
  semDadosNovos: boolean;
  faltandoDisparos: boolean;
};

function Diferenca({ a, b }: { a: number; b: number }) {
  if (!a || !b) return <span className="vazio">—</span>;
  const dif = a - b;
  const p = Math.abs(dif) / Math.max(a, b);
  const nivel = p < 0.05 ? 'bom' : p < 0.15 ? 'medio' : 'ruim';
  return (
    <span className={`taxa ${nivel}`}>
      <span className="taxa-v">
        {dif > 0 ? '+' : ''}
        {fInt(dif)} ({fPct(p * 100, 0)})
      </span>
    </span>
  );
}

export default function DisparoView({ d, dia, coorte, disparos, conferencia, semDadosNovos, faltandoDisparos }: Props) {
  const { min, max } = useMemo(() => faixa(dia.regua_dia, dia.recuperados_dia, coorte, disparos.por_dia), [dia, coorte, disparos]);
  const [de, setDe] = useState(min);
  const [ate, setAte] = useState(max);
  const [publico, setPublico] = useState<FiltroPublico>('todos');

  const listas = useMemo(() => d.listas.filter((l) => passaPublico(pubKey(l.publico), publico)), [d.listas, publico]);

  const funis = useMemo(
    () => disparos.funil_convite.filter((f) => passaPublico(grupoPublico(f.grupo) ?? 'geral', publico)),
    [disparos.funil_convite, publico],
  );

  const serie = useMemo(() => {
    if (!min) return [];
    const reg = noIntervalo(dia.regua_dia, de, ate).filter((r) => passaPublico(r.publico, publico));
    const rec = noIntervalo(dia.recuperados_dia, de, ate).filter((r) => passaPublico(r.publico, publico));
    const api = noIntervalo(coorte, de, ate).filter((r) => r.fonte === 'api_oficial' && passaPublico(r.publico, publico));
    const envios = noIntervalo(disparos.por_dia, de, ate);
    return listarDias(de, ate).map((x) => {
      const r = reg.filter((y) => y.dia === x);
      const cad = somarCoorte(api.filter((y) => y.dia === x));
      const e = envios.filter((y) => y.dia === x);
      const conv = (g: string) => soma(e.filter((y) => y.grupo === g), (y) => y.envios);
      return {
        dia: x,
        rotulo: fDia(x),
        convAluno: passaPublico('aluno', publico) ? conv('convite_aluno') : 0,
        convNaoAluno: passaPublico('geral', publico) ? conv('convite_nao_aluno') : 0,
        mensagens: soma(r, (y) => y.mensagens),
        pessoas: soma(r, (y) => y.pessoas),
        recuperados: soma(rec.filter((y) => y.dia === x), (y) => y.pessoas),
        cadApi: cad.cadastros,
        entApi: cad.entradas,
      };
    });
  }, [dia, coorte, disparos, de, ate, publico, min]);

  const porDisparo = useMemo(
    () => disparos.por_disparo.filter((p) => p.grupo === 'regua' || passaPublico(grupoPublico(p.grupo) ?? 'geral', publico)),
    [disparos.por_disparo, publico],
  );

  const provRows = useMemo(
    () => noIntervalo(disparos.por_provedor ?? [], de, ate).filter((r) => passaPublico(grupoPublico(r.grupo) ?? 'geral', publico)),
    [disparos.por_provedor, de, ate, publico],
  );

  // Totais do período por provedor, e a mesma conta dia a dia (dia = dia do disparo).
  const provedores = useMemo(() => {
    const m = new Map<string, LinhaProvedor>();
    for (const r of provRows) {
      const t = m.get(r.provedor) ?? { provedor: r.provedor, envios: 0, pessoas: 0, confirmaram: 0, cadastros: 0, entraram: 0 };
      t.envios += r.envios;
      t.pessoas += r.pessoas;
      t.confirmaram += r.confirmaram;
      t.cadastros += r.cadastros;
      t.entraram += r.entraram;
      m.set(r.provedor, t);
    }
    return [...m.values()].sort((a, b) => b.envios - a.envios);
  }, [provRows]);

  const provPorDia = useMemo(() => {
    const m = new Map<string, LinhaProvedorDia>();
    for (const r of provRows) {
      const k = `${r.dia}|${r.provedor}`;
      const t = m.get(k) ?? { dia: r.dia, provedor: r.provedor, envios: 0, pessoas: 0, confirmaram: 0, cadastros: 0, entraram: 0 };
      t.envios += r.envios;
      t.pessoas += r.pessoas;
      t.confirmaram += r.confirmaram;
      t.cadastros += r.cadastros;
      t.entraram += r.entraram;
      m.set(k, t);
    }
    return [...m.values()];
  }, [provRows]);

  const provDiasGrafico = useMemo(() => {
    const dias = [...new Set(provPorDia.map((r) => r.dia))].sort();
    const taxa = (dia: string, prov: string) => {
      const r = provPorDia.find((x) => x.dia === dia && x.provedor === prov);
      return r && r.pessoas > 0 ? (r.cadastros / r.pessoas) * 100 : null;
    };
    return dias.map((dia) => ({ dia: fDia(dia), datacrazy: taxa(dia, 'datacrazy'), manychat: taxa(dia, 'manychat') }));
  }, [provPorDia]);

  const regua = d.regua.map((r) => ({ etapa: r.codigo, recuperado: r.pct_recuperado == null ? null : Number(r.pct_recuperado) }));

  const tot = {
    convites: soma(serie, (s) => s.convAluno + s.convNaoAluno),
    mensagens: soma(serie, (s) => s.mensagens),
    pessoas: soma(serie, (s) => s.pessoas),
    recuperados: soma(serie, (s) => s.recuperados),
    cadApi: soma(serie, (s) => s.cadApi),
    entApi: soma(serie, (s) => s.entApi),
    pessoasConvite: soma(funis, (f) => f.pessoas),
    enviosConvite: soma(funis, (f) => f.envios),
    pelaConvite: soma(funis, (f) => f.cadastrou_pelo_convite),
    entrouConvite: soma(funis, (f) => f.entrou_no_grupo),
    cadTotalConvite: soma(funis, (f) => f.cadastrou_total),
  };

  const colunasDia: Coluna<(typeof serie)[number]>[] = [
    { chave: 'dia', titulo: 'Dia', esquerda: true, valor: (s) => s.dia, render: (s) => fDia(s.dia), total: () => 'Total' },
    { chave: 'convAluno', titulo: 'Convites · Alunos', dica: 'Convites enviados por WhatsApp para as listas de alunos', valor: (s) => s.convAluno, render: (s) => fInt(s.convAluno), total: () => fInt(soma(serie, (s) => s.convAluno)) },
    { chave: 'convNaoAluno', titulo: 'Convites · Não alunos', valor: (s) => s.convNaoAluno, render: (s) => fInt(s.convNaoAluno), total: () => fInt(soma(serie, (s) => s.convNaoAluno)) },
    { chave: 'mensagens', titulo: 'Mensagens da régua', dica: 'Mensagens de persistência para quem se cadastrou e ainda não entrou no grupo', valor: (s) => s.mensagens, render: (s) => <strong>{fInt(s.mensagens)}</strong>, total: () => fInt(tot.mensagens) },
    { chave: 'pessoas', titulo: 'Pessoas na régua', dica: 'Quantas pessoas diferentes receberam mensagem da régua no dia', valor: (s) => s.pessoas, render: (s) => fInt(s.pessoas), total: () => fInt(tot.pessoas) },
    { chave: 'recuperados', titulo: 'Entraram depois da mensagem', dica: 'Pessoas que entraram no grupo neste dia depois de receber uma mensagem da régua', valor: (s) => s.recuperados, render: (s) => fInt(s.recuperados), total: () => fInt(tot.recuperados) },
    { chave: 'cadApi', titulo: 'Cadastros pelo convite', dica: 'Cadastros de quem recebeu o convite por WhatsApp, no dia do cadastro', valor: (s) => s.cadApi, render: (s) => fInt(s.cadApi), total: () => fInt(tot.cadApi) },
    { chave: 'entApi', titulo: 'Desses, entraram no grupo', valor: (s) => s.entApi, render: (s) => fInt(s.entApi), total: () => fInt(tot.entApi) },
  ];

  const colunasProv: Coluna<LinhaProvedor>[] = [
    { chave: 'provedor', titulo: 'Provedor', esquerda: true, valor: (l) => ROTULO_PROVEDOR[l.provedor] ?? l.provedor, render: (l) => <strong>{ROTULO_PROVEDOR[l.provedor] ?? l.provedor}</strong>, total: () => 'Total' },
    ...colunasProvedor<LinhaProvedor>(),
  ];

  const colunasProvDia: Coluna<LinhaProvedorDia>[] = [
    { chave: 'dia', titulo: 'Dia do disparo', esquerda: true, valor: (l) => l.dia, render: (l) => fDia(l.dia), total: () => 'Total' },
    { chave: 'provedor', titulo: 'Provedor', esquerda: true, valor: (l) => ROTULO_PROVEDOR[l.provedor] ?? l.provedor, render: (l) => ROTULO_PROVEDOR[l.provedor] ?? l.provedor },
    ...colunasProvedor<LinhaProvedorDia>(),
  ];

  const colunasDisparo: Coluna<PorDisparo>[] = [
    { chave: 'nome', titulo: 'Disparo', esquerda: true, dica: 'Nome do disparo como está na tabela de disparos', valor: (p) => p.nome, render: (p) => p.nome, total: () => 'Total' },
    { chave: 'grupo', titulo: 'Tipo', esquerda: true, valor: (p) => ROTULO_GRUPO[p.grupo] ?? p.grupo, render: (p) => ROTULO_GRUPO[p.grupo] ?? p.grupo },
    { chave: 'envios', titulo: 'Envios', dica: 'Mensagens enviadas. A mesma pessoa pode receber mais de uma vez.', valor: (p) => p.envios, render: (p) => <strong>{fInt(p.envios)}</strong>, total: (ps) => fInt(soma(ps, (p) => p.envios)) },
    { chave: 'pessoas', titulo: 'Pessoas', dica: 'Pessoas diferentes que receberam este disparo', valor: (p) => p.pessoas, render: (p) => fInt(p.pessoas) },
    { chave: 'por', titulo: 'Envios por pessoa', valor: (p) => (p.pessoas > 0 ? p.envios / p.pessoas : null), render: (p) => (p.pessoas > 0 ? (p.envios / p.pessoas).toFixed(1).replace('.', ',') : '—') },
    { chave: 'de', titulo: 'Primeiro dia', valor: (p) => p.primeiro_dia, render: (p) => fDia(p.primeiro_dia) },
    { chave: 'ate', titulo: 'Último dia', valor: (p) => p.ultimo_dia, render: (p) => fDia(p.ultimo_dia) },
  ];

  const colunasListas: Coluna<Lista>[] = [
    { chave: 'lista', titulo: 'Lista', esquerda: true, dica: 'Lista de contatos que recebe o convite', valor: (l) => l.lista, render: (l) => l.lista, total: () => 'Total' },
    { chave: 'publico', titulo: 'Público', esquerda: true, valor: (l) => NOME[l.publico] ?? l.publico, render: (l) => <PillPublico publico={pubKey(l.publico)} /> },
    { chave: 'contatos', titulo: 'Contatos', valor: (l) => l.contatos, render: (l) => fInt(l.contatos), total: (ls) => fInt(soma(ls, (l) => l.contatos)) },
    { chave: 'pendentes', titulo: 'Faltam enviar', dica: 'Ainda na fila do disparo', valor: (l) => l.pendentes, render: (l) => fInt(l.pendentes), total: (ls) => fInt(soma(ls, (l) => l.pendentes)) },
    { chave: 'pulados', titulo: 'Pulados', dica: 'Não receberam: já cadastrados, já no grupo, número inválido ou em outra lista', valor: (l) => l.pulados, render: (l) => fInt(l.pulados), total: (ls) => fInt(soma(ls, (l) => l.pulados)) },
    { chave: 'enviados', titulo: 'Pessoas com convite', dica: 'Cada pessoa conta uma vez, mesmo que tenha recebido mais de um convite.', valor: (l) => l.enviados, render: (l) => <strong>{fInt(l.enviados)}</strong>, total: (ls) => fInt(soma(ls, (l) => l.enviados)) },
    { chave: 'erros', titulo: 'Erros', valor: (l) => l.erros, render: (l) => fInt(l.erros), total: (ls) => fInt(soma(ls, (l) => l.erros)) },
    { chave: 'confirmaram', titulo: 'Confirmaram', dica: 'Responderam confirmando a inscrição', valor: (l) => l.confirmaram, render: (l) => fInt(l.confirmaram), total: (ls) => fInt(soma(ls, (l) => l.confirmaram)) },
    {
      chave: 'pct',
      titulo: '% confirmou',
      dica: 'Confirmaram ÷ pessoas com convite',
      valor: (l) => pct(l.confirmaram, l.enviados),
      render: (l) => fPct(pct(l.confirmaram, l.enviados)),
      total: (ls) => fPct(pct(soma(ls, (l) => l.confirmaram), soma(ls, (l) => l.enviados))),
    },
    { chave: 'grupo', titulo: 'Entraram no grupo', valor: (l) => l.entraram_grupo, render: (l) => fInt(l.entraram_grupo), total: (ls) => fInt(soma(ls, (l) => l.entraram_grupo)) },
    {
      chave: 'pctgrupo',
      titulo: 'Confirmou → grupo',
      dica: 'Dos que confirmaram, quantos entraram no grupo. Verde: 85% ou mais. Amarelo: 70% a 85%. Vermelho: abaixo de 70%.',
      valor: (l) => pct(l.entraram_grupo, l.confirmaram),
      render: (l) => <Taxa v={pct(l.entraram_grupo, l.confirmaram)} bom={85} medio={70} />,
      total: (ls) => fPct(pct(soma(ls, (l) => l.entraram_grupo), soma(ls, (l) => l.confirmaram))),
    },
  ];

  const colunasRegua: Coluna<Etapa>[] = [
    { chave: 'codigo', titulo: 'Etapa', esquerda: true, dica: 'M1 e M2: primeiras mensagens. D1 a D6: dias seguintes. VOLTA: quem saiu do grupo.', valor: (r) => r.codigo, render: (r) => r.codigo },
    { chave: 'enviados', titulo: 'Enviadas', valor: (r) => r.enviados, render: (r) => fInt(r.enviados) },
    { chave: 'erros', titulo: 'Erros', valor: (r) => r.erros, render: (r) => fInt(r.erros) },
    { chave: 'depois', titulo: 'Entraram depois', dica: 'Pessoas que entraram no grupo depois de receber esta mensagem', valor: (r) => r.entraram_depois, render: (r) => fInt(r.entraram_depois) },
    {
      chave: 'pct',
      titulo: '% recuperado',
      dica: 'Entraram depois ÷ enviadas',
      valor: (r) => (r.pct_recuperado == null ? null : Number(r.pct_recuperado)),
      render: (r) => (r.pct_recuperado == null ? '—' : fPct(Number(r.pct_recuperado))),
    },
  ];

  const colunasConf: Coluna<ConferenciaDia>[] = [
    { chave: 'dia', titulo: 'Dia', esquerda: true, valor: (c) => c.dia, render: (c) => fDia(c.dia) },
    { chave: 'cd', titulo: 'Convites · tabela de disparos', valor: (c) => c.convites_disparos, render: (c) => fInt(c.convites_disparos) },
    { chave: 'cl', titulo: 'Convites · fluxo de envio', dica: 'O fluxo de envio só passou a registrar cada convite em 25/10', valor: (c) => c.convites_log, render: (c) => (c.convites_log ? fInt(c.convites_log) : '—') },
    { chave: 'cf', titulo: 'Diferença nos convites', dica: 'Fluxo de envio menos tabela de disparos', valor: (c) => (c.convites_log ? c.convites_log - c.convites_disparos : null), render: (c) => <Diferenca a={c.convites_log} b={c.convites_disparos} /> },
    { chave: 'rd', titulo: 'Régua · tabela de disparos', valor: (c) => c.regua_disparos, render: (c) => fInt(c.regua_disparos) },
    { chave: 're', titulo: 'Régua · envios feitos', dica: 'Mensagens que a régua marcou como enviadas', valor: (c) => c.regua_envios, render: (c) => fInt(c.regua_envios) },
    { chave: 'rf', titulo: 'Diferença na régua', dica: 'Envios feitos menos tabela de disparos', valor: (c) => c.regua_envios - c.regua_disparos, render: (c) => <Diferenca a={c.regua_envios} b={c.regua_disparos} /> },
  ];

  if (!min) return <p className="nota">Ainda não há dados.</p>;

  const faltaRegua = soma(conferencia.filter((c) => c.dia >= '2026-10-22'), (c) => c.regua_envios - c.regua_disparos);
  const totReguaDesde22 = soma(conferencia.filter((c) => c.dia >= '2026-10-22'), (c) => c.regua_envios);
  const ultimaConf = [...conferencia].reverse().find((c) => c.convites_log > 0);

  return (
    <>
      {(semDadosNovos || faltandoDisparos) && (
        <div className="alerta atencao" role="status" style={{ marginBottom: 16 }}>
          <Info />
          <div>
            <strong>Falta atualizar o banco</strong>
            <p>
              {faltandoDisparos
                ? 'A migration 20261026000100_dash_pf_disparos.sql ainda não foi aplicada. Sem ela, os envios por dia e a conferência aparecem vazios.'
                : 'A migration 20261026000000_dash_pf_coorte_disparo.sql ainda não foi aplicada.'}
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
      <p className="nota" style={{ marginTop: 8 }}>
        O período vale para os cartões, os gráficos e a tabela por dia. As listas, a régua por etapa e o funil do convite
        mostram o lançamento inteiro.
      </p>

      <section className="secao">
        <p className="rotulo">Resumo</p>
        <div className="grade k4">
          <Kpi
            icone={Send}
            rotulo="Convites enviados"
            valor={fInt(tot.convites)}
            detalhe={`${fInt(tot.pessoasConvite)} pessoas receberam · ${tot.pessoasConvite > 0 ? (tot.enviosConvite / tot.pessoasConvite).toFixed(1).replace('.', ',') : '—'} convites por pessoa`}
          />
          <Kpi
            icone={MailCheck}
            rotulo="Cadastraram pelo convite"
            valor={fInt(tot.pelaConvite)}
            detalhe={`${fPct(pct(tot.pelaConvite, tot.pessoasConvite))} de quem recebeu · ${fInt(tot.entrouConvite)} no grupo`}
          />
          <Kpi icone={MessageSquare} rotulo="Mensagens da régua" valor={fInt(tot.mensagens)} detalhe={`${fInt(tot.pessoas)} pessoas alcançadas no período`} />
          <Kpi icone={Repeat} rotulo="Recuperados pela régua" valor={fInt(tot.recuperados)} detalhe="entraram no grupo depois de uma mensagem" />
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">Por dia</p>
        <div className="card">
          <h2>Envios por dia</h2>
          <Chart
            titulo="Convites e mensagens da régua enviados por dia"
            tipo="empilhada"
            dados={serie.map((s) => ({ dia: s.rotulo, convAluno: s.convAluno, convNaoAluno: s.convNaoAluno, mensagens: s.mensagens }))}
            x="dia"
            altura={260}
            series={[
              { key: 'convAluno', nome: 'Convites · Alunos', cor: 'var(--series-2)' },
              { key: 'convNaoAluno', nome: 'Convites · Não alunos', cor: 'var(--series-1)' },
              { key: 'mensagens', nome: 'Régua de mensagens', cor: 'var(--series-3)' },
            ]}
          />
        </div>
        <div className="grade c2" style={{ marginTop: 14 }}>
          <div className="card">
            <h2>Quem entrou no grupo depois da mensagem</h2>
            <Chart
              titulo="Pessoas que entraram no grupo depois de receber mensagem da régua, por dia"
              tipo="barra"
              dados={serie.map((s) => ({ dia: s.rotulo, recuperados: s.recuperados }))}
              x="dia"
              series={[{ key: 'recuperados', nome: 'Entraram depois', cor: 'var(--accent)' }]}
            />
          </div>
          <div className="card">
            <h2>Cadastros pelo convite</h2>
            <Chart
              titulo="Cadastros de quem recebeu o convite e quantos entraram no grupo, por dia"
              tipo="linha"
              dados={serie.map((s) => ({ dia: s.rotulo, cadApi: s.cadApi, entApi: s.entApi }))}
              x="dia"
              series={[
                { key: 'cadApi', nome: 'Cadastros', cor: 'var(--series-1)' },
                { key: 'entApi', nome: 'Entraram no grupo', cor: 'var(--series-3)' },
              ]}
            />
          </div>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <DataTable linhas={serie} colunas={colunasDia} id={(s) => s.dia} ordemInicial={{ chave: 'dia', dir: 'desc' }} />
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">Do convite ao grupo</p>
        <div className="grade c2">
          {funis.map((f) => {
            const aluno = f.grupo === 'convite_aluno';
            const etapas = [
              { n: 'Receberam o convite', v: f.pessoas, de: null as number | null },
              { n: 'Se cadastraram (qualquer fonte)', v: f.cadastrou_total, de: f.pessoas },
              { n: 'Cadastraram pelo convite', v: f.cadastrou_pelo_convite, de: f.pessoas },
              { n: 'Entraram no grupo (pelo convite)', v: f.entrou_no_grupo, de: f.cadastrou_pelo_convite },
            ];
            return (
              <div className="card" key={f.grupo}>
                <h2>
                  {aluno ? 'Alunos' : 'Não alunos'} <PillPublico publico={aluno ? 'aluno' : 'geral'} />
                </h2>
                <p className="nota" style={{ marginTop: 0, marginBottom: 16 }}>
                  {fInt(f.envios)} convites enviados · {(f.envios / Math.max(1, f.pessoas)).toFixed(1).replace('.', ',')} por pessoa
                </p>
                {etapas.map((l) => (
                  <div className="funil-linha" key={l.n}>
                    <div className="topo-l">
                      <span>{l.n}</span>
                      <b>
                        {fInt(l.v)}
                        {l.de != null && ` · ${fPct(pct(l.v, l.de), l.v / Math.max(1, l.de) < 0.1 ? 1 : 0)}`}
                      </b>
                    </div>
                    <div className="barra">
                      <span style={{ width: `${l.de == null ? 100 : Math.max(2, Math.min(100, pct(l.v, l.de) ?? 0))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <p className="nota">
          Cada pessoa é ligada pelo telefone. “Pelo convite” conta quem se cadastrou com origem WhatsApp (disparo_api). Quem se
          cadastrou por outro caminho depois do convite (anúncio, link do grupo) aparece em “qualquer fonte”.
        </p>
      </section>

      <section className="secao">
        <p className="rotulo">Por provedor de disparo</p>
        {provedores.length === 0 ? (
          <p className="nota">Nenhum convite enviado no período e público escolhidos.</p>
        ) : (
          <>
            <div className="card">
              <h2>Convite → confirmação → cadastro → grupo</h2>
              <DataTable linhas={provedores} colunas={colunasProv} id={(l) => l.provedor} ordemInicial={{ chave: 'envios', dir: 'desc' }} />
            </div>
            <div className="grade c2" style={{ marginTop: 14 }}>
              <div className="card">
                <h2>% que cadastrou, por dia do disparo</h2>
                <Chart
                  titulo="Percentual de pessoas alcançadas que se cadastraram, por provedor e por dia do disparo"
                  tipo="barra"
                  dados={provDiasGrafico}
                  x="dia"
                  formato="pct"
                  series={[
                    { key: 'datacrazy', nome: 'DataCrazy', cor: 'var(--series-1)' },
                    { key: 'manychat', nome: 'ManyChat', cor: 'var(--series-2)' },
                  ]}
                />
              </div>
              <div className="card">
                <h2>Dia a dia</h2>
                <DataTable linhas={provPorDia} colunas={colunasProvDia} id={(l) => `${l.dia}|${l.provedor}`} ordemInicial={{ chave: 'dia', dir: 'desc' }} />
              </div>
            </div>
          </>
        )}
        <p className="nota">
          DataCrazy é a conexão 3070 (o DataCrazy tem outras conexões, mas só esta enviou convites até agora) e ManyChat é a
          conexão do ManyChat. O dia é o <b>dia do disparo</b>, não o do cadastro.
          Estimativa: cada confirmação e cada cadastro é ligado ao último convite recebido nas 72 horas anteriores, então
          quem recebeu por dois provedores conta só no último. Disparos recentes ainda estão amadurecendo: o percentual de
          hoje tende a subir nos próximos dias. Cada onda vai para um público diferente, e quem já ignorou convites antes
          responde menos: compare ondas parecidas, não a primeira onda com um reenvio.
        </p>
      </section>

      <section className="secao">
        <p className="rotulo">Cada disparo</p>
        <div className="card">
          <DataTable
            linhas={porDisparo}
            colunas={colunasDisparo}
            id={(p) => p.codigo}
            ordemInicial={{ chave: 'envios', dir: 'desc' }}
            busca="Buscar disparo"
            filtros={[
              {
                rotulo: 'Tipo',
                opcoes: [
                  { valor: 'convite', rotulo: 'Convites' },
                  { valor: 'regua', rotulo: 'Régua de mensagens' },
                ],
                testa: (p, v) => (v === 'regua' ? p.grupo === 'regua' : p.grupo !== 'regua'),
              },
            ]}
          />
        </div>
        <p className="nota">Dados da tabela de disparos. Envios são mensagens; a mesma pessoa pode receber o mesmo disparo mais de uma vez.</p>
      </section>

      <section className="secao">
        <p className="rotulo">Convite por lista</p>
        <div className="card">
          <DataTable linhas={listas} colunas={colunasListas} id={(l) => l.lista} ordemInicial={{ chave: 'enviados', dir: 'desc' }} busca="Buscar lista" />
        </div>
        <p className="nota">
          “Pessoas com convite” conta cada pessoa uma vez. O percentual de confirmação é calculado sobre elas.
        </p>
      </section>

      <section className="secao">
        <p className="rotulo">Régua de persistência, por etapa</p>
        <div className="grade c2">
          <div className="card">
            <h2>Quanto cada mensagem recupera</h2>
            <Chart
              titulo="Percentual recuperado por etapa da régua"
              tipo="barra"
              dados={regua}
              x="etapa"
              formato="pct"
              series={[{ key: 'recuperado', nome: 'Entraram depois', cor: 'var(--accent)' }]}
            />
          </div>
          <div className="card">
            <h2>Por etapa</h2>
            <DataTable linhas={d.regua} colunas={colunasRegua} id={(r) => r.codigo} ordemInicial={{ chave: 'pct', dir: 'desc' }} />
          </div>
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">Conferência dos dados</p>
        <div className="card">
          <p className="nota" style={{ marginTop: 0, marginBottom: 12 }}>
            Compara a tabela de disparos com os registros do próprio fluxo de envio. Verde: diferença abaixo de 5%.
            Amarelo: até 15%. Vermelho: acima disso.
          </p>
          <DataTable linhas={conferencia} colunas={colunasConf} id={(c) => c.dia} ordemInicial={{ chave: 'dia', dir: 'desc' }} />
          {ultimaConf && (
            <p className="leitura">
              Em {fDia(ultimaConf.dia)}, o fluxo enviou {fInt(ultimaConf.convites_log)} convites e a tabela de disparos registrou{' '}
              {fInt(ultimaConf.convites_disparos)} ({fPct(pct(ultimaConf.convites_log - ultimaConf.convites_disparos, ultimaConf.convites_log), 1)} a menos).
              {totReguaDesde22 > 0 && (
                <>
                  {' '}
                  Desde 22/10, {fPct(pct(faltaRegua, totReguaDesde22), 0)} das mensagens da régua não aparecem na tabela de disparos.
                </>
              )}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
