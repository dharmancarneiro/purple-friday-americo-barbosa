'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type Serie = { key: string; nome: string; cor: string };
type Formato = 'int' | 'brl' | 'pct';

type Props = {
  tipo: 'linha' | 'barra' | 'empilhada';
  dados: Record<string, string | number | null>[];
  x: string;
  series: Serie[];
  formato?: Formato;
  altura?: number;
  titulo: string;
};

const nf = new Intl.NumberFormat('pt-BR');
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function fmt(v: unknown, f: Formato, curto = false) {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  if (f === 'brl') return (curto ? brl0 : brl).format(v);
  if (f === 'pct') return `${v.toFixed(1).replace('.', ',')}%`;
  return nf.format(Math.round(v));
}

type TipProps = {
  active?: boolean;
  label?: string;
  payload?: { dataKey?: string | number; value?: number | null; color?: string }[];
};

export default function Chart({ tipo, dados, x, series, formato = 'int', altura = 240, titulo }: Props) {
  const eixo = { fontSize: 12, fill: 'var(--muted)' };

  const Tip = ({ active, label, payload }: TipProps) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="tip">
        <b>{label}</b>
        {payload.map((p) => {
          const s = series.find((s) => s.key === p.dataKey);
          return (
            <div key={String(p.dataKey)}>
              <span>
                <i style={{ background: s?.cor }} />
                {s?.nome}
              </span>
              <strong>{fmt(p.value, formato)}</strong>
            </div>
          );
        })}
      </div>
    );
  };

  const comum = {
    data: dados,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  };
  const eixos = (
    <>
      <CartesianGrid stroke="var(--grid)" vertical={false} />
      <XAxis dataKey={x} tick={eixo} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} interval="preserveStartEnd" />
      <YAxis
        tick={eixo}
        tickLine={false}
        axisLine={false}
        width={formato === 'brl' ? 64 : 48}
        tickFormatter={(v) => fmt(v, formato, true)}
      />
      <Tooltip content={<Tip />} cursor={{ stroke: 'var(--axis)' }} />
    </>
  );

  return (
    <figure style={{ margin: 0 }} aria-label={titulo}>
      {series.length > 1 && (
        <div className="legenda">
          {series.map((s) => (
            <span key={s.key}>
              <i style={{ background: s.cor }} />
              {s.nome}
            </span>
          ))}
        </div>
      )}
      <div style={{ width: '100%', height: altura, marginTop: 6 }}>
        <ResponsiveContainer>
          {tipo === 'linha' ? (
            <LineChart {...comum}>
              {eixos}
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.cor}
                  strokeWidth={2}
                  dot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2, fill: s.cor }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart {...comum}>
              {eixos}
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  fill={s.cor}
                  stackId={tipo === 'empilhada' ? 'a' : undefined}
                  stroke="var(--surface)"
                  strokeWidth={tipo === 'empilhada' ? 2 : 0}
                  radius={tipo === 'empilhada' ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
