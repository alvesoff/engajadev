import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tempoRelativo } from '../api.js';

const TIPOS = {
  curtir: 'Você curtiu',
  comentar: 'Você comentou',
  curtida_recebida: 'Seu post foi curtido',
  comentario_recebido: 'Seu post recebeu um comentário',
  publicar: 'Você publicou um post',
};

function Barra({ valor, limite, rotulo }) {
  const sem = !limite;
  const pct = sem ? 0 : Math.min(100, Math.round((valor / limite) * 100));
  return (
    <div className="barra-limite">
      <div className="linha-entre">
        <span>{rotulo}</span>
        <strong>
          {valor}
          {sem ? ' (sem limite)' : ` / ${limite}`}
        </strong>
      </div>
      {!sem && (
        <div className="barra" role="progressbar" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={limite} aria-label={rotulo}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function Carteira() {
  const [dados, setDados] = useState(null);
  const [regras, setRegras] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api('/carteira')
      .then(setDados)
      .catch((e) => setErro(e.message));
    api('/regras')
      .then(setRegras)
      .catch(() => {});
  }, []);

  async function mais() {
    try {
      const r = await api(`/carteira?antes=${dados.proximo}`);
      setDados((d) => ({ ...d, extrato: [...d.extrato, ...r.extrato], proximo: r.extrato.length === 30 ? r.proximo : null }));
    } catch (e) {
      setErro(e.message);
    }
  }

  if (erro)
    return (
      <p className="erro-geral" role="alert">
        {erro}
      </p>
    );
  if (!dados) return <p className="carregando">Carregando…</p>;
  return (
    <div className="pilha estreito">
      <h1>Carteira de pontos</h1>
      <section className="card saldo-grande">
        <span className="rotulo">Saldo para prêmios</span>
        <span className="valor">
          <span className="moeda" aria-hidden="true">
            ◆
          </span>{' '}
          {dados.saldo}
        </span>
        <p className="sutil">
          O ranking da semana zera, a carteira não: tudo o que você ganha fica guardado aqui. O catálogo de prêmios chega numa
          próxima fase.
        </p>
        <div className="linha-entre">
          <span>
            Como engajador: <strong>{dados.porPapel.engajador}</strong>
          </span>
          <span>
            Como criador: <strong>{dados.porPapel.criador}</strong>
          </span>
          <span>
            Nesta semana: <strong>{dados.semana}</strong>
          </span>
        </div>
      </section>

      <section className="card">
        <h2>Hoje</h2>
        <Barra valor={dados.hoje.engajador} limite={regras?.limites.pontosDiariosEngajador} rotulo="Pontos engajando" />
        <Barra valor={dados.hoje.criador} limite={regras?.limites.pontosDiariosCriador} rotulo="Pontos recebidos" />
        <p className="sutil">
          O limite diário evita curtida vazia. <Link to="/como-pontuar">Ver regras</Link>
        </p>
      </section>

      <section className="card">
        <h2>Extrato</h2>
        {dados.extrato.length === 0 && (
          <p className="sutil">
            Nada ainda. <Link to="/">Engaje no feed</Link> para ganhar os primeiros pontos.
          </p>
        )}
        <ul className="extrato">
          {dados.extrato.map((l) => (
            <li key={l.id}>
              <div>
                <span>{TIPOS[l.tipo] ?? l.tipo}</span>
                {l.post && (
                  <Link to={`/p/${l.post.id}`} className="sutil extrato-post">
                    {l.post.titulo}
                  </Link>
                )}
                <small className="sutil">{tempoRelativo(l.criadoEm)}</small>
              </div>
              <strong className="mais">+{l.pontos}</strong>
            </li>
          ))}
        </ul>
        {dados.proximo && dados.extrato.length >= 30 && (
          <button type="button" className="botao largo" onClick={mais}>
            Ver mais
          </button>
        )}
      </section>
    </div>
  );
}
