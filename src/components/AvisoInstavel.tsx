import { Info } from 'lucide-react';

export default function AvisoInstavel() {
  return (
    <div className="alerta atencao" role="status" style={{ marginBottom: 16 }}>
      <Info />
      <div>
        <strong>Alguns números estão temporariamente indisponíveis</strong>
        <p>
          O banco demorou demais para responder e parte dos blocos aparece vazia. Atualize a página em instantes; o resto
          do painel segue correto.
        </p>
      </div>
    </div>
  );
}
