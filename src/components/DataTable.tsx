'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

export type Coluna<T> = {
  chave: string;
  titulo: string;
  /** Explicação em linguagem simples, mostrada ao passar o mouse no título. */
  dica?: string;
  /** Valor usado para ordenar e para a busca. */
  valor: (l: T) => number | string | null | undefined;
  render?: (l: T) => ReactNode;
  /** Linha de total no rodapé; recebe as linhas que passaram pelos filtros. */
  total?: (linhas: T[]) => ReactNode;
  esquerda?: boolean;
  semBusca?: boolean;
};

export type Filtro<T> = {
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
  testa: (l: T, valor: string) => boolean;
};

type Props<T> = {
  linhas: T[];
  colunas: Coluna<T>[];
  id: (l: T) => string;
  ordemInicial?: { chave: string; dir: 'asc' | 'desc' };
  busca?: string;
  filtros?: Filtro<T>[];
  vazio?: string;
  rotuloTotal?: string;
};

type Ordem = { chave: string; dir: 'asc' | 'desc' };

function comparar(a: number | string | null | undefined, b: number | string | null | undefined, dir: 'asc' | 'desc') {
  // vazios sempre no fim, qualquer que seja a direção
  const va = a === undefined || a === null || a === '' ? null : a;
  const vb = b === undefined || b === null || b === '' ? null : b;
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  const r =
    typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
  return dir === 'asc' ? r : -r;
}

export default function DataTable<T>({
  linhas,
  colunas,
  id,
  ordemInicial,
  busca,
  filtros = [],
  vazio = 'Nada encontrado com esses filtros.',
  rotuloTotal = 'Total',
}: Props<T>) {
  const [ordem, setOrdem] = useState<Ordem | undefined>(ordemInicial);
  const [texto, setTexto] = useState('');
  const [escolhas, setEscolhas] = useState<Record<number, string>>({});

  const visiveis = useMemo(() => {
    const q = texto.trim().toLowerCase();
    let r = linhas.filter((l) => {
      for (let i = 0; i < filtros.length; i++) {
        const v = escolhas[i];
        if (v && !filtros[i].testa(l, v)) return false;
      }
      if (!q) return true;
      return colunas.some((c) => !c.semBusca && String(c.valor(l) ?? '').toLowerCase().includes(q));
    });
    if (ordem) {
      const col = colunas.find((c) => c.chave === ordem.chave);
      if (col) r = [...r].sort((x, y) => comparar(col.valor(x), col.valor(y), ordem.dir));
    }
    return r;
  }, [linhas, colunas, filtros, escolhas, texto, ordem]);

  const alternar = (chave: string) =>
    setOrdem((o) => (o?.chave === chave ? { chave, dir: o.dir === 'desc' ? 'asc' : 'desc' } : { chave, dir: 'desc' }));

  // CSV em formato que o Excel brasileiro abre direto: separador ";" e vírgula decimal.
  const exportar = () => {
    const aspas = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const celula = (v: number | string | null | undefined) =>
      v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : aspas(v);
    const linhasCsv = [colunas.map((c) => aspas(c.titulo)).join(';'), ...visiveis.map((l) => colunas.map((c) => celula(c.valor(l))).join(';'))];
    const blob = new Blob([String.fromCharCode(0xfeff) + linhasCsv.join(String.fromCharCode(13, 10))], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purple-friday-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const temTotal = colunas.some((c) => c.total);
  const ocupado = texto.trim() !== '' || Object.values(escolhas).some(Boolean);

  return (
    <div className="dt">
      {(busca || filtros.length > 0 || linhas.length >= 8) && (
        <div className="dt-barra">
          {busca && (
            <label className="dt-busca">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                placeholder={busca}
                aria-label={busca}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </label>
          )}
          {filtros.map((f, i) => (
            <label className="dt-filtro" key={f.rotulo}>
              <span>{f.rotulo}</span>
              <select value={escolhas[i] ?? ''} onChange={(e) => setEscolhas((s) => ({ ...s, [i]: e.target.value }))}>
                <option value="">Todos</option>
                {f.opcoes.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button type="button" className="dt-exportar" onClick={exportar} title="Baixar a tabela como planilha (CSV)">
            <Download size={13} aria-hidden="true" /> Exportar
          </button>
          <span className="dt-contagem" aria-live="polite">
            {visiveis.length} de {linhas.length}
            {ocupado && (
              <button
                type="button"
                className="dt-limpar"
                onClick={() => {
                  setTexto('');
                  setEscolhas({});
                }}
              >
                limpar
              </button>
            )}
          </span>
        </div>
      )}

      <div className="tabela">
        <table>
          <thead>
            <tr>
              {colunas.map((c) => {
                const ativa = ordem?.chave === c.chave;
                return (
                  <th
                    key={c.chave}
                    title={c.dica}
                    className={c.esquerda ? 'esq' : undefined}
                    aria-sort={ativa ? (ordem!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" className="dt-th" onClick={() => alternar(c.chave)}>
                      {c.titulo}
                      {ativa ? (
                        ordem!.dir === 'asc' ? (
                          <ArrowUp size={13} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={13} aria-hidden="true" />
                        )
                      ) : (
                        <ChevronsUpDown size={13} aria-hidden="true" className="dt-neutro" />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={colunas.length} className="dt-vazio">
                  {vazio}
                </td>
              </tr>
            ) : (
              visiveis.map((l) => (
                <tr key={id(l)}>
                  {colunas.map((c) => (
                    <td key={c.chave} className={c.esquerda ? 'esq' : undefined}>
                      {c.render ? c.render(l) : (c.valor(l) ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {temTotal && visiveis.length > 0 && (
            <tfoot>
              <tr>
                {colunas.map((c, i) => (
                  <td key={c.chave} className={c.esquerda ? 'esq' : undefined}>
                    {c.total ? c.total(visiveis) : i === 0 ? rotuloTotal : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
