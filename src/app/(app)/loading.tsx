export default function Carregando() {
  return (
    <div aria-busy="true" aria-label="Carregando os números">
      <div className="esqueleto" style={{ height: 34, width: 220, marginBottom: 10 }} />
      <div className="esqueleto" style={{ height: 18, width: 380, marginBottom: 26 }} />
      <div className="grade k4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="esqueleto" style={{ height: 118 }} />
        ))}
      </div>
      <div className="esqueleto" style={{ height: 300, marginTop: 22 }} />
    </div>
  );
}
