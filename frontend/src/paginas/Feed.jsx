import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, REDES } from '../api.js';
import { useSessao } from '../sessao.jsx';
import CardPost from '../componentes/CardPost.jsx';

const POR_PAGINA = 20;

export default function Feed() {
  const { eu } = useSessao();
  const [rede, setRede] = useState('');
  const [posts, setPosts] = useState(null);
  const [destaques, setDestaques] = useState([]);
  const [proximo, setProximo] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (eu === undefined) return; // espera saber quem está conectado
    let vivo = true;
    setPosts(null);
    setErro('');
    api(`/posts?limite=${POR_PAGINA}${rede ? `&rede=${rede}` : ''}`)
      .then((r) => {
        if (!vivo) return;
        setPosts(r.posts);
        setDestaques(r.destaques ?? []);
        setProximo(r.posts.length === POR_PAGINA ? r.proximo : null);
      })
      .catch((e) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, [rede, eu === undefined, eu?.id]);

  async function carregarMais() {
    try {
      const r = await api(`/posts?limite=${POR_PAGINA}&antes=${proximo}${rede ? `&rede=${rede}` : ''}`);
      setPosts((p) => [...p, ...r.posts]);
      setProximo(r.posts.length === POR_PAGINA ? r.proximo : null);
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <div className="pilha">
      <div className="cabecalho-pagina">
        <div>
          {eu && <p className="ola">Olá, {eu.nome.split(' ')[0]}</p>}
          <h1>Feed da comunidade</h1>
        </div>
        {eu && (
          <Link to="/postar" className="botao primario so-desktop">
            Divulgar um post
          </Link>
        )}
      </div>
      {eu === null && (
        <div className="card chamada">
          <p>
            <strong>Divulgue seus posts e ganhe pontos engajando.</strong> Crie sua conta em 30 segundos.
          </p>
          <Link to="/entrar" className="botao primario">
            Entrar ou criar conta
          </Link>
        </div>
      )}
      <div className="filtros" role="group" aria-label="Filtrar por rede">
        <button type="button" className={`chip ${!rede ? 'ativo' : ''}`} aria-pressed={!rede} onClick={() => setRede('')}>
          Todas
        </button>
        {Object.entries(REDES).map(([k, r]) => (
          <button key={k} type="button" className={`chip ${rede === k ? 'ativo' : ''}`} aria-pressed={rede === k} onClick={() => setRede(k)}>
            {r.nome}
          </button>
        ))}
      </div>
      {erro && (
        <p className="erro-geral" role="alert">
          {erro}
        </p>
      )}
      {posts === null && !erro && <p className="carregando">Carregando posts…</p>}
      {posts?.length === 0 && (
        <div className="card vazio">
          <h2>Nenhum post por aqui ainda</h2>
          <p className="sutil">Que tal ser a primeira pessoa a divulgar?</p>
          <Link to="/postar" className="botao primario">
            Divulgar um post
          </Link>
        </div>
      )}
      {destaques.length > 0 && (
        <section className="destaques" aria-label="Posts em destaque">
          <h2>Em destaque</h2>
          {destaques.map((p) => (
            <CardPost key={`d${p.id}`} post={p} destaque />
          ))}
        </section>
      )}
      {posts?.map((p) => <CardPost key={p.id} post={p} />)}
      {proximo && (
        <button type="button" className="botao largo" onClick={carregarMais}>
          Carregar mais
        </button>
      )}
    </div>
  );
}
