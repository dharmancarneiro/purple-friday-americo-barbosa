import AvisoInstavel from '@/components/AvisoInstavel';
import DiarioView from '@/components/DiarioView';
import { getDash } from '@/lib/data';

export const metadata = { title: 'Dia a dia · Purple Friday' };

export default async function Diario() {
  const { diario, anuncios_info, anuncios_dia, coorte_dia, faltando_migration, instavel } = await getDash();

  return (
    <>
      <div className="pagina-topo">
        <div>
          <h1>Dia a dia</h1>
          <p className="sub">
            O que aconteceu em cada dia: quanto foi investido, quantos se cadastraram, de onde vieram e quantos entraram
            no grupo.
          </p>
        </div>
      </div>
      {instavel && <AvisoInstavel />}
      <DiarioView
        diario={diario}
        info={anuncios_info}
        dias={anuncios_dia}
        coorte={coorte_dia}
        semDadosNovos={faltando_migration}
      />
    </>
  );
}
