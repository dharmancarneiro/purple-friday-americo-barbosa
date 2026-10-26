'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type EstadoLogin = { erro?: string };

export async function entrar(_: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const senha = String(formData.get('senha') ?? '');

  if (!email || !senha) return { erro: 'Informe e-mail e senha.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  // Mensagem única: não revela se o e-mail existe.
  if (error) return { erro: 'E-mail ou senha incorretos.' };

  redirect('/');
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
