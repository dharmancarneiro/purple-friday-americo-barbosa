'use client';

import { OctagonAlert } from 'lucide-react';

export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="alerta ruim" role="alert" style={{ maxWidth: 560 }}>
      <OctagonAlert size={20} aria-hidden="true" />
      <div>
        <strong>Não foi possível carregar os números</strong>
        <p>Pode ser uma instabilidade momentânea. Tente de novo; se continuar, avise quem cuida do dashboard.</p>
        <p className="acao">
          <button type="button" className="atualizar" onClick={reset}>
            Tentar de novo
          </button>
        </p>
      </div>
    </div>
  );
}
