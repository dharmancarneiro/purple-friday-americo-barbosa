import { CircleCheck, Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { Alerta } from '@/lib/insights';

const ICONE = { bom: CircleCheck, atencao: TriangleAlert, ruim: OctagonAlert, info: Info } as const;

export default function Alertas({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) return null;
  return (
    <div className="alertas" role="list">
      {alertas.map((a, i) => {
        const Icone = ICONE[a.tom];
        return (
          <div key={i} className={`alerta ${a.tom}`} role="listitem">
            <Icone size={20} aria-hidden="true" />
            <div>
              <strong>{a.titulo}</strong>
              <p>{a.texto}</p>
              {a.acao && <p className="acao">{a.acao}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
