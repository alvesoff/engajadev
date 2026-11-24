import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, tempoRelativo, mensagemPontos } from '../api.js';
import { useSessao } from '../sessao.jsx';
import Avatar from '../componentes/Avatar.jsx';
import Icone from '../componentes/Icone.jsx';
import { BotaoCurtir, SeloRede } from '../componentes/CardPost.jsx';

/** Formulário para o autor corrigir título e descrição. O link não muda. */
function EditarPost({ post, texto, aoSalvar, aoCancelar }) {
  const [campos, setCampos] = useState({ titulo: post.titulo, descricao: post.descricao ?? '' });
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [salvando, setSalvando] = useState(false);
  const tituloMax = texto?.tituloMax ?? 120;

  function mudar(e) {
    const { name, value } = e.target;
    setCampos((c) => ({ ...c, [name]: value }));
    if (erros[name]) setErros((x) => ({ ...x, [name]: undefined }));
  }

  async function salvar(e) {
    e.preventDefault();
    setErroGeral('');
    if (campos.titulo.trim().length < 3) return setErros({ titulo: `O título deve ter de 3 a ${tituloMax} caracteres.` });
    setSalvando(true);
    try {
      const r = await api(`/posts/${post.id}`, { metodo: 'PUT', corpo: campos });
      aoSalvar(r.post);
    } catch (e2) {
      if (e2.campo && e2.campo !== 'url') setErros({ [e2.campo]: e2.message });
      else setErroGeral(e2.message);
      setSalvando(false);
    }
  }

  const props = (nome) => ({
    id: `editar-${nome}`,
    name: nome,
    value: campos[nome],
    onChange: mudar,
    'aria-invalid': erros[nome] ? 'true' : undefined,
    'aria-describedby': erros[nome] ? `editar-${nome}-erro` : undefined,
  });
  const Erro = ({ nome }) =>
    erros[nome] ? (
      <p className="erro-campo" id={`editar-${nome}-erro`}>
        {erros[nome]}
      </p>
    ) : null;

  return (
    <form className="formulario editar-post" onSubmit={salvar} noValidate aria-label="Editar post">
      <div className={`campo${erros.titulo ? ' com-erro' : ''}`}>
        <label htmlFor="editar-titulo">Título</label>
        <input {...props('titulo')} maxLength={tituloMax} autoFocus />
        <Erro nome="titulo" />
      </div>
      <div className={`campo${erros.descricao ? ' com-erro' : ''}`}>
        <label htmlFor="editar-descricao">
          Descrição <span className="sutil">(opcional)</span>
        </label>
        <textarea {...props('descricao')} rows={4} maxLength={texto?.descricaoMax ?? 500} />
        <Erro nome="descricao" />
      </div>
      <p className="sutil">O link não muda. Curtidas, comentários e pontos continuam.</p>
      {erroGeral && (
        <p className="erro-geral" role="alert">
          {erroGeral}
        </p>
      )}
      <div className="linha-botoes">
        <button type="submit" className="botao primario" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="botao" onClick={aoCancelar} disabled={salvando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function Post() {
  const { id } = useParams();
  const { eu, avisar, recarregar } = useSessao();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [texto, setTexto] = useState('');
  const [regras, setRegras] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erroComentario, setErroComentario] = useState('');
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const navegar = useNavigate();

  // Só busca depois de saber quem está conectado (eu !== undefined): assim uma resposta
  // antiga não chega depois de uma curtida e apaga a atualização.
  useEffect(() => {
    if (eu === undefined) return;
    let vivo = true;
    api(`/posts/${id}`)
      .then((d) => vivo && setDados(d))
      .catch((e) => vivo && setErro(e.message));
    api('/regras')
      .then(setRegras)
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [id, eu === undefined, eu?.id]);

  async function comentar(e) {
    e.preventDefault();
    setErroComentario('');
    if (!texto.trim()) return setErroComentario('Escreva um comentário.');
    setEnviando(true);
    try {
      const r = await api(`/posts/${id}/comentarios`, { metodo: 'POST', corpo: { texto } });
      setDados((d) => ({
        post: { ...d.post, comentarios: d.post.comentarios + 1 },
        comentarios: [...d.comentarios, r.comentario],
      }));
      setTexto('');
      avisar(mensagemPontos(r.pontos) ?? { tipo: 'ok', texto: 'Comentário publicado.' });
      recarregar();
    } catch (e2) {
      setErroComentario(e2.message);
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    setRemovendo(true);
    try {
      const r = await api(`/posts/${id}`, { metodo: 'DELETE' });
      avisar({
        tipo: 'ok',
        texto: r.motivo === 'autor' ? 'Seu post foi apagado.' : 'Post removido. Os pontos que o autor ganhou com ele foram retirados.',
      });
      recarregar();
      navegar('/', { replace: true });
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message });
      setRemovendo(false);
      setConfirmarRemocao(false);
    }
  }

  if (erro)
    return (
      <div className="card vazio">
        <h1>{erro}</h1>
        <Link to="/">Voltar ao feed</Link>
      </div>
    );
  if (!dados) return <p className="carregando">Carregando…</p>;
  const { post, comentarios } = dados;
  const minimo = regras?.limites.comentarioMinCaracteres ?? 0;
  const proprio = eu?.id === post.autor.id;
  const tamanho = texto.trim().length;

  return (
    <div className="pilha estreito">
      <article className="card post post-detalhe">
        <header className="post-topo">
          <Link to={`/u/${post.autor.usuario}`} className="autor">
            <Avatar nome={post.autor.nome} usuario={post.autor.usuario} tamanho={40} />
            <span>
              <strong>{post.autor.nome}</strong>
              <small>
                @{post.autor.usuario} · {tempoRelativo(post.criadoEm)}
                {post.editadoEm && ' · editado'}
              </small>
            </span>
          </Link>
          <SeloRede rede={post.rede} />
        </header>
        {editando ? (
          <EditarPost
            post={post}
            texto={regras?.texto}
            aoCancelar={() => setEditando(false)}
            aoSalvar={(p) => {
              setDados((d) => ({ ...d, post: p }));
              setEditando(false);
              avisar({ tipo: 'ok', texto: 'Post atualizado.' });
            }}
          />
        ) : (
          <>
            <h1>{post.titulo}</h1>
            {post.descricao && <p className="descricao">{post.descricao}</p>}
          </>
        )}
        <a href={post.url} target="_blank" rel="noopener noreferrer" className="botao primario largo">
          <Icone nome="externo" /> Abrir o post original
        </a>
        <footer className="post-acoes">
          <BotaoCurtir post={post} aoMudar={(p) => setDados((d) => ({ ...d, post: p }))} />
          <span className="acao estatica">
            <Icone nome="comentario" /> {post.comentarios}
            <span className="sr"> {post.comentarios === 1 ? 'comentário' : 'comentários'}</span>
          </span>
        </footer>
        {(proprio || eu?.admin) && (
          <div className="remover-post">
            {!confirmarRemocao ? (
              <>
                {proprio && !editando && (
                  <button type="button" className="botao pequeno" onClick={() => setEditando(true)}>
                    Editar
                  </button>
                )}
                <button type="button" className="botao perigo pequeno" onClick={() => setConfirmarRemocao(true)}>
                  {proprio ? 'Apagar meu post' : 'Remover post (moderação)'}
                </button>
              </>
            ) : (
              <>
                <p role="alert">
                  {proprio
                    ? 'Apagar este post? Ele sai do feed e do seu perfil, e este link não poderá ser divulgado de novo. Os pontos que você já ganhou continuam.'
                    : 'Remover este post? Ele sai do site e o autor perde os pontos ganhos com ele. Quem curtiu ou comentou continua com os pontos.'}
                </p>
                <button type="button" className="botao perigo cheio pequeno" onClick={remover} disabled={removendo}>
                  {removendo ? 'Removendo…' : proprio ? 'Sim, apagar' : 'Sim, remover'}
                </button>
                <button type="button" className="botao pequeno" onClick={() => setConfirmarRemocao(false)} disabled={removendo}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        )}
      </article>

      <section className="card" id="comentar">
        <h2>Comentários</h2>
        {comentarios.length === 0 && <p className="sutil">Nenhum comentário ainda. Comente e ganhe pontos!</p>}
        <ul className="comentarios">
          {comentarios.map((c) => (
            <li key={c.id}>
              <Avatar nome={c.autor.nome} usuario={c.autor.usuario} tamanho={32} />
              <div>
                <p className="comentario-topo">
                  <Link to={`/u/${c.autor.usuario}`}>
                    <strong>{c.autor.nome}</strong>
                  </Link>
                  <small className="sutil"> · {tempoRelativo(c.criadoEm)}</small>
                </p>
                <p className="comentario-texto">{c.texto}</p>
              </div>
            </li>
          ))}
        </ul>
        {eu ? (
          <form className="formulario comentar" onSubmit={comentar} noValidate>
            <div className={`campo${erroComentario ? ' com-erro' : ''}`}>
              <label htmlFor="comentario" className="sr">
                Seu comentário
              </label>
              <textarea
                id="comentario"
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setErroComentario('');
                }}
                rows={3}
                maxLength={regras?.texto.comentarioMax ?? 1000}
                placeholder={proprio ? 'Responda quem comentou…' : 'O que você achou do post?'}
                aria-invalid={erroComentario ? 'true' : undefined}
                aria-describedby="comentario-dica"
              />
            </div>
            {erroComentario && (
              <p className="erro-geral" role="alert">
                {erroComentario}
              </p>
            )}
            <div className="comentar-rodape">
              <small id="comentario-dica" className={`sutil ${!proprio && tamanho >= minimo ? 'ok' : ''}`}>
                {proprio
                  ? 'Comentar no próprio post não pontua.'
                  : tamanho >= minimo
                    ? `Este comentário pontua (+${regras?.pontos.comentar ?? 3}).`
                    : `Mais ${minimo - tamanho} ${minimo - tamanho === 1 ? 'caractere' : 'caracteres'} para pontuar.`}
              </small>
              <button type="submit" className="botao primario" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Comentar'}
              </button>
            </div>
          </form>
        ) : (
          <p>
            <Link to="/entrar" state={{ de: `/p/${post.id}` }} className="link-forte">
              Entre para comentar e ganhar pontos
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
