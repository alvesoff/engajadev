import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSessao } from '../sessao.jsx';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export default function ComoPontuar() {
  const { eu } = useSessao();
  const [r, setR] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    api('/regras')
      .then(setR)
      .catch((e) => setErro(e.message));
  }, []);
  if (erro)
    return (
      <p className="erro-geral" role="alert">
        {erro}
      </p>
    );
  if (!r) return <p className="carregando">Carregando…</p>;
  const lim = (v, sufixo) => (v ? `${v} ${sufixo}` : 'sem limite');
  const dia = DIAS[r.periodo.inicioSemanaDia];
  return (
    <div className="pilha estreito">
      <h1>Como pontuar</h1>
      <p className="sutil">Estas são as regras em vigor agora. Elas podem mudar para manter o jogo justo.</p>
      {eu?.admin && (
        <Link to="/admin/regras" className="botao">
          Editar as regras
        </Link>
      )}
      <section className="card">
        <h2>Pontos por ação</h2>
        <table className="tabela">
          <tbody>
            <tr>
              <th scope="row">Comentar o post de alguém</th>
              <td>+{r.pontos.comentar}</td>
            </tr>
            <tr>
              <th scope="row">Curtir o post de alguém</th>
              <td>+{r.pontos.curtir}</td>
            </tr>
            <tr>
              <th scope="row">Receber um comentário no seu post</th>
              <td>+{r.pontos.comentarioRecebido}</td>
            </tr>
            <tr>
              <th scope="row">Receber uma curtida no seu post</th>
              <td>+{r.pontos.curtidaRecebida}</td>
            </tr>
            {r.pontos.publicarPost > 0 && (
              <tr>
                <th scope="row">Publicar um post</th>
                <td>+{r.pontos.publicarPost}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Jogo limpo</h2>
        <ul className="lista">
          <li>
            Limite de pontos por dia: {lim(r.limites.pontosDiariosEngajador, 'engajando')} e{' '}
            {lim(r.limites.pontosDiariosCriador, 'recebendo')}.
          </li>
          {r.limites.cooldownSegundos > 0 && (
            <li>Espere {r.limites.cooldownSegundos} segundos entre uma curtida ou comentário e o próximo.</li>
          )}
          {r.limites.comentarioMinCaracteres > 0 && (
            <li>Comentário só pontua com {r.limites.comentarioMinCaracteres} caracteres ou mais.</li>
          )}
          <li>
            {r.limites.comentariosPontuadosPorPost
              ? `Só ${
                  r.limites.comentariosPontuadosPorPost === 1
                    ? 'o primeiro comentário'
                    : `os ${r.limites.comentariosPontuadosPorPost} primeiros comentários`
                } de cada pessoa no mesmo post pontua.`
              : 'Todos os comentários pontuam.'}
          </li>
          <li>Engajar no próprio post não pontua.</li>
          <li>Descurtir devolve os pontos da curtida, e curtir de novo não pontua mais.</li>
          <li>Cada pessoa pode divulgar {lim(r.limites.postsPorDia, 'posts por dia')}.</li>
        </ul>
      </section>
      <section className="card">
        <h2>Rankings e carteira</h2>
        <ul className="lista">
          <li>
            <strong>Top Engajador</strong>: quem mais curte e comenta. <strong>Top Criador</strong>: quem mais recebe
            engajamento.
          </li>
          <li>
            O <strong>Top da Semana</strong> zera {dia === 'sábado' || dia === 'domingo' ? 'todo' : 'toda'} {dia} às{' '}
            {String(r.periodo.inicioSemanaHora).padStart(2, '0')}h.
          </li>
          <li>
            O <strong>Top Geral</strong> é acumulado e mostra só quem tem {r.ranking.limiarTopGeral} pontos ou mais.
          </li>
          <li>
            A <strong>carteira</strong> não zera: os pontos ficam guardados para os prêmios.
          </li>
        </ul>
      </section>
    </div>
  );
}
