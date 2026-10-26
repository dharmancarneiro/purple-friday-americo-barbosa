import { LogOut } from 'lucide-react';
import { redirect } from 'next/navigation';
import AutoAtualizar from '@/components/AutoAtualizar';
import Nav from '@/components/Nav';
import { PREVIEW } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { sair } from '../login/actions';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!PREVIEW) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // Logado não basta: o e-mail precisa estar ativo em americo_pf_dash_acesso.
    const { data: autorizado } = await supabase.rpc('dash_pf_autorizado');
    if (!autorizado) {
      await supabase.auth.signOut();
      redirect('/login?erro=acesso');
    }
  }

  return (
    <div className="shell">
      <aside className="lateral">
        <div className="marca">
          <b>Purple Friday</b>
          <small>Américo Barbosa</small>
        </div>
        <Nav />
        {!PREVIEW && (
          <div className="lateral-rodape">
            <form action={sair}>
              <button className="sair" type="submit">
                <LogOut aria-hidden="true" />
                <span>Sair</span>
              </button>
            </form>
          </div>
        )}
      </aside>
      <main className="conteudo">
        <div className="barra-topo">
          <AutoAtualizar />
        </div>
        {children}
      </main>
    </div>
  );
}
