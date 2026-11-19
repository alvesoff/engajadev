import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tempoRelativo } from '../api.js';

const STATUS = {
  pendente: 'Aguardando entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado (pontos devolvidos)',
};

function quando(ms) {
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

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
          O ranking da semana zera, a carteira não: tudo o que você ganha fica guardado aqui até você trocar por um prêmio.
        </p>
        <Link to="/premios" className="botao primario">
          Trocar pontos por prêmios
        </Link>
        <div className="linha-entre">
          <span>
            Ganhos no total: <strong>{dados.totalGanho}</strong>
          </span>
          <span>
            Já trocados: <strong>{dados.resgatado}</strong>
          </span>
        </div>
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
        <h2>Meus resgates</h2>
        {dados.resgates.length === 0 && (
          <p className="sutil">
            Nenhum ainda. <Link to="/premios">Veja os prêmios</Link>.
          </p>
        )}
        <ul className="extrato">
          {dados.resgates.map((r) => (
            <li key={r.id}>
              <div>
                <span>{r.premio.nome}</span>
                {r.post && (
                  <Link to={`/p/${r.post.id}`} className="sutil extrato-post">
                    {r.post.titulo}
                  </Link>
                )}
                <small className="sutil">
                  {r.destaqueAte
                    ? r.destaqueAte > Date.now()
                      ? `Em destaque até ${quando(r.destaqueAte)}`
                      : 'Destaque encerrado'
                    : STATUS[r.status]}{' '}
                  · {tempoRelativo(r.criadoEm)}
                </small>
              </div>
              <strong className={r.status === 'cancelado' ? 'sutil riscado' : 'menos'}>−{r.custo}</strong>
            </li>
          ))}
        </ul>
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
