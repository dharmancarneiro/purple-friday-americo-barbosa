'use client';

import { useActionState } from 'react';
import { entrar, type EstadoLogin } from './actions';

export default function FormLogin() {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao}>
      <label htmlFor="email">E-mail</label>
      <input id="email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="senha">Senha</label>
      <input id="senha" name="senha" type="password" autoComplete="current-password" required />
      {estado.erro && (
        <p className="erro" role="alert">
          {estado.erro}
        </p>
      )}
      <button className="entrar" type="submit" disabled={pendente}>
        {pendente ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
