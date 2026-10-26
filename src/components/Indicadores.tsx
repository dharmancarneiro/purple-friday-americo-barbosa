import { fBrl, fPct } from '@/lib/format';

/**
 * Taxa com barrinha e cor: verde, amarelo ou vermelho conforme os limites.
 * `bom` e `medio` são percentuais (ex.: 85 e 70 para "entrou no grupo").
 */
export function Taxa({ v, bom, medio, casas = 1 }: { v: number | null; bom: number; medio: number; casas?: number }) {
  if (v == null) return <span className="vazio">—</span>;
  const nivel = v >= bom ? 'bom' : v >= medio ? 'medio' : 'ruim';
  return (
    <span className={`taxa ${nivel}`}>
      <span className="taxa-v">{fPct(v, casas)}</span>
      <span className="taxa-barra" aria-hidden="true">
        <i style={{ width: `${Math.max(3, Math.min(100, v))}%` }} />
      </span>
    </span>
  );
}

/** Custo colorido em relação à média da seleção: bem abaixo = verde, bem acima = vermelho. */
export function Custo({ v, media }: { v: number | null; media: number | null }) {
  if (v == null) return <span className="vazio">—</span>;
  const nivel = media == null ? '' : v <= media * 0.8 ? 'bom' : v >= media * 1.2 ? 'ruim' : '';
  return <span className={`custo ${nivel}`}>{fBrl(v)}</span>;
}

export function PillPublico({ publico }: { publico: 'geral' | 'aluno' | string }) {
  const aluno = publico === 'aluno';
  return <span className={`pill ${aluno ? 'aluno' : 'geral'}`}>{aluno ? 'Alunos' : 'Geral'}</span>;
}
