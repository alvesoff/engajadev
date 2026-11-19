import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSessao } from '../sessao.jsx';
import Avatar from '../componentes/Avatar.jsx';
import { useAtualizar } from '../useAtualizar.js';

const TIPOS = {
  engajador: { nome: 'Top Engajador', ajuda: 'Quem mais apoia: pontos de curtir e comentar.' },
  criador: { nome: 'Top Criador', ajuda: 'Quem mais é engajado: pontos recebidos nos próprios posts.' },
};
const PERIODOS = { semana: 'Semana', geral: 'Geral' };

function quandoZera(fim) {
  return new Date(fim).toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Rankings() {
  const { eu } = useSessao();
  const [tipo, setTipo] = useState('engajador');
  const [periodo, setPeriodo] = useState('semana');
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let valendo = true;
    setDados(null);
    setErro('');
    api(`/rankings?periodo=${periodo}&tipo=${tipo}`)
      .then((d) => valendo && setDados(d))
      .catch((e) => valendo && setErro(e.message));
    return () => {
      valendo = false;
    };
  }, [tipo, periodo]);

  // Com a tela aberta, o ranking se atualiza sozinho (sem piscar a lista).
  useAtualizar(() => {
    api(`/rankings?periodo=${periodo}&tipo=${tipo}`)
      .then((d) => setDados((atual) => (atual && atual.tipo === d.tipo && atual.periodo === d.periodo ? d : atual)))
      .catch(() => {});
  });

  const podio = dados?.pessoas.slice(0, 3) ?? [];
  const resto = dados?.pessoas.slice(3) ?? [];

  return (
    <div className="pilha">
      <h1>Rankings</h1>
      <div className="abas" role="tablist" aria-label="Tipo de ranking">
        {Object.entries(TIPOS).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={tipo === k} onClick={() => setTipo(k)}>
            {t.nome}
          </button>
        ))}
      </div>
      <div className="segmentado" role="group" aria-label="Período">
        {Object.entries(PERIODOS).map(([k, nome]) => (
          <button key={k} type="button" aria-pressed={periodo === k} onClick={() => setPeriodo(k)}>
            {nome === 'Semana' ? 'Top da Semana' : 'Top Geral'}
          </button>
        ))}
      </div>
      <p className="sutil">
        {TIPOS[tipo].ajuda}{' '}
        {periodo === 'semana' && dados?.fim && <>Zera {quandoZera(dados.fim)}.</>}
        {periodo === 'geral' && dados && <>Acumulado. Só aparece quem tem {dados.minimo} pontos ou mais.</>}
      </p>

      {erro && (
        <p className="erro-geral" role="alert">
          {erro}
        </p>
      )}
      {!dados && !erro && <p className="carregando">Carregando…</p>}
      {dados?.pessoas.length === 0 && (
        <div className="card vazio">
          <h2>Ninguém aqui ainda</h2>
          <p className="sutil">
            {periodo === 'semana' ? 'A semana acabou de começar: todo mundo tem chance!' : `Junte ${dados.minimo} pontos para aparecer aqui.`}
          </p>
        </div>
      )}
      {podio.length > 0 && (
        <ol className="podio">
          {podio.map((p) => (
            <li key={p.id} className={`lugar-${p.posicao} ${eu?.id === p.id ? 'eu' : ''}`}>
              <Link to={`/u/${p.usuario}`}>
                <span className="medalha" aria-label={`${p.posicao}º lugar`}>
                  {p.posicao}
                </span>
                <Avatar nome={p.nome} usuario={p.usuario} tamanho={p.posicao === 1 ? 56 : 44} />
                <strong>{p.nome}</strong>
                <span className="pontos">{p.pontos} pts</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {resto.length > 0 && (
        <ol className="card lista-ranking" start={4}>
          {resto.map((p) => (
            <li key={p.id} className={eu?.id === p.id ? 'eu' : ''}>
              <span className="pos">{p.posicao}</span>
              <Avatar nome={p.nome} usuario={p.usuario} tamanho={32} />
              <Link to={`/u/${p.usuario}`}>
                {p.nome} <small className="sutil">@{p.usuario}</small>
              </Link>
              <strong>{p.pontos}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
