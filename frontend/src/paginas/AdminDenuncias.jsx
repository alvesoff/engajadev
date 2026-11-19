import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tempoRelativo } from '../api.js';
import { useSessao } from '../sessao.jsx';
import { SeloRede } from '../componentes/CardPost.jsx';

/** Um post denunciado, com as denúncias e as duas decisões possíveis. */
function GrupoDenuncia({ g, motivos, aoDecidir }) {
  const { avisar, recarregar } = useSessao();
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function decidir(acao) {
    setOcupado(true);
    try {
      if (acao === 'manter') {
        await api(`/admin/denuncias/${g.post.id}/manter`, { metodo: 'POST' });
        avisar({ tipo: 'ok', texto: 'Post mantido. As denúncias foram encerradas.' });
      } else {
        await api(`/posts/${g.post.id}`, { metodo: 'DELETE' });
        avisar({ tipo: 'ok', texto: 'Post removido. O autor perdeu os pontos ganhos com ele.' });
        recarregar();
      }
      aoDecidir();
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message });
      setOcupado(false);
      setConfirmar(false);
    }
  }

  return (
    <li className="card grupo-denuncia">
      <div className="linha-entre">
        <SeloRede rede={g.post.rede} />
        <span className="contador" aria-label={`${g.total} ${g.total === 1 ? 'denúncia' : 'denúncias'}`}>
          {g.total}
        </span>
      </div>
      <h2>
        <Link to={`/p/${g.post.id}`}>{g.post.titulo}</Link>
      </h2>
      <p className="sutil">
        de <Link to={`/u/${g.post.autor.usuario}`}>{g.post.autor.nome}</Link> · publicado {tempoRelativo(g.post.criadoEm)} ·{' '}
        <a href={g.post.url} target="_blank" rel="noopener noreferrer">
          abrir o link
        </a>
      </p>
      <ul className="chips" aria-label="Motivos">
        {Object.entries(g.motivos).map(([m, n]) => (
          <li key={m}>
            {motivos[m] ?? m} <strong>{n}</strong>
          </li>
        ))}
      </ul>
      <ul className="lista-denuncias">
        {g.denuncias.map((d) => (
          <li key={d.id}>
            <strong>{d.quem.nome}</strong> <span className="sutil">(@{d.quem.usuario}) · {tempoRelativo(d.criadoEm)}</span>
            <span>
              {motivos[d.motivo] ?? d.motivo}
              {d.detalhe && <>: “{d.detalhe}”</>}
            </span>
          </li>
        ))}
      </ul>
      {!confirmar ? (
        <div className="linha-botoes">
          <button type="button" className="botao pequeno" onClick={() => decidir('manter')} disabled={ocupado}>
            Manter post
          </button>
          <button type="button" className="botao perigo pequeno" onClick={() => setConfirmar(true)} disabled={ocupado}>
            Remover post
          </button>
        </div>
      ) : (
        <div className="remover-post">
          <p role="alert">
            Remover este post? Ele sai do site e o autor perde os pontos ganhos com ele. Quem curtiu ou comentou continua com os pontos.
          </p>
          <button type="button" className="botao perigo cheio pequeno" onClick={() => decidir('remover')} disabled={ocupado}>
            {ocupado ? 'Removendo…' : 'Sim, remover'}
          </button>
          <button type="button" className="botao pequeno" onClick={() => setConfirmar(false)} disabled={ocupado}>
            Cancelar
          </button>
        </div>
      )}
    </li>
  );
}

export default function AdminDenuncias() {
  const { eu } = useSessao();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => {
    api('/admin/denuncias')
      .then(setDados)
      .catch((e) => setErro(e.message));
  }, []);

  useEffect(() => {
    if (eu?.admin) carregar();
  }, [eu?.admin, carregar]);

  if (eu && !eu.admin)
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
  if (!dados) return <p className="carregando">Carregando…</p>;

  return (
    <div className="pilha estreito">
      <h1>Denúncias</h1>
      <p className="sutil">
        Posts que a comunidade denunciou, os mais denunciados primeiro. O post só sai do ar se você remover.{' '}
        <Link to="/admin/regras">Voltar às regras</Link>
      </p>
      {dados.fila.length === 0 ? (
        <div className="card vazio">
          <h2>Nenhuma denúncia aberta</h2>
          <p className="sutil">Quando alguém denunciar um post, ele aparece aqui.</p>
        </div>
      ) : (
        <ul className="lista-grupos">
          {dados.fila.map((g) => (
            <GrupoDenuncia key={g.post.id} g={g} motivos={dados.motivos} aoDecidir={carregar} />
          ))}
        </ul>
      )}
    </div>
  );
}
