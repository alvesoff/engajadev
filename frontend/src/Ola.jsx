import { useState } from 'react';

export default function Ola({ eu, onSair }) {
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await onSair();
  }

  return (
    <div className="pagina">
      <header className="topo">
        <span className="marca">EngajaDev</span>
        <button type="button" className="botao secundario" onClick={sair} disabled={saindo}>
          {saindo ? 'Saindo…' : 'Sair'}
        </button>
      </header>
      <main className="ola">
        <div className="cartao">
          <h1>Olá, {eu.nome}</h1>
          <p className="sutil">Você entrou como @{eu.usuario}.</p>
        </div>
      </main>
    </div>
  );
}
