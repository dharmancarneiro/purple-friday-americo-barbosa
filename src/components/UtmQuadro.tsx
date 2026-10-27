'use client';

import { Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import DataTable, { type Coluna } from '@/components/DataTable';
import { Taxa } from '@/components/Indicadores';
import { noIntervalo, passaPublico, type FiltroPublico } from '@/lib/coorte';
import type { UtmDia } from '@/lib/data';
import { fInt, fPct, pct } from '@/lib/format';

const CAMPOS = ['origem', 'midia', 'campanha', 'conteudo', 'termo'] as const;
type Campo = (typeof CAMPOS)[number];
type Modo = Campo | 'completa';

const ROTULO_CAMPO: Record<Campo, string> = { origem: 'Origem', midia: 'Mídia', campanha: 'Campanha', conteudo: 'Conteúdo', termo: 'Termo' };
const DICA_CAMPO: Record<Campo, string> = {
  origem: 'utm_source: de que canal veio (meta, whatsapp, instagram...)',
  midia: 'utm_medium: tipo de tráfego (pago, disparo_api, grupo, bio...)',
  campanha: 'utm_campaign: a campanha do anúncio ou da ação',
  conteudo: 'utm_content: o anúncio, ou a lista que recebeu o convite',
  termo: 'utm_term: o conjunto de anúncios ou um detalhe da ação',
};
const MODOS: { chave: Modo; rotulo: string }[] = [...CAMPOS.map((c) => ({ chave: c, rotulo: ROTULO_CAMPO[c] })), { chave: 'completa', rotulo: 'Tudo junto' }];

type Grupo = { chave: string; partes: string[]; cadastros: number; entradas: number };

/** Anúncios chegam como "NOME|id". Para ler rápido mostramos só o nome; o valor inteiro fica no title. */
const nome = (v: string) => v.split('|')[0];
const naoPreenchida = (v: string) => v.includes('{{');

export default function UtmQuadro({ utms, publico, de, ate }: { utms: UtmDia[]; publico: FiltroPublico; de: string; ate: string }) {
  const [modo, setModo] = useState<Modo>('campanha');

  const linhas = useMemo(() => noIntervalo(utms, de, ate).filter((r) => passaPublico(r.publico, publico)), [utms, de, ate, publico]);
  const total = useMemo(() => ({ cadastros: linhas.reduce((s, r) => s + r.cadastros, 0), entradas: linhas.reduce((s, r) => s + r.entradas, 0) }), [linhas]);

  const campos: Campo[] = modo === 'completa' ? [...CAMPOS] : [modo];

  const grupos = useMemo(() => {
    const m = new Map<string, Grupo>();
    for (const r of linhas) {
      const partes = campos.map((c) => r[c]);
      const chave = partes.join('\u0001');
      const g = m.get(chave) ?? { chave, partes, cadastros: 0, entradas: 0 };
      g.cadastros += r.cadastros;
      g.entradas += r.entradas;
      m.set(chave, g);
    }
    return [...m.values()].sort((a, b) => b.cadastros - a.cadastros);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, modo]);

  const semPreencher = useMemo(() => linhas.filter((r) => CAMPOS.some((c) => naoPreenchida(r[c]))).reduce((s, r) => s + r.cadastros, 0), [linhas]);

  const colunas: Coluna<Grupo>[] = [
    ...campos.map((c, i): Coluna<Grupo> => ({
      chave: c,
      titulo: ROTULO_CAMPO[c],
      esquerda: true,
      dica: DICA_CAMPO[c],
      valor: (g) => g.partes[i],
      render: (g) => <span title={g.partes[i]}>{nome(g.partes[i])}</span>,
      total: i === 0 ? () => 'Total' : undefined,
    })),
    { chave: 'cadastros', titulo: 'Cadastros', valor: (g) => g.cadastros, render: (g) => <strong>{fInt(g.cadastros)}</strong>, total: () => fInt(total.cadastros) },
    { chave: 'parte', titulo: '% do total', valor: (g) => pct(g.cadastros, total.cadastros), render: (g) => fPct(pct(g.cadastros, total.cadastros)), total: () => '100%' },
    { chave: 'entradas', titulo: 'Entraram no grupo', valor: (g) => g.entradas, render: (g) => fInt(g.entradas), total: () => fInt(total.entradas) },
    {
      chave: 'taxa',
      titulo: 'Cadastro → grupo',
      dica: 'De cada 100 cadastros, quantos entraram no grupo. Verde: 85% ou mais. Amarelo: 70% a 85%. Vermelho: abaixo de 70%.',
      valor: (g) => pct(g.entradas, g.cadastros),
      render: (g) => <Taxa v={pct(g.entradas, g.cadastros)} bom={85} medio={70} />,
      total: () => <Taxa v={pct(total.entradas, total.cadastros)} bom={85} medio={70} />,
    },
  ];

  const topo = grupos.slice(0, 8);
  const maior = Math.max(1, ...topo.map((g) => g.cadastros));

  return (
    <>
      <div className="segmento" role="tablist" aria-label="Agrupar por" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {MODOS.map((m) => (
          <button key={m.chave} type="button" role="tab" aria-selected={modo === m.chave} className={modo === m.chave ? 'on' : undefined} onClick={() => setModo(m.chave)}>
            {m.rotulo}
          </button>
        ))}
      </div>

      {semPreencher > 0 && (
        <div className="alerta atencao" role="status" style={{ marginBottom: 14 }}>
          <Info />
          <div>
            <strong>
              {semPreencher === 1 ? '1 cadastro chegou' : `${fInt(semPreencher)} cadastros chegaram`} com a UTM sem preencher
            </strong>
            <p>O valor aparece como {'{{campaign.name}}'} ou parecido. Confira o link do anúncio: o Meta não trocou o código pelo nome.</p>
          </div>
        </div>
      )}

      {grupos.length === 0 ? (
        <p className="nota">Nenhum cadastro no período e público escolhidos.</p>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <h2>Quem mais trouxe cadastros</h2>
            {topo.map((g) => (
              <div className="funil-linha" key={g.chave}>
                <div className="topo-l">
                  <span title={g.partes.join(' · ')}>{g.partes.map(nome).join(' · ')}</span>
                  <b>
                    {fInt(g.cadastros)} · {fPct(pct(g.cadastros, total.cadastros), 0)}
                  </b>
                </div>
                <div className="barra">
                  <span style={{ width: `${Math.max(2, (g.cadastros / maior) * 100)}%` }} />
                </div>
              </div>
            ))}
            {grupos.length > topo.length && <p className="nota">Mostrando os {topo.length} maiores de {grupos.length}. A tabela abaixo tem todos.</p>}
          </div>
          <div className="card">
            <DataTable linhas={grupos} colunas={colunas} id={(g) => g.chave} ordemInicial={{ chave: 'cadastros', dir: 'desc' }} busca="Buscar UTM" />
          </div>
        </>
      )}
    </>
  );
}
