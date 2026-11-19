import { useEffect, useRef } from 'react';

/**
 * Chama `carregar` de novo a cada `ms` milissegundos e quando a pessoa volta para a aba.
 * Assim os rankings mudam na tela sem precisar recarregar a página.
 * Com a aba escondida, não busca nada.
 */
export function useAtualizar(carregar, ms = 30000) {
  const ref = useRef(carregar);
  ref.current = carregar;
  useEffect(() => {
    const rodar = () => {
      if (document.visibilityState === 'visible') ref.current();
    };
    const id = setInterval(rodar, ms);
    document.addEventListener('visibilitychange', rodar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', rodar);
    };
  }, [ms]);
}
