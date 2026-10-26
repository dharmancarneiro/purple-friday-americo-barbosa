'use client';

import { Users } from 'lucide-react';
import { ROTULO_PUBLICO, type FiltroPublico } from '@/lib/coorte';

const OPCOES: FiltroPublico[] = ['todos', 'aluno', 'geral'];

export default function PublicoTabs({
  valor,
  onChange,
}: {
  valor: FiltroPublico;
  onChange: (p: FiltroPublico) => void;
}) {
  return (
    <div className="filtro">
      <span className="filtro-rotulo">
        <Users size={14} aria-hidden="true" /> Público
      </span>
      <div className="segmento grande" role="tablist" aria-label="Público">
        {OPCOES.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={valor === p}
            className={valor === p ? 'on' : undefined}
            onClick={() => onChange(p)}
          >
            {ROTULO_PUBLICO[p]}
          </button>
        ))}
      </div>
    </div>
  );
}
