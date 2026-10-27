import PublicoView from '@/components/PublicoView';
import { getDash } from '@/lib/data';

export const metadata = { title: 'Público · Purple Friday' };

export default async function Publico() {
  const { publico, coorte_dia, faltando_migration, utms, faltando_utms } = await getDash();

  return (
    <>
      <div className="pagina-topo">
        <div>
          <h1>Público</h1>
          <p className="sub">
            Quem são as pessoas que se cadastraram: alunos ou não alunos, de onde vieram e quantas entraram e ficaram no
            grupo.
          </p>
        </div>
      </div>
      <PublicoView p={publico} coorte={coorte_dia} utms={utms ?? []} semUtms={faltando_utms} semDadosNovos={faltando_migration} />
    </>
  );
}
