import { useEffect, useState } from 'react';
import { api } from './api.js';
import Entrar from './Entrar.jsx';
import Ola from './Ola.jsx';

export default function App() {
  // undefined = ainda carregando; null = ninguém conectado
  const [eu, setEu] = useState(undefined);

  useEffect(() => {
    api('/auth/eu')
      .then(setEu)
      .catch(() => setEu(null));
  }, []);

  async function sair() {
    try {
      await api('/auth/sair', { metodo: 'POST' });
    } finally {
      setEu(null);
    }
  }

  if (eu === undefined) {
    return (
      <main className="carregando" aria-busy="true">
        <span className="marca">EngajaDev</span>
      </main>
    );
  }
  return eu ? <Ola eu={eu} onSair={sair} /> : <Entrar onEntrou={setEu} />;
}
