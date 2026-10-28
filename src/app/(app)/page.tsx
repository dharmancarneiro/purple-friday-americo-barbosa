import AvisoInstavel from '@/components/AvisoInstavel';
import VisaoView from '@/components/VisaoView';
import { getDash } from '@/lib/data';
import { fDataHora } from '@/lib/format';

export const metadata = { title: 'Visão geral · Purple Friday' };

export default async function VisaoGeral() {
  const { resumo, anuncios_info, anuncios_dia, coorte_dia, fontes, disparo, faltando_migration, instavel } = await getDash();

  return (
    <>
      <div className="pagina-topo">
        <div>
          <h1>Visão geral</h1>
          <p className="sub">
            Campanhas <code>BF_LEADS</code> · dados de {fDataHora(resumo.atualizado_em)}
          </p>
        </div>
      </div>
      {instavel && <AvisoInstavel />}
      <VisaoView
        info={anuncios_info}
        dias={anuncios_dia}
        coorte={coorte_dia}
        lives={fontes.lives}
        listas={disparo.listas}
        semDadosNovos={faltando_migration}
      />
    </>
  );
}
