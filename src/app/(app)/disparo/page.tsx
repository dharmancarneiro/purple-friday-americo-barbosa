import AvisoInstavel from '@/components/AvisoInstavel';
import DisparoView from '@/components/DisparoView';
import { getDash } from '@/lib/data';

export const metadata = { title: 'Disparo e régua · Purple Friday' };

export default async function Disparo() {
  const { disparo, disparo_dia, coorte_dia, disparos, conferencia, faltando_migration, faltando_disparos, instavel } = await getDash();

  return (
    <>
      <div className="pagina-topo">
        <div>
          <h1>Disparo e régua</h1>
          <p className="sub">
            Convites por WhatsApp para as listas e mensagens de persistência para quem se cadastrou e ainda não entrou no
            grupo. Os envios vêm da tabela de disparos.
          </p>
        </div>
      </div>
      {instavel && <AvisoInstavel />}
      <DisparoView
        d={disparo}
        dia={disparo_dia}
        coorte={coorte_dia}
        disparos={disparos}
        conferencia={conferencia}
        semDadosNovos={faltando_migration}
        faltandoDisparos={faltando_disparos}
      />
    </>
  );
}
