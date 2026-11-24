import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSessao } from '../sessao.jsx';

function Premio({ premio, saldo, eu, meusPosts, aoResgatar }) {
  const [confirmando, setConfirmando] = useState(false);
  const [postId, setPostId] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const esgotado = premio.estoque === 0;
  const faltam = saldo === null ? 0 : Math.max(0, premio.custo - saldo);
  const destaque = premio.tipo === 'destaque';

  async function resgatar() {
    setErro('');
    if (destaque && !postId) return setErro('Escolha qual dos seus posts vai ficar em destaque.');
    setEnviando(true);
    try {
      await aoResgatar(premio, destaque ? Number(postId) : undefined);
      setConfirmando(false);
      setPostId('');
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article className="card premio">
      <div className="premio-topo">
        <span className={`selo-tipo ${premio.tipo}`}>{destaque ? 'Destaque' : 'Brinde'}</span>
        <span className="premio-custo">
          <span className="moeda" aria-hidden="true">
            ◆
          </span>{' '}
          {premio.custo} <span className="sr">pontos</span>
        </span>
      </div>
      <h2>{premio.nome}</h2>
      {premio.descricao && <p className="sutil">{premio.descricao}</p>}
      <p className="premio-estoque sutil">
        {premio.estoque === null ? 'Sem limite de unidades' : esgotado ? 'Esgotado' : `${premio.estoque} ${premio.estoque === 1 ? 'unidade' : 'unidades'}`}
      </p>

      {!eu ? (
        <Link to="/entrar" state={{ de: '/premios' }} className="botao largo">
          Entre para resgatar
        </Link>
      ) : esgotado ? (
        <button type="button" className="botao largo" disabled>
          Esgotado
        </button>
      ) : faltam > 0 ? (
        <button type="button" className="botao largo" disabled>
          Faltam {faltam} {faltam === 1 ? 'ponto' : 'pontos'}
        </button>
      ) : !confirmando ? (
        <button type="button" className="botao primario largo" onClick={() => setConfirmando(true)}>
          Resgatar
        </button>
      ) : (
        <div className="confirmar">
          {destaque && (
            <div className="campo">
              <label htmlFor={`post-${premio.id}`}>Qual post vai ficar em destaque?</label>
              <select id={`post-${premio.id}`} value={postId} onChange={(e) => setPostId(e.target.value)}>
                <option value="">Escolha um post seu…</option>
                {meusPosts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo}
                  </option>
                ))}
              </select>
              {meusPosts.length === 0 && (
                <p className="dica">
                  Você ainda não tem posts. <Link to="/postar">Divulgue um</Link> primeiro.
                </p>
              )}
            </div>
          )}
          <p>
            Trocar <strong>{premio.custo} pontos</strong> por <strong>{premio.nome}</strong>? Sobram {saldo - premio.custo}.
          </p>
          {erro && (
            <p className="erro-geral" role="alert">
              {erro}
            </p>
          )}
          <div className="linha">
            <button type="button" className="botao primario" onClick={resgatar} disabled={enviando}>
              {enviando ? 'Resgatando…' : 'Confirmar'}
            </button>
            <button type="button" className="botao" onClick={() => setConfirmando(false)} disabled={enviando}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function Premios() {
  const { eu, saldo, avisar, recarregar } = useSessao();
  const [premios, setPremios] = useState(null);
  const [meusPosts, setMeusPosts] = useState([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api('/premios')
      .then((r) => setPremios(r.premios))
      .catch((e) => setErro(e.message));
  }, []);

  useEffect(() => {
    if (!eu) return;
    api(`/usuarios/${eu.usuario}`)
      .then((r) => setMeusPosts(r.posts))
      .catch(() => {});
  }, [eu]);

  async function aoResgatar(premio, postId) {
    await api(`/premios/${premio.id}/resgatar`, { metodo: 'POST', corpo: postId ? { postId } : {} });
    avisar({
      tipo: 'ok',
      texto:
        premio.tipo === 'destaque'
          ? 'Pronto! Seu post já está em destaque no feed.'
          : 'Resgate feito! A organização vai combinar a entrega com você por e-mail.',
    });
    recarregar();
    const r = await api('/premios');
    setPremios(r.premios);
  }

  return (
    <div className="pilha">
      <div className="cabecalho-pagina">
        <h1>Prêmios</h1>
        {eu && (
          <Link to="/carteira" className="saldo" title="Saldo da carteira">
            <span className="moeda" aria-hidden="true">
              ◆
            </span>{' '}
            {saldo ?? '…'} <span className="sr">pontos</span>
          </Link>
        )}
      </div>
      {eu?.admin && (
        <Link to="/admin/premios" className="botao">
          Gerir prêmios e resgates
        </Link>
      )}
      <p className="sutil">
        Troque os pontos da sua carteira por prêmios. Trocar não tira você do ranking: o ranking conta o seu engajamento, a
        carteira é o que você pode gastar.
      </p>
      {erro && (
        <p className="erro-geral" role="alert">
          {erro}
        </p>
      )}
      {!premios && !erro && <p className="carregando">Carregando…</p>}
      {premios?.length === 0 && (
        <div className="card vazio">
          <h2>O catálogo ainda está vazio</h2>
          <p className="sutil">Os primeiros prêmios chegam em breve. Continue juntando pontos!</p>
        </div>
      )}
      <div className="grade-premios">
        {premios?.map((p) => (
          <Premio key={p.id} premio={p} saldo={eu ? saldo : null} eu={eu} meusPosts={meusPosts} aoResgatar={aoResgatar} />
        ))}
      </div>
    </div>
  );
}
