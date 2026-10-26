'use client';

import { CalendarRange } from 'lucide-react';
import { presets } from '@/lib/trafego';

type Props = {
  min: string;
  max: string;
  de: string;
  ate: string;
  onChange: (de: string, ate: string) => void;
};

export default function FiltroPeriodo({ min, max, de, ate, onChange }: Props) {
  const atalhos = presets(min, max);
  const ativo = atalhos.find((p) => p.de === de && p.ate === ate)?.chave;

  return (
    <div className="filtro">
      <span className="filtro-rotulo">
        <CalendarRange size={14} aria-hidden="true" /> Período
      </span>
      <div className="segmento" role="group" aria-label="Atalhos de período">
        {atalhos.map((p) => (
          <button
            key={p.chave}
            type="button"
            className={ativo === p.chave ? 'on' : undefined}
            aria-pressed={ativo === p.chave}
            onClick={() => onChange(p.de, p.ate)}
          >
            {p.rotulo}
          </button>
        ))}
      </div>
      <div className="datas">
        <input
          type="date"
          aria-label="Data inicial"
          min={min}
          max={ate}
          value={de}
          onChange={(e) => e.target.value && onChange(e.target.value, ate)}
        />
        <span aria-hidden="true">até</span>
        <input
          type="date"
          aria-label="Data final"
          min={de}
          max={max}
          value={ate}
          onChange={(e) => e.target.value && onChange(de, e.target.value)}
        />
      </div>
    </div>
  );
}
