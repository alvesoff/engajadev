import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, REDES, tempoRelativo, mensagemPontos } from '../api.js';
import { useSessao } from '../sessao.jsx';
import Avatar from './Avatar.jsx';
import Icone from './Icone.jsx';

export function SeloRede({ rede }) {
  const r = REDES[rede] ?? REDES.outra;
  return (
    <span className="selo-rede" style={{ '--cor-rede': r.cor }}>
      {r.nome}
    </span>
  );
}

/** Botão de curtir: curte/descurte e avisa quantos pontos a pessoa ganhou. */
export function BotaoCurtir({ post, aoMudar }) {
  const { eu, avisar, recarregar } = useSessao();
  const navegar = useNavigate();
  const [ocupado, setOcupado] = useState(false);

  async function alternar() {
    if (!eu) return navegar('/entrar', { state: { de: `/p/${post.id}` } });
    if (ocupado) return;
    setOcupado(true);
    try {
      const r = await api(`/posts/${post.id}/curtida`, { metodo: post.curtiu ? 'DELETE' : 'POST' });
      aoMudar(r.post);
      if (r.pontos) avisar(mensagemPontos(r.pontos));
      else avisar({ tipo: 'info', texto: 'Curtida desfeita. Os pontos dela voltaram.' });
      recarregar();
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      type="button"
      className={`acao ${post.curtiu ? 'ativa' : ''}`}
      onClick={alternar}
      aria-pressed={post.curtiu}
      aria-label={`${post.curtiu ? 'Descurtir' : 'Curtir'} (${post.curtidas} ${post.curtidas === 1 ? 'curtida' : 'curtidas'})`}
      disabled={ocupado}
    >
      <Icone nome="coracao" cheio={post.curtiu} />
      <span aria-hidden="true">{post.curtidas}</span>
    </button>
  );
}

export default function CardPost({ post: inicial, mostrarAutor = true, destaque = false }) {
  const [post, setPost] = useState(inicial);
  return (
    <article className={`card post${destaque ? ' em-destaque' : ''}`}>
      {mostrarAutor && (
        <header className="post-topo">
          <Link to={`/u/${post.autor.usuario}`} className="autor">
            <Avatar nome={post.autor.nome} usuario={post.autor.usuario} tamanho={32} />
            <span>
              <strong>{post.autor.nome}</strong>
              <small>
                @{post.autor.usuario} · {tempoRelativo(post.criadoEm)}
              </small>
            </span>
          </Link>
          <SeloRede rede={post.rede} />
        </header>
      )}
      <Link to={`/p/${post.id}`} className="post-corpo">
        {!mostrarAutor && <SeloRede rede={post.rede} />}
        <h2 className="post-titulo">{post.titulo}</h2>
        {post.descricao && <p>{post.descricao}</p>}
      </Link>
      <footer className="post-acoes">
        <BotaoCurtir post={post} aoMudar={setPost} />
        <Link
          to={`/p/${post.id}#comentar`}
          className="acao"
          aria-label={`Comentar (${post.comentarios} ${post.comentarios === 1 ? 'comentário' : 'comentários'})`}
        >
          <Icone nome="comentario" />
          <span aria-hidden="true">{post.comentarios}</span>
        </Link>
        <a href={post.url} target="_blank" rel="noopener noreferrer" className="acao abrir">
          <Icone nome="externo" />
          <span>Abrir post</span>
        </a>
      </footer>
    </article>
  );
}
