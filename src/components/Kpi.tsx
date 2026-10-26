import type { LucideIcon } from 'lucide-react';

export type Delta = { texto: string; tom: 'bom' | 'ruim' | 'neutro' };

type Props = {
  rotulo: string;
  valor: string;
  detalhe?: string;
  icone?: LucideIcon;
  destaque?: boolean;
  /** Variação em relação ao período anterior de mesmo tamanho. */
  delta?: Delta | null;
};

export default function Kpi({ rotulo, valor, detalhe, icone: Icone, destaque, delta }: Props) {
  return (
    <div className={`card kpi${destaque ? ' destaque' : ''}`}>
      <div className="topo-k">
        <div className="rot">{rotulo}</div>
        {Icone && (
          <span className="ico" aria-hidden="true">
            <Icone />
          </span>
        )}
      </div>
      <div className="val">{valor}</div>
      {delta && <div className={`delta ${delta.tom}`}>{delta.texto}</div>}
      {detalhe && <div className="det">{detalhe}</div>}
    </div>
  );
}
