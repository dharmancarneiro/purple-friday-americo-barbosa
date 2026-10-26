'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

/**
 * Recarrega os dados sozinho a cada 5 minutos (e quando a aba volta a ficar visível)
 * e mostra há quanto tempo a tela foi atualizada.
 */
export default function AutoAtualizar({ intervaloMin = 5 }: { intervaloMin?: number }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const ultima = useRef<number>(0);
  const [, forcar] = useState(0);

  const recarregar = useCallback(() => {
    ultima.current = Date.now();
    iniciar(() => router.refresh());
    forcar((n) => n + 1);
  }, [router]);

  useEffect(() => {
    ultima.current = Date.now();
    forcar((n) => n + 1);
    const relogio = setInterval(() => forcar((n) => n + 1), 30_000);
    const timer = setInterval(recarregar, intervaloMin * 60_000);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultima.current > intervaloMin * 60_000) recarregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      clearInterval(relogio);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [intervaloMin, recarregar]);

  const min = ultima.current ? Math.max(0, Math.floor((Date.now() - ultima.current) / 60_000)) : 0;

  return (
    <button type="button" className="atualizar" onClick={recarregar} title="Buscar os números mais recentes agora">
      <RefreshCw size={14} aria-hidden="true" className={pendente ? 'girando' : undefined} />
      {pendente ? 'Atualizando…' : min === 0 ? 'Atualizado agora' : `Atualizado há ${min} min`}
    </button>
  );
}
