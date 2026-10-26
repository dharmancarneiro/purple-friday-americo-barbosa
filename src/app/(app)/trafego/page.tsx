import TrafegoView from '@/components/TrafegoView';
import { getDash } from '@/lib/data';

export const metadata = { title: 'Tráfego · Purple Friday' };

export default async function Trafego() {
  const { anuncios_info, anuncios_dia } = await getDash();

  return (
    <>
      <div className="pagina-topo">
        <div>
          <h1>Tráfego</h1>
          <p className="sub">
            O que cada anúncio gastou, quantas pessoas se cadastraram e quantas entraram no grupo. Use os filtros para
            comparar períodos, públicos e criativos.
          </p>
        </div>
      </div>
      <TrafegoView info={anuncios_info} dias={anuncios_dia} />
    </>
  );
}
