import { useEffect, useState } from 'react';
import { NavLink, Link, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useSessao } from './sessao.jsx';
import { api } from './api.js';
import Icone from './componentes/Icone.jsx';
import Avatar from './componentes/Avatar.jsx';
import Entrar from './paginas/Entrar.jsx';
import Feed from './paginas/Feed.jsx';
import NovoPost from './paginas/NovoPost.jsx';
import Post from './paginas/Post.jsx';
import Rankings from './paginas/Rankings.jsx';
import Perfil from './paginas/Perfil.jsx';
import Carteira from './paginas/Carteira.jsx';
import ComoPontuar from './paginas/ComoPontuar.jsx';
import AdminRegras from './paginas/AdminRegras.jsx';

function ExigeLogin({ children }) {
  const { eu } = useSessao();
  const loc = useLocation();
  if (eu === undefined) return <p className="carregando">Carregando…</p>;
  if (!eu) return <Navigate to="/entrar" replace state={{ de: loc.pathname }} />;
  return children;
}

function TopDaSemanaLateral() {
  const { saldo } = useSessao();
  const [dados, setDados] = useState(null);
  const loc = useLocation();
  useEffect(() => {
    api('/rankings?periodo=semana&tipo=engajador')
      .then(setDados)
      .catch(() => setDados({ pessoas: [] }));
  }, [loc.pathname, saldo]);
  return (
    <section className="card lateral-bloco">
      <h2>Top Engajador da semana</h2>
      {!dados && <p className="sutil">Carregando…</p>}
      {dados?.pessoas.length === 0 && <p className="sutil">Ninguém pontuou ainda. Seja a primeira pessoa!</p>}
      <ol className="mini-ranking">
        {dados?.pessoas.slice(0, 5).map((p) => (
          <li key={p.id}>
            <span className="pos">{p.posicao}</span>
            <Link to={`/u/${p.usuario}`}>{p.nome}</Link>
            <strong>{p.pontos}</strong>
          </li>
        ))}
      </ol>
      <Link to="/rankings" className="link-forte">
        Ver todos os rankings
      </Link>
    </section>
  );
}

/** Menu de baixo, só no celular. */
function NavegacaoInferior() {
  const { eu } = useSessao();
  const itens = [
    { para: '/', nome: 'Feed', icone: 'feed', fim: true },
    { para: '/rankings', nome: 'Rankings', icone: 'ranking' },
    { para: '/postar', nome: 'Postar', icone: 'postar', destaque: true },
    { para: '/carteira', nome: 'Carteira', icone: 'carteira' },
    { para: eu ? `/u/${eu.usuario}` : '/entrar', nome: eu ? 'Perfil' : 'Entrar', icone: 'perfil' },
  ];
  return (
    <nav className="nav-inferior" aria-label="Navegação principal">
      {itens.map((i) => (
        <NavLink key={i.nome} to={i.para} end={i.fim} className={i.destaque ? 'destaque' : ''}>
          <Icone nome={i.icone} tamanho={i.destaque ? 24 : 20} />
          <span>{i.nome}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Topo() {
  const { eu, saldo, sair } = useSessao();
  return (
    <header className="topo">
      <div className="topo-dentro">
        <Link to="/" className="marca">
          <span className="marca-icone" aria-hidden="true">
            E
          </span>
          <span>EngajaDev</span>
        </Link>
        <nav className="nav-topo" aria-label="Navegação principal">
          <NavLink to="/" end>
            Feed
          </NavLink>
          <NavLink to="/rankings">Rankings</NavLink>
          {eu && <NavLink to="/carteira">Carteira</NavLink>}
          <NavLink to="/como-pontuar">Como pontuar</NavLink>
          {eu?.admin && <NavLink to="/admin/regras">Regras</NavLink>}
        </nav>
        <div className="topo-acoes">
          {eu && (
            <>
              <Link to="/carteira" className="saldo" title="Saldo da carteira">
                <span className="moeda" aria-hidden="true">
                  ◆
                </span>{' '}
                {saldo ?? '…'}
                <span className="sr"> pontos na carteira</span>
              </Link>
              <Link to="/postar" className="botao primario so-desktop">
                Postar
              </Link>
              <Link to={`/u/${eu.usuario}`} className="so-desktop" aria-label="Meu perfil" title="Meu perfil">
                <Avatar nome={eu.nome} usuario={eu.usuario} tamanho={34} />
              </Link>
              <button type="button" className="botao-icone so-desktop" onClick={sair} aria-label="Sair" title="Sair">
                <Icone nome="sair" />
              </button>
            </>
          )}
          {eu === null && (
            <Link to="/entrar" className="botao primario">
              Entrar
            </Link>
          )}
          {eu?.admin && (
            <Link to="/admin/regras" className="botao-icone so-celular" aria-label="Regras (admin)">
              <Icone nome="regras" />
            </Link>
          )}
          <Link to="/como-pontuar" className="botao-icone so-celular" aria-label="Como pontuar">
            <Icone nome="info" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const { aviso } = useSessao();
  const loc = useLocation();
  const telaCheia = loc.pathname === '/entrar';
  return (
    <div className="app">
      <a href="#conteudo" className="pular">
        Pular para o conteúdo
      </a>
      <Topo />
      <div className={`corpo ${telaCheia ? 'cheio' : ''}`}>
        <main id="conteudo">
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/entrar" element={<Entrar />} />
            <Route path="/postar" element={<ExigeLogin><NovoPost /></ExigeLogin>} />
            <Route path="/p/:id" element={<Post />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/u/:usuario" element={<Perfil />} />
            <Route path="/carteira" element={<ExigeLogin><Carteira /></ExigeLogin>} />
            <Route path="/como-pontuar" element={<ComoPontuar />} />
            <Route path="/admin/regras" element={<ExigeLogin><AdminRegras /></ExigeLogin>} />
            <Route
              path="*"
              element={
                <div className="card vazio">
                  <h1>Página não encontrada</h1>
                  <Link to="/">Voltar ao feed</Link>
                </div>
              }
            />
          </Routes>
        </main>
        {!telaCheia && (
          <aside className="lateral">
            <TopDaSemanaLateral />
            <section className="card lateral-bloco">
              <h2>Como funciona</h2>
              <p className="sutil">
                Divulgue seu post, engaje nos posts da comunidade e ganhe pontos. Comentar vale mais que curtir.
              </p>
              <Link to="/como-pontuar" className="link-forte">
                Ver as regras
              </Link>
            </section>
          </aside>
        )}
      </div>
      <NavegacaoInferior />
      <div className="avisos" role="status" aria-live="polite">
        {aviso && (
          <div key={aviso.id} className={`aviso ${aviso.tipo}`}>
            {aviso.texto}
          </div>
        )}
      </div>
    </div>
  );
}
