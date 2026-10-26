import FormLogin from './FormLogin';

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;

  return (
    <div className="login">
      <div className="caixa">
        <h1>Purple Friday</h1>
        <p className="sub">Acesso restrito. Entre com seu e-mail e senha.</p>
        {erro === 'acesso' && (
          <p className="erro" role="alert">
            Este e-mail não tem acesso ao dashboard.
          </p>
        )}
        <FormLogin />
      </div>
    </div>
  );
}
