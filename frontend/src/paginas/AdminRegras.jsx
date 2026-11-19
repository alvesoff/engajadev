import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSessao } from '../sessao.jsx';

const ORIGEM = { admin: 'mudado aqui', arquivo: 'do arquivo de regras', padrao: 'padrão' };

export default function AdminRegras() {
  const { eu, avisar } = useSessao();
  const [regras, setRegras] = useState(null);
  const [valores, setValores] = useState({});
  const [erro, setErro] = useState('');
  const [errosSalvar, setErrosSalvar] = useState([]);
  const [salvando, setSalvando] = useState(false);

  function carregar(lista) {
    setRegras(lista);
    setValores(Object.fromEntries(lista.map((r) => [r.chave, String(r.valor)])));
  }

  useEffect(() => {
    if (!eu?.admin) return;
    api('/admin/regras')
      .then((r) => carregar(r.regras))
      .catch((e) => setErro(e.message));
  }, [eu?.admin]);

  if (!eu?.admin)
    return (
      <div className="card vazio">
        <h1>Só quem administra vê esta tela.</h1>
      </div>
    );
  if (erro)
    return (
      <p className="erro-geral" role="alert">
        {erro}
      </p>
    );
  if (!regras) return <p className="carregando">Carregando…</p>;

  const grupos = [...new Set(regras.map((r) => r.grupo))];

  async function salvar(e) {
    e.preventDefault();
    setErrosSalvar([]);
    const mudadas = Object.fromEntries(
      regras.filter((r) => valores[r.chave] !== String(r.valor)).map((r) => [r.chave, valores[r.chave].trim()]),
    );
    if (!Object.keys(mudadas).length) return avisar({ tipo: 'info', texto: 'Nada mudou.' });
    setSalvando(true);
    try {
      const r = await api('/admin/regras', { metodo: 'PUT', corpo: mudadas });
      carregar(r.regras);
      avisar({ tipo: 'ok', texto: 'Regras salvas. Já valem na próxima ação.' });
    } catch (e2) {
      setErrosSalvar(e2.dados?.erros ?? [e2.message]);
    } finally {
      setSalvando(false);
    }
  }

  async function restaurar(chave) {
    try {
      const r = await api('/admin/regras', { metodo: 'PUT', corpo: { [chave]: null } });
      carregar(r.regras);
      avisar({ tipo: 'ok', texto: 'A regra voltou ao valor do arquivo.' });
    } catch (e2) {
      avisar({ tipo: 'erro', texto: e2.message });
    }
  }

  return (
    <form className="pilha estreito" onSubmit={salvar} noValidate>
      <h1>Regras do jogo</h1>
      <Link to="/admin/premios" className="botao">
        Gerir prêmios e resgates
      </Link>
      <p className="sutil">
        O que você muda aqui vale na hora, por cima do arquivo <code>backend/config/regras.json</code>. Use “restaurar” para
        voltar ao valor do arquivo.
      </p>
      {errosSalvar.length > 0 && (
        <div className="erro-geral" role="alert">
          <p>Nada foi salvo. Corrija:</p>
          <ul>
            {errosSalvar.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {grupos.map((g) => (
        <fieldset key={g} className="card regras-grupo">
          <legend>{g}</legend>
          {regras
            .filter((r) => r.grupo === g)
            .map((r) => (
              <div key={r.chave} className="regra">
                <label htmlFor={r.chave}>
                  {r.rotulo}
                  {r.ajuda && <small className="sutil">{r.ajuda}</small>}
                  <small className={`origem ${r.origem}`}>{ORIGEM[r.origem]}</small>
                </label>
                <div className="regra-campo">
                  <input
                    id={r.chave}
                    type="number"
                    inputMode="numeric"
                    min={r.min}
                    max={r.max}
                    step={1}
                    value={valores[r.chave]}
                    onChange={(e) => setValores({ ...valores, [r.chave]: e.target.value })}
                  />
                  {r.origem === 'admin' && (
                    <button type="button" className="botao pequeno" onClick={() => restaurar(r.chave)}>
                      restaurar
                    </button>
                  )}
                </div>
              </div>
            ))}
        </fieldset>
      ))}
      <div className="barra-salvar">
        <button type="submit" className="botao primario largo" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar regras'}
        </button>
      </div>
    </form>
  );
}
