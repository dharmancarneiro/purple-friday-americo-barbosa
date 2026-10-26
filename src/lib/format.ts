const num = new Intl.NumberFormat('pt-BR');
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const fInt = (v: number | null | undefined) => (v == null ? '—' : num.format(Math.round(v)));
export const fBrl = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : brl.format(v));
export const fBrl0 = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : brl0.format(v));
export const fPct = (v: number | null | undefined, casas = 1) =>
  v == null || !isFinite(v) ? '—' : `${v.toFixed(casas).replace('.', ',')}%`;

/** Divisão que devolve null quando não dá para calcular (denominador 0). */
export const div = (a: number, b: number) => (b > 0 ? a / b : null);
export const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);

/** "2026-10-15" -> "15/10" */
export const fDia = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

export const fDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
