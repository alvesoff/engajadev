import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSessao } from '../sessao.jsx';
import Avatar from '../componentes/Avatar.jsx';
import CardPost from '../componentes/CardPost.jsx';

const NOMES = { semana: 'Top da Semana', geral: 'Top Geral' };

function Posicao({ valor }) {
  if (!valor) return <span className="sutil">—</span>;
  return (
    <>
      <strong>{valor.posicao}º</strong> <small className="sutil">{valor.pontos} pts</small>
    </>
  );
}

export default function Perfil() {
  const { usuario } = useParams();
  const { eu, sair } = useSessao();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setDados(null);
    setErro('');
    api(`/usuarios/${encodeURIComponent(usuario)}`)
      .then(setDados)
      .catch((e) => setErro(e.message));
  }, [usuario]);

  if (erro)
    return (
      <div className="card vazio">
        <h1>{erro}</h1>
        <Link to="/">Voltar ao feed</Link>
      </div>
    );
  if (!dados) return <p className="carregando">Carregando…</p>;
  const u = dados.usuario;
  const meu = eu?.id === u.id;
  const desde = new Date(u.criadoEm).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="pilha">
      <section className="card perfil-topo">
        <Avatar nome={u.nome} usuario={u.usuario} tamanho={72} />
        <div className="perfil-info">
          <h1>{u.nome}</h1>
          <p className="sutil">
            @{u.usuario} · na comunidade desde {desde}
          </p>
          {meu && (
            <div className="linha">
              <Link to="/carteira" className="botao">
                Minha carteira
              </Link>
              <Link to="/conta" className="botao">
                Minha conta
              </Link>
              <button type="button" className="botao so-celular" onClick={sair}>
                Sair
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="numeros" aria-label="Números">
        <div className="card numero">
          <span className="valor">{dados.pontos.total}</span>
          <span className="rotulo">pontos no total</span>
        </div>
        <div className="card numero">
          <span className="valor">{dados.pontos.semana}</span>
          <span className="rotulo">pontos na semana</span>
        </div>
        <div className="card numero">
          <span className="valor">{dados.numeros.posts}</span>
          <span className="rotulo">posts</span>
        </div>
        <div className="card numero">
          <span className="valor">{dados.numeros.comentariosFeitos + dados.numeros.curtidasFeitas}</span>
          <span className="rotulo">engajamentos feitos</span>
        </div>
      </section>

      <section className="card">
        <h2>Posição nos rankings</h2>
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Ranking</th>
              <th scope="col">Engajador</th>
              <th scope="col">Criador</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(NOMES).map(([k, nome]) => (
              <tr key={k}>
                <th scope="row">{nome}</th>
                <td>
                  <Posicao valor={dados.posicoes[k].engajador} />
                </td>
                <td>
                  <Posicao valor={dados.posicoes[k].criador} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>{meu ? 'Meus posts' : `Posts de ${u.nome.split(' ')[0]}`}</h2>
      {dados.posts.length === 0 && (
        <div className="card vazio">
          <p className="sutil">Nenhum post divulgado ainda.</p>
          {meu && (
            <Link to="/postar" className="botao primario">
              Divulgar um post
            </Link>
          )}
        </div>
      )}
      <div className="grade-posts">
        {dados.posts.map((p) => (
          <CardPost key={p.id} post={p} mostrarAutor={false} />
        ))}
      </div>
    </div>
  );
}
