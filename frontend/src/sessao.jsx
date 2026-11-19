import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);

/** Guarda quem está conectado, o saldo da carteira e os avisos rápidos (toasts). */
export function ProvedorSessao({ children }) {
  const [eu, setEu] = useState(undefined); // undefined = carregando, null = ninguém conectado
  const [saldo, setSaldo] = useState(null);
  const [aviso, setAviso] = useState(null);

  const recarregar = useCallback(async () => {
    try {
      const u = await api('/auth/eu');
      setEu(u);
      const c = await api('/carteira');
      setSaldo(c.saldo);
    } catch {
      setEu(null);
      setSaldo(null);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const entrou = useCallback(
    (u) => {
      setEu(u);
      recarregar();
    },
    [recarregar],
  );

  const avisar = useCallback((msg) => {
    if (!msg) return;
    const id = Date.now() + Math.random();
    setAviso({ ...msg, id });
    setTimeout(() => setAviso((a) => (a?.id === id ? null : a)), 4500);
  }, []);

  const sair = useCallback(async () => {
    try {
      await api('/auth/sair', { metodo: 'POST' });
    } finally {
      setEu(null);
      setSaldo(null);
    }
  }, []);

  const valor = useMemo(
    () => ({ eu, saldo, entrou, recarregar, sair, aviso, avisar }),
    [eu, saldo, entrou, recarregar, sair, aviso, avisar],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useSessao = () => useContext(Ctx);
